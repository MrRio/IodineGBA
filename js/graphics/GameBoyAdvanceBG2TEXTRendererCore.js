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
function GameBoyAdvanceBG2TEXTRenderer(gfx) {
	this.gfx = gfx;
	this.initialize();
}
GameBoyAdvanceBG2TEXTRenderer.prototype.tileMapMask = [
	0,
	0x20,
	0x800,
	0x820
];
GameBoyAdvanceBG2TEXTRenderer.prototype.initialize = function (line) {
	this.scratchBuffer = getInt32Array(248);
	this.tileMask = 0;
	this.priorityFlag = 0;
	this.baseBlockOffset = 0;
}
GameBoyAdvanceBG2TEXTRenderer.prototype.renderScanLine = function (line) {
	this.preprocess();
	var yTileOffset = (line + this.BG2YCoord) & 0x7;
	var pixelPipelinePosition = this.gfx.BG2XCoord & 0x7;
	var tileNumber = (((line + this.BG2YCoord) >> 3) << 6) | (this.gfx.BG2XCoord >> 3);
	for (var position = 0; position < 240;) {
		var chrData = this.fetchTile(tileNumber++);
		while (pixelPipelinePosition < 0x8) {
			this.scratchBuffer[position++] = this.priorityFlag | this.fetchVRAM(chrData, pixelPipelinePosition++, yTileOffset);
		}
		pixelPipelinePosition &= 0x7;
	}
}
GameBoyAdvanceBG2TEXTRenderer.prototype.fetchTile = function (tileNumber) {
	//Find the tile code to locate the tile block:
	tileNumber = this.computeScreenMapAddress(this.computeTileNumber(tileNumber));
	return (this.gfx.VRAM[tileNumber | 1] << 8) | this.gfx.VRAM[tileNumber];
}
GameBoyAdvanceBG2TEXTRenderer.prototype.computeTileNumber = function (tileNumber) {
	//Return the true tile number:
	var actualTile = tileNumber & 0x3FF;
	actualTile |= (tileNumber & this.tileMask & 0x20) << 5;
	actualTile += (tileNumber & this.tileMask & 0x800) >> 1;
	return actualTile;
}
GameBoyAdvanceBG2TEXTRenderer.prototype.computeScreenMapAddress = function (tileNumber) {
	return ((tileNumber << 1) | (this.BG2ScreenBaseBlock << 11)) & 0xFFFF;
}
GameBoyAdvanceBG2TEXTRenderer.prototype.fetch4BitVRAM = function (chrData, xOffset, yOffset) {
	//Parse flip attributes, grab palette, and then output pixel:
	var address = (chrData & 0x3FF) << 5;
	address += this.baseBlockOffset;
	address += (((chrData & 0x800) == 0x800) ? (0x7 - yOffset) : yOffset) << 2;
	address += (((chrData & 0x400) == 0x400) ? (0x7 - xOffset) : xOffset) >> 1;
	if ((xOffset & 0x1) != ((chrData & 0x400) >> 10)) {
		return this.palette[chrData >> 12][this.gfx.VRAM[address] & 0xF];
	}
	return this.palette[chrData >> 12][this.gfx.VRAM[address] >> 4];
}
GameBoyAdvanceBG2TEXTRenderer.prototype.fetch8BitVRAM = function (chrData, xOffset, yOffset) {
	//Parse flip attributes and output pixel:
	var address = (chrData & 0x3FF) << 6;
	address += this.baseBlockOffset;
	address += (((chrData & 0x800) == 0x800) ? (0x7 - yOffset) : yOffset) << 3;
	address += ((chrData & 0x400) == 0x400) ? (0x7 - xOffset) : xOffset;
	return this.palette[this.gfx.VRAM[address]];
}
GameBoyAdvanceBG2TEXTRenderer.prototype.preprocess = function () {
	if (this.gfx.BG2Palette256) {
		this.palette = this.gfx.palette256;
		this.fetchVRAM = this.fetch8BitVRAM;
	}
	else {
		this.palette = this.gfx.palette16;
		this.fetchVRAM = this.fetch4BitVRAM;
	}
	this.tileMask = this.tileMapMask[this.gfx.BG2ScreenSize];
	this.priorityFlag = (this.gfx.BG2Priority << 21) | 0x20000;
	this.baseBlockOffset = this.gfx.BG2CharacterBaseBlock << 14;
}