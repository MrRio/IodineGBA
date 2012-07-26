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
function GameBoyAdvanceBG2MatrixRenderer(gfx) {
	this.gfx = gfx;
	this.initialize();
}
GameBoyAdvanceBG2MatrixRenderer.prototype.tileMapSize = [
	0x80,
	0x100,
	0x200,
	0x400
];
GameBoyAdvanceBG2MatrixRenderer.prototype.initialize = function () {
	this.scratchBuffer = getInt32Array(240);
	this.pb = 0;
	this.pd = 0;
	this.shadowPB = 0;
	this.shadowPD = 0;
	this.preprocess();
}
GameBoyAdvanceBG2MatrixRenderer.prototype.renderScanLine = function (line) {
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
GameBoyAdvanceBG2MatrixRenderer.prototype.incrementReferenceCounters = function () {
	this.pb += this.gfx.actualBG2dmx;
	this.pd += this.gfx.actualBG2dmy;
}
GameBoyAdvanceBG2MatrixRenderer.prototype.resetReferenceCounters = function () {
	this.pb = this.gfx.actualBG2ReferenceY;
	this.pd = this.gfx.actualBG2ReferenceY;
}
GameBoyAdvanceBG2MatrixRenderer.prototype.fetchTile = function (tileNumber) {
	//Find the tile code to locate the tile block:
	return this.gfx.VRAM[(tileNumber | (this.BG2ScreenBaseBlock << 11)) & 0xFFFF];
}
GameBoyAdvanceBG2MatrixRenderer.prototype.fetchPixel = function (x, y) {
	//Output pixel:
	if (x > this.mapSizeComparer || y > this.mapSizeComparer) {
		//Overflow Handling:
		if (this.gfx.BG2DisplayOverflow) {
			x &= this.mapSizeComparer;
			y &= this.mapSizeComparer;
		}
		else {
			return this.gfx.transparency;
		}
	}
	var address = this.fetchTile((x >> 3) + ((y >> 3) * this.mapSize)) << 6;
	address += this.baseBlockOffset;
	address += (y & 0x7) << 3;
	address += x & 0x7;
	return this.gfx.palette256[this.gfx.VRAM[address]];
}
GameBoyAdvanceBG2MatrixRenderer.prototype.preprocess = function () {
	this.priorityFlag = (this.gfx.BG2Priority << 22) | 0x20000;
	this.mapSize = this.tileMapSize[this.gfx.BG2ScreenSize];
	this.mapSizeComparer = this.mapSize - 1;
	this.baseBlockOffset = this.gfx.BG2CharacterBaseBlock << 14;
}