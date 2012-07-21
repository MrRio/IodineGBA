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
function GameBoyAdvanceBG2FrameBufferRenderer(gfx) {
	this.gfx = gfx;
	this.initialize();
}
GameBoyAdvanceBG2FrameBufferRenderer.prototype.tileMapSize = [
	0x80,
	0x100,
	0x200,
	0x400
];
GameBoyAdvanceBG2FrameBufferRenderer.prototype.initialize = function () {
	this.scratchBuffer = getInt32Array(240);
	this.referenceYDMXCounter = 0;
	this.referenceYDMYCounter = 0;
	this.shadowReferenceYDMXCounter = 0;
	this.shadowReferenceYDMYCounter = 0;
	this.fetchPixel = this.fetchMode3Pixel;
	this.preprocess();
}
GameBoyAdvanceBG2FrameBufferRenderer.prototype.selectMode = function (mode) {
	switch (mode) {
		case 3:
			this.fetchPixel = this.fetchMode3Pixel;
			break;
		case 4:
			this.fetchPixel = this.fetchMode4Pixel;
			break;
		case 5:
			this.fetchPixel = this.fetchMode5Pixel;
	}
}
GameBoyAdvanceBG2FrameBufferRenderer.prototype.renderModeScanLine = function (line) {
	if (this.gfx.BG2Mosaic) {
		//Correct line number for mosaic:
		this.shadowReferenceYDMXCounter = this.referenceYDMXCounter;
		this.shadowReferenceYDMYCounter = this.referenceYDMYCounter;
		this.referenceYDMXCounter -= this.gfx.actualBG2dmx * this.gfx.mosaicRenderer.getMosaicYOffset(line);
		this.referenceYDMYCounter -= this.gfx.actualBG2dmy * this.gfx.mosaicRenderer.getMosaicYOffset(line);
	}
	var x = 0;
	var y = 0;
	var referenceXDMXCounter = (this.gfx.actualBG2dx * -this.gfx.actualBG2ReferenceX) + this.gfx.actualBG2ReferenceX;
	var referenceXDMYCounter = (this.gfx.actualBG2dy * -this.gfx.actualBG2ReferenceX) + this.gfx.actualBG2ReferenceY;
	for (var position = 0; position < 240; ++position) {
		x = referenceXDMXCounter + this.referenceYDMXCounter;
		y = referenceXDMYCounter + this.referenceYDMYCounter;
		referenceXDMXCounter += this.gfx.actualBG2dx;
		referenceXDMYCounter += this.gfx.actualBG2dy;
		this.scratchBuffer[position] = this.priorityFlag | this.fetchPixel(x, y);
	}
	if (this.gfx.BG2Mosaic) {
		//Pixelize the line horizontally:
		this.referenceYDMXCounter = this.shadowReferenceYDMXCounter;
		this.referenceYDMYCounter = this.shadowReferenceYDMYCounter;
		this.gfx.mosaicRenderer.renderMosaicHorizontal(this.scratchBuffer);
	}
	this.incrementReferenceCounters();
	return this.scratchBuffer;
}
GameBoyAdvanceBG2FrameBufferRenderer.prototype.incrementReferenceCounters = function () {
	this.referenceYDMXCounter += this.gfx.actualBG2dmx;
	this.referenceYDMYCounter += this.gfx.actualBG2dmy;
}
GameBoyAdvanceBG2FrameBufferRenderer.prototype.resetReferenceCounters = function () {
	this.referenceYDMXCounter = this.gfx.actualBG2dmx * -this.gfx.actualBG2ReferenceY;
	this.referenceYDMYCounter = this.gfx.actualBG2dmy * -this.gfx.actualBG2ReferenceY;
}
GameBoyAdvanceBG2FrameBufferRenderer.prototype.fetchTile = function (tileNumber) {
	//Find the tile code to locate the tile block:
	return this.gfx.VRAM[(tileNumber | (this.BG2ScreenBaseBlock << 11)) & 0xFFFF];
}
GameBoyAdvanceBG2FrameBufferRenderer.prototype.fetchMode3Pixel = function (x, y) {
	//Output pixel:
	if (x > 239 || y > 159) {
		return this.gfx.palette256[0];
	}
	address = this.gfx.frameSelect | (y * 480) | (x << 1);
	return this.gfx.VRAM[address | 1] | this.gfx.VRAM[address];
}
GameBoyAdvanceBG2FrameBufferRenderer.prototype.fetchMode4Pixel = function (x, y) {
	//Output pixel:
	if (x > 239 || y > 159) {
		return this.gfx.palette256[0];
	}
	return this.gfx.palette256[this.gfx.VRAM[(y * 240) | x]];
}
GameBoyAdvanceBG2FrameBufferRenderer.prototype.fetchMode5Pixel = function (x, y) {
	//Output pixel:
	if (x > 159 || y > 127) {
		return this.gfx.palette256[0];
	}
	address = this.gfx.frameSelect | (y * 480) | (x << 1);
	return this.gfx.VRAM[address | 1] | this.gfx.VRAM[address];
}
GameBoyAdvanceBG2FrameBufferRenderer.prototype.preprocess = function () {
	this.priorityFlag = (this.gfx.BG2Priority << 21) | 0x20000;
	this.mapSize = this.tileMapSize[this.gfx.BG2ScreenSize];
	this.mapSizeComparer = this.mapSize - 1;
	this.baseBlockOffset = this.gfx.BG2CharacterBaseBlock << 14;
}