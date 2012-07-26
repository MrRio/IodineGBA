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
function GameBoyAdvanceOBJRenderer(gfx) {
	this.gfx = gfx;
	this.initialize();
}
GameBoyAdvanceOBJRenderer.prototype.lookupYSize = [
	//Square:
	8,  16, 32, 64,
	//Vertical Rectangle:
	16, 32, 32, 64,
	//Horizontal Rectangle:
	8,   8, 16, 32
];
GameBoyAdvanceOBJRenderer.prototype.lookupXSize = [
	//Square:
	8,  16, 32, 64,
	//Vertical Rectangle:
	8,   8, 16, 32,
	//Horizontal Rectangle:
	16, 32, 32, 64
];
GameBoyAdvanceOBJRenderer.prototype.initialize = function (line) {
	this.scratchBuffer = getInt32Array(240);
	this.scratchWindowBuffer = getInt32Array(240);
	this.scratchOBJBuffer = getInt32Array(128);
}
GameBoyAdvanceOBJRenderer.prototype.renderScanLine = function (line) {
	this.clearScratch();
	for (var objNumber = 0; objNumber < 128; ++objNumber) {
		this.renderSprite(line, this.gfx.OAMTable[objNumber]);
	}
	return this.scratchBuffer;
}
GameBoyAdvanceOBJRenderer.prototype.clearScratch = function () {
	for (var position = 0; position < 240; ++position) {
		this.scratchBuffer[position] = this.gfx.transparency;
	}
}
GameBoyAdvanceOBJRenderer.prototype.renderWindowScanLine = function (line) {
	this.clearWindowScratch();
	for (var objNumber = 0; objNumber < 128; ++objNumber) {
		this.renderWindowSprite(line, this.gfx.OAMTable[objNumber]);
	}
	return this.scratchWindowBuffer;
}
GameBoyAdvanceOBJRenderer.prototype.clearWindowScratch = function () {
	for (var position = 0; position < 240; ++position) {
		this.scratchBuffer[position] = this.gfx.transparency;
	}
}
GameBoyAdvanceOBJRenderer.prototype.renderSprite = function (line, sprite) {
	if (this.isDrawable(sprite, false)) {
		if (sprite.mosaic) {
			//Correct line number for mosaic:
			line -= this.gfx.mosaicRenderer.getOBJMosaicYOffset(line);
		}
		//Obtain vertical size info:
		var ySize = this.lookupYSize[(sprite.shape << 2) | sprite.size] << ((sprite.doubleSizeOrDisabled) ? 1 : 0);
		var ycoord = sprite.ycoord - ((sprite.matrix2D) ? (ySize >> 1) : 0);
		var yOffset = line + ySize - ycoord;
		//Simulate y-coord wrap around logic:
		if (ycoord > (0x100 - ySize)) {
			yOffset += 0x100;
		}
		//Make a sprite line:
		if ((yOffset & --ySize) == yOffset) {
			//Obtain horizontal size info:
			var xSize = this.lookupXSize[(sprite.shape << 2) | sprite.size] << ((sprite.doubleSizeOrDisabled) ? 1 : 0);
			if (sprite.matrix2D) {
				//Scale & Rotation:
				this.renderMatrixSprite(sprite, xSize, ySize + 1, yOffset);
			}
			else {
				//Regular Scrolling:
				this.renderNormalSprite(sprite, xSize, ySize, yOffset);
			}
			//Mark for semi-transparent:
			if (sprite.mode == 1) {
				this.markSemiTransparent(xSize);
			}
			//Copy OBJ scratch buffer to scratch line buffer:
			this.outputSpriteToScratch(sprite, xSize);
		}
	}
}
GameBoyAdvanceOBJRenderer.prototype.renderWindowSprite = function (line, sprite) {
	if (this.isDrawable(sprite, true)) {
		if (sprite.mosaic) {
			//Correct line number for mosaic:
			line -= this.gfx.mosaicRenderer.getOBJMosaicYOffset(line);
		}
		//Obtain vertical size info:
		var ySize = this.lookupYSize[(sprite.shape << 2) | sprite.size] << ((sprite.doubleSizeOrDisabled) ? 1 : 0);
		var ycoord = sprite.ycoord - ((sprite.matrix2D) ? (ySize >> 1) : 0);
		var yOffset = line + ySize - ycoord;
		//Simulate y-coord wrap around logic:
		if (ycoord > (0x100 - ySize)) {
			yOffset += 0x100;
		}
		//Make a sprite line:
		if ((yOffset & --ySize) == yOffset) {
			//Obtain horizontal size info:
			var xSize = this.lookupXSize[(sprite.shape << 2) | sprite.size] << ((sprite.doubleSizeOrDisabled) ? 1 : 0);
			if (sprite.matrix2D) {
				//Scale & Rotation:
				this.renderMatrixSprite(sprite, xSize, ySize + 1, yOffset);
			}
			else {
				//Regular Scrolling:
				this.renderNormalSprite(sprite, xSize, ySize, yOffset);
			}
			//Copy OBJ scratch buffer to scratch line buffer:
			this.outputSpriteToWindowScratch(sprite, xSize);
		}
	}
}
GameBoyAdvanceOBJRenderer.prototype.renderMatrixSprite = function (sprite, xSize, ySize, yOffset) {
	var yDiffFromCenter = yOffset - (ySize >> 1);
	var params = this.OBJMatrixParameters[sprite.matrixParameters];
	var pa = -params[0] * (xSize >> 1);
	var pb = params[1] * yDiffFromCenter;
	var pc = -params[2] * (xSize >> 1);
	var pd = params[3] * yDiffFromCenter;
	var x = 0;
	var y = 0;
	var tileNumber = sprite.tileNumber;
	for (var position = 0; position < xSize; ++position) {
		//Find (X, Y):
		x = pa + pb;
		y = pc + pd;
		if (x < xSize && y < ySize) {
			//Coordinates in range, fetch pixel:
			this.scratchOBJBuffer[position] = this.fetchMatrixPixel(tileNumber, x | 0, y | 0, xSize);
		}
		else {
			//Coordinates outside of range, transparency defaulted:
			this.scratchOBJBuffer[position] = this.gfx.transparency;
		}
		//Increment PA & PC for each X:
		pa += params;
		pc += params;
	}
}
GameBoyAdvanceOBJRenderer.prototype.fetchMatrixPixel = function (tileNumber, x, y, xSize) {
	if (!this.gfx.VRAMOneDimensional) {
		//2D Mapping (32 8x8 tiles by 32 8x8 tiles):
		if (sprite.monolithicPalette) {
			//Hardware ignores the LSB in this case:
			tileNumber &= -2;
		}
		tileNumber += (y >> 3) * 0x20;
	}
	else {
		//1D Mapping:
		tileNumber += (y >> 3) * (xSize >> 3);
	}
	//Starting address of currently drawing sprite line:
	var address = tileNumber << 5;
	if (sprite.monolithicPalette) {
		//256 Colors / 1 Palette:
		address += ((y & 7) << 3) + x;
		return this.gfx.paletteOBJ256[this.gfx.VRAM[address]];
	}
	else {
		//16 Colors / 16 palettes:
		address += (((y & 7) << 3) + x) >> 1;
		if ((x & 0x1) == 0x1) {
			return this.gfx.paletteOBJ16[sprite.paletteNumber][this.gfx.VRAM[address] & 0xF];
		}
		else {
			return this.gfx.paletteOBJ16[sprite.paletteNumber][this.gfx.VRAM[address] >> 4];
		}
	}
}
GameBoyAdvanceOBJRenderer.prototype.renderNormalSprite = function (sprite, xSize, ySize, yOffset) {
	if (sprite.verticalFlip) {
		//Flip y-coordinate offset:
		yOffset = ySize - yOffset;
	}
	var tileNumber = sprite.tileNumber;
	if (!this.gfx.VRAMOneDimensional) {
		//2D Mapping (32 8x8 tiles by 32 8x8 tiles):
		if (sprite.monolithicPalette) {
			//Hardware ignores the LSB in this case:
			tileNumber &= -2;
		}
		tileNumber += (yOffset >> 3) * 0x20;
	}
	else {
		//1D Mapping:
		tileNumber += (yOffset >> 3) * (xSize >> 3);
	}
	//Starting address of currently drawing sprite line:
	var address = tileNumber << 5;
	var vram = this.gfx.VRAM;
	var objBufferPosition = 0;
	if (sprite.monolithicPalette) {
		//256 Colors / 1 Palette:
		address += (yOffset & 7) << 3;
		var palette = this.gfx.paletteOBJ256;
		while (objBufferPosition < xSize) {
			this.scratchOBJBuffer[objBufferPosition++] = palette[vram[address++]];
			this.scratchOBJBuffer[objBufferPosition++] = palette[vram[address++]];
			this.scratchOBJBuffer[objBufferPosition++] = palette[vram[address++]];
			this.scratchOBJBuffer[objBufferPosition++] = palette[vram[address++]];
			this.scratchOBJBuffer[objBufferPosition++] = palette[vram[address++]];
			this.scratchOBJBuffer[objBufferPosition++] = palette[vram[address++]];
			this.scratchOBJBuffer[objBufferPosition++] = palette[vram[address++]];
			this.scratchOBJBuffer[objBufferPosition++] = palette[vram[address]];
			address += 0x39;
		}
	}
	else {
		//16 Colors / 16 palettes:
		address += (yOffset & 7) << 2;
		var palette = this.gfx.paletteOBJ16[sprite.paletteNumber];
		while (objBufferPosition < xSize) {
			data = vram[address++];
			this.scratchOBJBuffer[objBufferPosition++] = palette[data >> 4];
			this.scratchOBJBuffer[objBufferPosition++] = palette[data & 0xF];
			data = vram[address++];
			this.scratchOBJBuffer[objBufferPosition++] = palette[data >> 4];
			this.scratchOBJBuffer[objBufferPosition++] = palette[data & 0xF];
			data = vram[address++];
			this.scratchOBJBuffer[objBufferPosition++] = palette[data >> 4];
			this.scratchOBJBuffer[objBufferPosition++] = palette[data & 0xF];
			data = vram[address];
			this.scratchOBJBuffer[objBufferPosition++] = palette[data >> 4];
			this.scratchOBJBuffer[objBufferPosition++] = palette[data & 0xF];
			address += 0x1D;
		}
	}
}
GameBoyAdvanceOBJRenderer.prototype.markSemiTransparent = function (xSize) {
	//Mark sprite pixels as semi-transparent:
	while (--xSize > -1) {
		this.scratchOBJBuffer[xSize] |= 0x200000;
	}
}
GameBoyAdvanceOBJRenderer.prototype.outputSpriteToScratch = function (sprite, xSize) {
	//Simulate x-coord wrap around logic:
	var xcoord = sprite.xcoord - ((sprite.matrix2D) ? (xSize >> 1) : 0);
	if (xcoord > (0x200 - xSize)) {
		xcoord -= 0x200;
	}
	//Resolve end point:
	var xcoordEnd = Math.min(xcoord + xSize, 240);
	//Flag for compositor to ID the pixels as OBJ:
	var bitFlags = (sprite.priority << 22) | 0x80000;
	if (!sprite.horizontalFlip || sprite.matrix2D) {
		//Normal:
		for (var xSource = 0; xcoord < xcoordEnd; ++xcoord, ++xSource) {
			//Only overwrite transparency:
			if (xcoord > -1 && (this.scratchBuffer[xcoord] & 0x1000000) == 0x1000000) {
				this.scratchBuffer[xcoord] = bitFlags | this.scratchOBJBuffer[xSource];
			}
		}
	}
	else {
		//Flipped Horizontally:
		for (var xSource = xSize; xcoord < xcoordEnd; ++xcoord, --xSource) {
			//Only overwrite transparency:
			if (xcoord > -1 && (this.scratchBuffer[xcoord] & 0x1000000) == 0x1000000) {
				this.scratchBuffer[xcoord] = bitFlags | this.scratchOBJBuffer[xSource];
			}
		}
	}
	if (sprite.mosaic) {
		this.gfx.mosaicRenderer.renderOBJMosaicHorizontal(this.scratchBuffer, xcoord, xcoordEnd);
	}
}
GameBoyAdvanceOBJRenderer.prototype.outputSpriteToWindowScratch = function (sprite, xSize) {
	//Simulate x-coord wrap around logic:
	var xcoord = sprite.xcoord - ((sprite.matrix2D) ? (xSize >> 1) : 0);
	if (xcoord > (0x200 - xSize)) {
		xcoord -= 0x200;
	}
	//Resolve end point:
	var xcoordEnd = Math.min(xcoord + xSize, 240);
	//Flag for compositor to ID the pixels as OBJ:
	var bitFlags = (sprite.priority << 22) | 0x80000;
	if (!sprite.horizontalFlip || sprite.matrix2D) {
		//Normal:
		for (var xSource = 0; xcoord < xcoordEnd; ++xcoord, ++xSource) {
			//Only overwrite transparency:
			if (xcoord > -1 && (this.scratchWindowBuffer[xcoord] & 0x1000000) == 0x1000000) {
				this.scratchWindowBuffer[xcoord] = bitFlags | this.scratchOBJBuffer[xSource];
			}
		}
	}
	else {
		//Flipped Horizontally:
		for (var xSource = xSize; xcoord < xcoordEnd; ++xcoord, --xSource) {
			//Only overwrite transparency:
			if (xcoord > -1 && (this.scratchWindowBuffer[xcoord] & 0x1000000) == 0x1000000) {
				this.scratchWindowBuffer[xcoord] = bitFlags | this.scratchOBJBuffer[xSource];
			}
		}
	}
	if (sprite.mosaic) {
		this.gfx.mosaicRenderer.renderOBJMosaicHorizontal(this.scratchWindowBuffer, xcoord, xcoordEnd);
	}
}
GameBoyAdvanceOBJRenderer.prototype.isDrawable = function (sprite, doWindowOBJ) {
	//Make sure we pass some checks that real hardware does:
	if ((sprite.mode < 2 && !doWindowOBJ) || (doWindowOBJ && sprite.mode == 2)) {
		if (!sprite.doubleSizeOrDisabled || sprite.matrix2D) {
			if (sprite.shape < 3) {
				if (this.gfx.BGMode < 3 || sprite.tileNumber >= 0x200) {
					return true;
				}
			}
		}
	}
	return false;
}