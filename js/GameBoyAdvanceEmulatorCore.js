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
	this.timerIntervalRate = 10;
	this.stopEmulator = (
		0x1 |								//No Canvas Target
		0x2 |								//No Audio Target
		0x0 |								//Emulation Fault (Once triggered the emulation can not run further)
		0x8 |								//Paused
		0x10								//No ROM loaded
	);
	this.audioVolume = 1;					//Starting audio volume.
	this.audioBufferUnderrunLimit = 10;		//Audio buffer minimum span amount over x interpreter iterations.
	this.audioBufferSize = 25;				//Audio buffer maximum span amount over x interpreter iterations.
	this.offscreenWidth = 240;
	this.offscreenHeight = 160;
	this.offscreenRGBCount = this.offscreenWidth * this.offscreenHeight * 3;
	this.offscreenRGBACount = this.offscreenWidth * this.offscreenHeight * 4;
	this.swizzledFrame = getUint8Array(this.offscreenRGBCount);
	this.frameBuffer = getInt32Array(this.offscreenRGBCount);
	this.drewFrame = false;					//Did we draw the last iteration?
	this.calculateTimings();
}
GameBoyAdvanceEmulator.prototype.pause = function () {
	this.stopEmulator |= 0x8;
}
GameBoyAdvanceEmulator.prototype.play = function () {
	this.stopEmulator &= 0x17;
	this.startTimer();
}
GameBoyAdvanceEmulator.prototype.stop = function () {
	this.stopEmulator &= 0x3;
	this.stopEmulator |= 0x18;
	this.clearTimer();
	this.save();
}
GameBoyAdvanceEmulator.prototype.restart = function () {
	this.stopEmulator &= 0x1B;
	this.save();
	this.initializeROM();
}
GameBoyAdvanceEmulator.prototype.setFatal = function () {
	//Call this method when a fatal action occurs:
	this.stopEmulator |= 0x4;
	this.clearTimer();
}
GameBoyAdvanceEmulator.prototype.clearTimer = function () {
	if (this.timer !== null) {
		clearInterval(this.timer);
	}
	this.timer = null;
}
GameBoyAdvanceEmulator.prototype.startTimer = function () {
	this.clearTimer();
	var parentObj = this;
	this.timer = setInterval(parentObj.timerCallback, this.timerIntervalRate);
}
GameBoyAdvanceEmulator.prototype.timerCallback = function () {
	if (!document.hidden && !document.msHidden && !document.mozHidden && !document.webkitHidden) {
		if (this.stopEmulator < 0x4) {		//Can run with either graphics or audio disabled.
			this.stopEmulator |= 0x4;		//If the end routine doesn't unset this, then we are marked as having crashed.
			this.drewFrame = false;			//Audio has not drawn yet for this iteration block.
			this.audioUnderrunAdjustment();	//If audio is enabled, look to see how much we should overclock by to maintain the audio buffer.
			//Step through the emulation core loop:
			for (var clocksToIterate = 0; clocksToIterate < this.CPUCyclesTotal; ++clocksToIterate) {
				this.IOCore.iterate();
			}
			//Handle end of iteration block stuff (gfx blit, etc.):
			if (clocksToIterate == this.CPUCyclesTotal) {
				this.IOCore.iterationBlockEndHandle();
				this.stopEmulator &= 0x1B;
			}
		}
	}
}
GameBoyAdvanceEmulator.prototype.attachROM = function (ROM, encodingType) {
	this.stop();
	this.ROM = this.decodeROM(ROM, encodingType);
	this.stopEmulator &= 0x10;
	this.initializeROM();
}
GameBoyAdvanceEmulator.prototype.initializeROM = function () {
	if (this.stopEmulator > 0xF) {
		//Setup a new instance of the i/o core:
		this.IOCore = new GameBoyAdvanceIO(this);
	}
}
GameBoyAdvanceEmulator.prototype.attachCanvas = function (canvas) {
	this.canvas = canvas;
	if (this.initializeCanvasTarget()) {
		this.stopEmulator &= 0x1;	//Flag as clean.
	}
	else {
		this.stopEmulator |= 0x1;
	}
}
GameBoyCore.prototype.recomputeDimension = function () {
	//Cache some dimension info:
	this.canvasLastWidth = this.canvas.clientWidth;
	this.canvasLastHeight = this.canvas.clientHeight;
	if (window && window.mozRequestAnimationFrame) {
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
		this.recomputeDimension();
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
		for (var indexGFXIterate = this.offscreenRGBACount; indexGFXIterate > 0;) {
			this.canvasBuffer.data[indexGFXIterate -= 4] = 0xF8;
			this.canvasBuffer.data[indexGFXIterate + 1] = 0xF8;
			this.canvasBuffer.data[indexGFXIterate + 2] = 0xF8;
			this.canvasBuffer.data[indexGFXIterate + 3] = 0xFF;
		}
		this.graphicsBlit();
		this.drewFrame = true;										//Copy the latest graphics to buffer.
		this.requestDraw();
		return true;
	}
	catch (error) {
		return false;
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
	if (this.drewFrame && this.isCanvasEnabled()) {
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
	if (this.isCanvasEnabled()) {
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
GameBoyAdvanceEmulator.prototype.isCanvasEnabled = function () {
	return (this.stopEmulator & 0x1) == 0;
}
GameBoyAdvanceEmulator.prototype.enableAudio = function () {
	if (!this.isAudioOn()) {
		try {
			this.audio = new XAudioServer(2, 0x40000, 0, Math.max(this.sampleSize * this.audioBufferSize, 0x2000) << 1, null, this.audioVolume);
			this.stopEmulator &= 0x1D;
		}
		catch (e) {
			this.stopEmulator |= 0x2;
		}
	}
}
GameBoyAdvanceEmulator.prototype.changeVolume = function (newVolume) {
	this.audioVolume = Math.min(Math.max(parseFloat(newVolume), 0), 1);
	if (this.isAudioOn()) {
		try {
			this.audio.changeVolume(this.audioVolume);
		}
		catch (e) {
			this.stopEmulator |= 0x2;
		}
	}
}
GameBoyAdvanceEmulator.prototype.disableAudio = function () {
	if (this.isAudioOn()) {
		try {
			this.audio.changeVolume(0);
		}
		catch (e) {}
		this.stopEmulator |= 0x2;
	}
}
GameBoyAdvanceEmulator.prototype.writeAudioToBuffer = function () {
	if (this.isAudioOn()) {
		try {
			this.audio.writeAudioNoCallback(this.audioCurrentBuffer);
		}
		catch (e) {
			this.stopEmulator |= 0x2;
		}
	}
}
GameBoyCore.prototype.audioUnderrunAdjustment = function () {
	if (this.isAudioOn()) {
		var underrunAmount = this.audioBufferContainAmount - this.audio.remainingBuffer();
		if (underrunAmount > 0) {
			this.CPUCyclesTotal = this.CPUCyclesPerIteration + ((underrunAmount >> 1) * this.machineOut);
		}
	}
	else {
		this.CPUCyclesTotal = this.CPUCyclesPerIteration;
	}
}
GameBoyAdvanceEmulator.prototype.isAudioOn = function () {
	return (this.stopEmulator & 0x2) == 0;
}
GameBoyAdvanceEmulator.prototype.calculateTimings = function () {
	this.CPUCyclesTotal = this.CPUCyclesPerIteration = (0x1000000 / this.timerIntervalRate) | 0;
	this.sampleSize = 0x40000 / 1000 * this.timerIntervalRate;
	this.samplesOut = this.sampleSize / this.CPUCyclesPerIteration;
	this.machineOut = 1 / this.samplesOut;	//Clocks per sample.
	this.audioBufferContainAmount = Math.max(this.sampleSize * this.audioBufferUnderrunLimit, 4096) << 1;
	this.audioNumSamplesTotal = this.sampleSize << 1;
	this.audioCurrentBuffer = getFloat32Array(this.audioNumSamplesTotal);
}
GameBoyAdvanceEmulator.prototype.changeCoreTimer = function (newTimerIntervalRate) {
	this.timerIntervalRate = Math.max(parseInt(newTimerIntervalRate), 1);
	this.calculateTimings();
	if ((this.stopEmulator & 0x8) == 0) {	//Set up the timer again if running.
		this.clearTimer();
		this.startTimer();
	}
	if (this.isAudioOn()) {					//Set up the audio again if enabled.
		this.disableAudio();
		this.enableAudio();
	}
}