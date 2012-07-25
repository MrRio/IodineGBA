/* 
 * This file is part of IodineGBA
 *
 * Copyright (C) 2012 Grant Galitz
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 * The full license is available at http://www.gnu.org/licenses/gpl.html
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 */
function GameBoyAdvanceEmulator() {
	this.emulatorSpeed = 1;					//Speed multiplier of the emulator.
	this.timerIntervalRate = 4;				//How often the emulator core is called into (in milliseconds).
	this.graphicsFound = false;				//Do we have graphics output sink found yet?
	this.audioFound = false;				//Do we have audio output sink found yet?
	this.romFound = false;					//Do we have a ROM loaded in?
	this.biosFound = false;					//Do we have the BIOS ROM loaded in?
	this.faultFound = false;				//Did we run into a fatal error?
	this.paused = true;						//Are we paused?
	this.audioVolume = 1;					//Starting audio volume.
	this.audioBufferUnderrunLimit = 15;		//Audio buffer minimum span amount over x interpreter iterations.
	this.audioBufferSize = 30;				//Audio buffer maximum span amount over x interpreter iterations.
	this.offscreenWidth = 240;				//Width of the GBA screen.
	this.offscreenHeight = 160;				//Height of the GBA screen.
	//Cache some frame buffer lengths:
	this.offscreenRGBCount = this.offscreenWidth * this.offscreenHeight * 3;
	this.offscreenRGBACount = this.offscreenWidth * this.offscreenHeight * 4;
	//Graphics buffers to generate in advance:
	this.frameBuffer = getInt32Array(this.offscreenRGBCount);		//The internal buffer to composite to.
	this.swizzledFrame = getUint8Array(this.offscreenRGBCount);		//The swizzled output buffer that syncs to the internal framebuffer on v-blank.
	this.initializeGraphicsBuffer();								//Pre-set the swizzled buffer for first frame.
	this.drewFrame = false;					//Did we draw the last iteration?
	this.audioUpdateState = false;			//Do we need to update the sound core with new info?
	//Calculate some multipliers against the core emulator timer:
	this.calculateTimings();
}
GameBoyAdvanceEmulator.prototype.play = function () {
	if (this.paused) {
		this.startTimer();
		this.paused = false;
	}
}
GameBoyAdvanceEmulator.prototype.pause = function () {
	if (!this.paused) {
		this.clearTimer();
		this.save();
		this.paused = true;
	}
}
GameBoyAdvanceEmulator.prototype.stop = function () {
	this.faultFound = false;
	this.romFound = false;
	this.pause();
}
GameBoyAdvanceEmulator.prototype.restart = function () {
	this.faultFound = false;
	this.save();
	this.initializeCore();
}
GameBoyAdvanceEmulator.prototype.clearTimer = function () {
	clearInterval(this.timer);
}
GameBoyAdvanceEmulator.prototype.startTimer = function () {
	this.clearTimer();
	var parentObj = this;
	this.timer = setInterval(function (){parentObj.timerCallback()}, this.timerIntervalRate);
}
GameBoyAdvanceEmulator.prototype.timerCallback = function () {
	//Check to see if web view is not hidden, if hidden don't run due to JS timers being inaccurate on page hide:
	if (!document.hidden && !document.msHidden && !document.mozHidden && !document.webkitHidden) {
		if (!this.faultFound && this.romFound && this.biosFound) {		//Any error pending or no ROM loaded is a show-stopper!
			this.iterationStartSequence();								//Run start of iteration stuff.
			this.IOCore.iterate();										//Step through the emulation core loop.
			this.iterationEndSequence();								//Run end of iteration stuff.
		}
		else {
			this.pause();												//Some pending error is preventing execution, so pause.
		}
	}
}
GameBoyAdvanceEmulator.prototype.iterationStartSequence = function () {
	this.faultFound = true;			//If the end routine doesn't unset this, then we are marked as having crashed.
	this.drewFrame = false;			//Graphics has not drawn yet for this iteration block.
	this.audioUnderrunAdjustment();	//If audio is enabled, look to see how much we should overclock by to maintain the audio buffer.
	this.audioPushNewState();		//Check to see if we need to update the audio core for any output changes.
}
GameBoyAdvanceEmulator.prototype.iterationEndSequence = function () {
	this.requestDraw();				//If drewFrame is true, blit buffered frame out.
	this.faultFound = false;		//If core did not throw while running, unset the fatal error flag.
}
GameBoyAdvanceEmulator.prototype.attachROM = function (ROM) {
	this.stop();
	this.ROM = this.decodeROM(ROM);
	if (this.biosFound) {
		this.initializeCore();
	}
	this.romFound = true;
}
GameBoyAdvanceEmulator.prototype.attachBIOS = function (BIOS) {
	this.stop();
	this.BIOS = this.decodeROM(BIOS);
	if (this.romFound) {
		this.initializeCore();
	}
	this.biosFound = true;
}
GameBoyAdvanceEmulator.prototype.setSpeed = function (speed) {
	this.emulatorSpeed = Math.min(Math.max(parseFloat(speed), 0.01), 10);
	this.calculateTimings();
	this.reinitializeAudio();
}
GameBoyAdvanceEmulator.prototype.changeCoreTimer = function (newTimerIntervalRate) {
	this.timerIntervalRate = Math.max(parseInt(newTimerIntervalRate), 1);
	if (!this.paused) {						//Set up the timer again if running.
		this.clearTimer();
		this.startTimer();
	}
	this.calculateTimings();
	this.reinitializeAudio();
}
GameBoyAdvanceEmulator.prototype.calculateTimings = function () {
	this.clocksPerSecond = this.emulatorSpeed * 0x1000000;
	this.CPUCyclesTotal = this.CPUCyclesPerIteration = (this.clocksPerSecond / 1000 * this.timerIntervalRate) | 0;
}
GameBoyAdvanceEmulator.prototype.initializeCore = function () {
	//Setup a new instance of the i/o core:
	this.IOCore = new GameBoyAdvanceIO(this);
}
GameBoyAdvanceEmulator.prototype.keyDown = function (keyPressed) {
	if (!this.paused && this.romFound && this.biosFound) {
		this.IOCore.joypad.keyPress(keyPressed);
	}
}
GameBoyAdvanceEmulator.prototype.keyUp = function (keyReleased) {
	if (!this.paused && this.romFound && this.biosFound) {
		this.IOCore.joypad.keyRelease(keyReleased);
	}
}
GameBoyAdvanceEmulator.prototype.attachCanvas = function (canvas) {
	this.canvas = canvas;
	if (this.initializeCanvasTarget()) {
		this.graphicsFound = true;
	}
	else {
		this.graphicsFound = false;
	}
}
GameBoyAdvanceEmulator.prototype.recomputeDimension = function () {
	//Cache some dimension info:
	this.canvasLastWidth = this.canvas.clientWidth;
	this.canvasLastHeight = this.canvas.clientHeight;
	if (window.mozRequestAnimationFrame) {	//Sniff out firefox for selecting this path.
		//Set target as unscaled:
		this.onscreenWidth = this.canvas.width = this.offscreenWidth;
		this.onscreenHeight = this.canvas.height = this.offscreenHeight;
	}
	else {
		//Set target canvas as scaled:
		this.onscreenWidth = this.canvas.width = this.canvas.clientWidth;
		this.onscreenHeight = this.canvas.height = this.canvas.clientHeight;
	}
}
GameBoyAdvanceEmulator.prototype.initializeCanvasTarget = function () {
	try {
		//Obtain dimensional information:
		this.recomputeDimension();
		//Get handles on the canvases:
		this.canvasOffscreen = document.createElement("canvas");
		this.canvasOffscreen.width = this.offscreenWidth;
		this.canvasOffscreen.height = this.offscreenHeight;
		this.drawContextOffscreen = this.canvasOffscreen.getContext("2d");
		this.drawContextOnscreen = this.canvas.getContext("2d");
		//Get a CanvasPixelArray buffer:
		try {
			this.canvasBuffer = this.drawContextOffscreen.createImageData(this.offscreenWidth, this.offscreenHeight);
		}
		catch (error) {
			this.canvasBuffer = this.drawContextOffscreen.getImageData(0, 0, this.offscreenWidth, this.offscreenHeight);
		}
		//Initialize Alpha Channel:
		for (var indexGFXIterate = 3; indexGFXIterate < this.offscreenRGBACount; indexGFXIterate += 4) {
			this.canvasBuffer.data[indexGFXIterate] = 0xFF;
		}
		//Draw swizzled buffer out as a test:
		this.drewFrame = true;
		this.requestDraw();
		//Success:
		return true;
	}
	catch (error) {
		//Failure:
		return false;
	}
}
GameBoyAdvanceEmulator.prototype.initializeGraphicsBuffer = function () {
	//Initialize the first frame to a white screen:
	var bufferIndex = 0;
	while (bufferIndex < this.offscreenRGBCount) {
		this.swizzledFrame[bufferIndex++] = 0xF8;
	}
}
GameBoyAdvanceEmulator.prototype.swizzleFrameBuffer = function () {
	//Convert our dirty 15-bit (15-bit, with internal render flags above it) framebuffer to an 8-bit buffer with separate indices for the RGB channels:
	var bufferIndex = 0;
	for (var canvasIndex = 0; canvasIndex < this.offscreenRGBCount;) {
		this.swizzledFrame[canvasIndex++] = (this.frameBuffer[bufferIndex] & 0x1F) << 3;			//Red
		this.swizzledFrame[canvasIndex++] = (this.frameBuffer[bufferIndex] & 0x3E0) << 6;			//Green
		this.swizzledFrame[canvasIndex++] = (this.frameBuffer[bufferIndex++] & 0x7C00) << 9;		//Blue
	}
}
GameBoyAdvanceEmulator.prototype.prepareFrame = function () {
	//Copy the internal frame buffer to the output buffer:
	this.swizzleFrameBuffer();
	this.drewFrame = true;
}
GameBoyAdvanceEmulator.prototype.requestDraw = function () {
	if (this.drewFrame && this.isCanvasEnabled) {
		//We actually updated the graphics internally, so copy out:
		var canvasData = this.canvasBuffer.data;
		var bufferIndex = 0;
		for (var canvasIndex = 0; canvasIndex < this.offscreenRGBACount; ++canvasIndex) {
			canvasData[canvasIndex++] = this.swizzledFrame[bufferIndex++];
			canvasData[canvasIndex++] = this.swizzledFrame[bufferIndex++];
			canvasData[canvasIndex++] = this.swizzledFrame[bufferIndex++];
		}
		this.graphicsBlit();
	}
}
GameBoyAdvanceEmulator.prototype.graphicsBlit = function () {
	if (this.isCanvasEnabled) {
		if (this.canvasLastWidth != this.canvas.clientWidth || this.canvasLastHeight != this.canvas.clientHeight) {
			this.recomputeDimension();
		}
		if (this.offscreenWidth == this.onscreenWidth && this.offscreenHeight == this.onscreenHeight) {
			//Canvas does not need to scale, draw directly to final:
			this.drawContextOnscreen.putImageData(this.canvasBuffer, 0, 0);
		}
		else {
			//Canvas needs to scale, draw to offscreen first:
			this.drawContextOffscreen.putImageData(this.canvasBuffer, 0, 0);
			//Scale offscreen canvas image onto the final:
			this.drawContextOnscreen.drawImage(this.canvasOffscreen, 0, 0, this.onscreenWidth, this.onscreenHeight);
		}
	}
}
GameBoyAdvanceEmulator.prototype.enableAudio = function () {
	if (!this.audioFound) {
		//Calculate the variables for the preliminary downsampler first:
		this.audioResamplerFirstPassFactor = Math.max(Math.min(Math.floor(this.clocksPerSecond / 44100), Math.floor(0xFFFF / 0x3FF)), 1);
		this.audioDownSampleInputDivider = 0.5 / (this.audioResamplerFirstPassFactor * 0x3FF);
		this.audioSetState(true);	//Set audio to 'found' by default.
		//Attempt to enable audio:
		var parentObj = this;
		this.audio = new XAudioServer(2, this.clocksPerSecond / this.audioResamplerFirstPassFactor, 0, Math.max(this.CPUCyclesPerIteration * this.audioBufferSize / this.audioResamplerFirstPassFactor, 8192) << 1, null, this.audioVolume, function () {
			//Disable audio in the callback here:
			parentObj.disableAudio();
		});
		if (this.audioFound) {
			//Only run this if audio was found to save memory on disabled output:
			this.initializeAudioBuffering();
		}
	}
}
GameBoyAdvanceEmulator.prototype.disableAudio = function () {
	if (this.audioFound) {
		this.audio.changeVolume(0);
		this.audioSetState(false);
	}
}
GameBoyAdvanceEmulator.prototype.initializeAudioBuffering = function () {
	this.audioDestinationPosition = 0;
	this.audioBufferContainAmount = Math.max(this.CPUCyclesPerIteration * audioBufferUnderrunLimit / this.audioResamplerFirstPassFactor, 4096) << 1;
	this.audioNumSamplesTotal = (this.CPUCyclesPerIteration / this.audioResamplerFirstPassFactor) << 1;
	this.audioBuffer = getFloat32Array(this.audioNumSamplesTotal);
}
GameBoyAdvanceEmulator.prototype.changeVolume = function (newVolume) {
	this.audioVolume = Math.min(Math.max(parseFloat(newVolume), 0), 1);
	if (this.audioFound) {
		this.audio.changeVolume(this.audioVolume);
	}
}
GameBoyAdvanceEmulator.prototype.outputAudio = function (downsampleInput) {
	this.audioBuffer[this.audioDestinationPosition++] = (downsampleInput >>> 16) * this.audioDownSampleInputDivider - 1;
	this.audioBuffer[this.audioDestinationPosition++] = (downsampleInput & 0xFFFF) * this.audioDownSampleInputDivider - 1;
	if (this.audioDestinationPosition == this.audioNumSamplesTotal) {
		this.audio.writeAudioNoCallback(this.audioBuffer);
		this.audioDestinationPosition = 0;
	}
}
GameBoyAdvanceEmulator.prototype.audioUnderrunAdjustment = function () {
	if (this.audioFound) {
		var underrunAmount = this.audio.remainingBuffer();
		if (typeof underrunAmount == "number") {
			underrunAmount = this.audioBufferContainAmount - Math.max(underrunAmount, 0);
			if (underrunAmount > 0) {
				this.CPUCyclesTotal += (underrunAmount >> 1) * this.audioResamplerFirstPassFactor;
			}
		}
	}
	else {
		this.CPUCyclesTotal = this.CPUCyclesPerIteration;
	}
}
GameBoyAdvanceEmulator.prototype.audioPushNewState = function () {
	if (this.audioUpdateState) {
		this.IOCore.sound.initializeOutput(this.audioFound, this.audioResamplerFirstPassFactor);
		this.audioUpdateState = false;
	}
}
GameBoyAdvanceEmulator.prototype.audioSetState = function (audioFound) {
	if (this.audioFound != audioFound) {
		this.audioFound = audioFound;
		this.audioUpdateState = true;
	}
}
GameBoyAdvanceEmulator.prototype.reinitializeAudio = function () {
	if (this.audioFound) {					//Set up the audio again if enabled.
		this.disableAudio();
		this.enableAudio();
	}
}