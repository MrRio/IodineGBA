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
	this.pb = 0;
	this.pd = 0;
	this.shadowPB = 0;
	this.shadowPD = 0;
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
		this.shadowPB = this.pb;
		this.shadowPD = this.pd;
		this.pb -= this.gfx.actualBG2dmx * this.gfx.mosaicRenderer.getMosaicYOffset(line);
		this.pd -= this.gfx.actualBG2dmy * this.gfx.mosaicRenderer.getMosaicYOffset(line);
	}
	var x = 0;
	var y = 0;
	var pa = 0;
	var pc = 0;
	for (var position = 0; position < 240; ++position) {
		//Find (X, Y):
		x = pa + this.pb;
		y = pc + this.pd;
		//Fetch pixel:
		this.scratchBuffer[position] = this.priorityFlag | this.fetchPixel(x | 0, y | 0);
		//Increment PA & PC for each X:
		pa += this.gfx.actualBG2dx;
		pc += this.gfx.actualBG2dy;
	}
	if (this.gfx.BG2Mosaic) {
		//Pixelize the line horizontally:
		this.pb = this.shadowPB;
		this.pd = this.shadowPD;
		this.gfx.mosaicRenderer.renderMosaicHorizontal(this.scratchBuffer);
	}
	this.incrementReferenceCounters();
	return this.scratchBuffer;
}
GameBoyAdvanceBG2FrameBufferRenderer.prototype.incrementReferenceCounters = function () {
	this.pb += this.gfx.actualBG2dmx;
	this.pd += this.gfx.actualBG2dmy;
}
GameBoyAdvanceBG2FrameBufferRenderer.prototype.resetReferenceCounters = function () {
	this.pb = this.gfx.actualBG2ReferenceY;
	this.pd = this.gfx.actualBG2ReferenceY;
}
GameBoyAdvanceBG2FrameBufferRenderer.prototype.fetchTile = function (tileNumber) {
	//Find the tile code to locate the tile block:
	return this.gfx.VRAM[(tileNumber | (this.BG2ScreenBaseBlock << 11)) & 0xFFFF];
}
GameBoyAdvanceBG2FrameBufferRenderer.prototype.fetchMode3Pixel = function (x, y) {
	//Output pixel:
	if (x > 239 || y > 159) {
		return this.gfx.transparency;
	}
	address = this.gfx.frameSelect | (y * 480) | (x << 1);
	return this.gfx.VRAM[address | 1] | this.gfx.VRAM[address];
}
GameBoyAdvanceBG2FrameBufferRenderer.prototype.fetchMode4Pixel = function (x, y) {
	//Output pixel:
	if (x > 239 || y > 159) {
		return this.gfx.transparency;
	}
	return this.gfx.palette256[this.gfx.VRAM[(y * 240) | x]];
}
GameBoyAdvanceBG2FrameBufferRenderer.prototype.fetchMode5Pixel = function (x, y) {
	//Output pixel:
	if (x > 159 || y > 127) {
		return this.gfx.transparency;
	}
	address = this.gfx.frameSelect | (y * 480) | (x << 1);
	return this.gfx.VRAM[address | 1] | this.gfx.VRAM[address];
}
GameBoyAdvanceBG2FrameBufferRenderer.prototype.preprocess = function () {
	this.priorityFlag = (this.gfx.BG2Priority << 22) | 0x20000;
}