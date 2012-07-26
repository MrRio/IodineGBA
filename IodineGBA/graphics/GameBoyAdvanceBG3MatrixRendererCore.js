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
function GameBoyAdvanceBG3MatrixRenderer(gfx) {
	this.gfx = gfx;
	this.initialize();
}
GameBoyAdvanceBG3MatrixRenderer.prototype.tileMapSize = [
	0x80,
	0x100,
	0x200,
	0x400
];
GameBoyAdvanceBG3MatrixRenderer.prototype.initialize = function () {
	this.scratchBuffer = getInt32Array(240);
	this.pb = 0;
	this.pd = 0;
	this.shadowPB = 0;
	this.shadowPD = 0;
	this.preprocess();
}
GameBoyAdvanceBG3MatrixRenderer.prototype.renderScanLine = function (line) {
	if (this.gfx.BG3Mosaic) {
		//Correct line number for mosaic:
		this.shadowPB = this.pb;
		this.shadowPD = this.pd;
		this.pb -= this.gfx.actualBG3dmx * this.gfx.mosaicRenderer.getMosaicYOffset(line);
		this.pd -= this.gfx.actualBG3dmy * this.gfx.mosaicRenderer.getMosaicYOffset(line);
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
		pa += this.gfx.actualBG3dx;
		pc += this.gfx.actualBG3dy;
	}
	if (this.gfx.BG3Mosaic) {
		//Pixelize the line horizontally:
		this.pb = this.shadowPB;
		this.pd = this.shadowPD;
		this.gfx.mosaicRenderer.renderMosaicHorizontal(this.scratchBuffer);
	}
	this.incrementReferenceCounters();
	return this.scratchBuffer;
}
GameBoyAdvanceBG3MatrixRenderer.prototype.incrementReferenceCounters = function () {
	this.pb += this.gfx.actualBG3dmx;
	this.pd += this.gfx.actualBG3dmy;
}
GameBoyAdvanceBG3MatrixRenderer.prototype.resetReferenceCounters = function () {
	this.pb = this.gfx.actualBG3ReferenceY;
	this.pd = this.gfx.actualBG3ReferenceY;
}
GameBoyAdvanceBG3MatrixRenderer.prototype.fetchTile = function (tileNumber) {
	//Find the tile code to locate the tile block:
	return this.gfx.VRAM[(tileNumber | (this.BG3ScreenBaseBlock << 11)) & 0xFFFF];
}
GameBoyAdvanceBG3MatrixRenderer.prototype.fetchPixel = function (x, y) {
	//Output pixel:
	if (x > this.mapSizeComparer || y > this.mapSizeComparer) {
		//Overflow Handling:
		if (this.gfx.BG3DisplayOverflow) {
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
GameBoyAdvanceBG3MatrixRenderer.prototype.preprocess = function () {
	this.priorityFlag = (this.gfx.BG3Priority << 22) | 0x20000;
	this.mapSize = this.tileMapSize[this.gfx.BG3ScreenSize];
	this.mapSizeComparer = this.mapSize - 1;
	this.baseBlockOffset = this.gfx.BG3CharacterBaseBlock << 14;
}