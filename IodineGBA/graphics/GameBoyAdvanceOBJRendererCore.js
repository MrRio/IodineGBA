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
GameBoyAdvanceOBJRenderer.prototype.renderSprite = function (line, sprite) {
	if (this.isDrawable(sprite)) {
		if (sprite.mosaic) {
			//Correct line number for mosaic:
			line -= this.gfx.mosaicRenderer.getOBJMosaicYOffset(line);
		}
		//Obtain vertical size info:
		var ySize = this.lookupYSize[(sprite.shape << 2) | sprite.size] << ((sprite.doubleSizeOrDisabled) ? 1 : 0);
		var yOffset = line + ySize - sprite.ycoord - ((ySize < 128) ? 0 : 0x100);
		//Make a sprite line:
		if ((yOffset & --ySize) == yOffset) {
			//Obtain horizontal size info::
			var xSize = this.lookupXSize[(sprite.shape << 2) | sprite.size] << ((sprite.doubleSizeOrDisabled) ? 1 : 0);
			if (sprite.matrix2D) {
				//Scale & Rotation:
				this.renderMatrixSprite(sprite, xSize, ySize, yOffset);
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
			this.outputSpriteToScratch(sprite, sprite.xcoord, xSize);
		}
	}
}
GameBoyAdvanceOBJRenderer.prototype.renderNormalSprite = function (sprite, xSize, ySize, yOffset) {
	if (sprite.verticalFlip) {
		//Flip y-coordinate offset:
		yOffset = ySize - yOffset;
	}
	var tileNumber = sprite.tileNumber;
	if (!this.VRAMOneDimensional) {
		//2D Mapping (32 8x8 tiles by 32 8x8 tiles):
		if (sprite.monolithicPalette) {
			//Hardware ignores the LSB in this case:
			tileNumber &= -2;
		}
		tileNumber += (yOffset >> 3) * 0x20;
	}
	else {
		//1D Mapping:
		tileNumber += (yOffset >> 3) * xSize;
	}
	//Starting address of currently drawing sprite line:
	var address = tileNumber << 5;
	var vram = this.gfx.VRAM;
	var objBufferPosition = 0;
	if (sprite.monolithicPalette) {
		//256 Colors / 1 Palette:
		address += (yOffset & 7) << 3;
		var palette = this.gfx.paletteOBJ256;
		while (--xSize > -1) {
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
		while (--xSize > -1) {
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
GameBoyAdvanceOBJRenderer.prototype.outputSpriteToScratch = function (sprite, xcoord, xSize) {
	var xcoordEnd = Math.min(xcoord + xSize, 240);
	if (sprite.mosaic) {
		renderOBJMosaicHorizontal(this.scratchBuffer, xcoord, xcoordEnd);
	}
	var bitFlags = (sprite.priority << 22) | 0x80000;
	if (!sprite.horizontalFlip || sprite.matrix2D) {
		//Normal:
		for (var xSource = 0; xcoord < xcoordEnd; ++xcoord) {
			//Only overwrite transparency:
			if ((this.scratchBuffer[xcoord] & 0x1000000) == 0x1000000) {
				this.scratchBuffer[xcoord] = bitFlags | this.scratchOBJBuffer[xSource++];
			}
		}
	}
	else {
		//Flipped Horizontally:
		for (var xSource = xSize; xcoord < xcoordEnd; ++xcoord) {
			//Only overwrite transparency:
			if ((this.scratchBuffer[xcoord] & 0x1000000) == 0x1000000) {
				this.scratchBuffer[xcoordEnd] = bitFlags | this.scratchOBJBuffer[--xSource];
			}
		}
	}
}
GameBoyAdvanceOBJRenderer.prototype.isDrawable = function (sprite) {
	//Make sure we pass some checks that real hardware does:
	if (sprite.mode < 2) {
		if (!sprite.doubleSizeOrDisabled || sprite.matrix2D) {
			if (sprite.shape < 3) {
				if (sprite.xcoord < 240) {
					if (this.gfx.BGMode < 3 || sprite.tileNumber >= 0x200) {
						return true;
					}
				}
			}
		}
	}
	return false;
}