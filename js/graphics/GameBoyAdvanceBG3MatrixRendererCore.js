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
	this.referenceYDMXCounter = 0;
	this.referenceYDMYCounter = 0;
	this.preprocess();
}
GameBoyAdvanceBG3MatrixRenderer.prototype.renderScanLine = function (line) {
	var x = 0;
	var y = 0;
	var referenceXDMXCounter = (this.gfx.actualBG3dx * -this.gfx.actualBG3ReferenceX) + this.gfx.actualBG3ReferenceX;
	var referenceXDMYCounter = (this.gfx.actualBG3dy * -this.gfx.actualBG3ReferenceX) + this.gfx.actualBG3ReferenceY;
	for (var position = 0; position < 240; ++position) {
		x = referenceXDMXCounter + this.referenceYDMXCounter;
		y = referenceXDMYCounter + this.referenceYDMYCounter;
		referenceXDMXCounter += this.gfx.actualBG3dx;
		referenceXDMYCounter += this.gfx.actualBG3dy;
		this.scratchBuffer[position] = this.priorityFlag | this.fetchPixel(x, y);
	}
	this.incrementReferenceCounters();
}
GameBoyAdvanceBG3MatrixRenderer.prototype.incrementReferenceCounters = function () {
	this.referenceYDMXCounter += this.gfx.actualBG3dmx;
	this.referenceYDMYCounter += this.gfx.actualBG3dmy;
}
GameBoyAdvanceBG3MatrixRenderer.prototype.resetReferenceCounters = function () {
	this.referenceYDMXCounter = this.gfx.actualBG3dmx * -this.gfx.actualBG3ReferenceY;
	this.referenceYDMYCounter = this.gfx.actualBG3dmy * -this.gfx.actualBG3ReferenceY;
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
			return this.gfx.palette256[0];
		}
	}
	var address = this.fetchTile((x >> 3) + ((y >> 3) * this.mapSize)) << 6;
	address += this.baseBlockOffset;
	address += (y & 0x7) << 3;
	address += x & 0x7;
	return this.gfx.palette256[this.gfx.VRAM[address]];
}
GameBoyAdvanceBG3MatrixRenderer.prototype.preprocess = function () {
	this.priorityFlag = (this.gfx.BG3Priority << 21) | 0x40000;
	this.mapSize = this.tileMapSize[this.gfx.BG3ScreenSize];
	this.mapSizeComparer = this.mapSize - 1;
	this.baseBlockOffset = this.gfx.BG3CharacterBaseBlock << 14;
}