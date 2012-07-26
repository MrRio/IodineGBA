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
function GameBoyAdvanceMosaicRenderer(gfx) {
	this.gfx = gfx;
}
GameBoyAdvanceMosaicRenderer.prototype.renderMosaicHorizontal = function (layer) {
	var currentPixel = 0;
	var mosaicBlur = this.gfx.BGMosaicHSize + 1;
	if (mosaicBlur > 1) {	//Don't perform a useless loop.
		for (var position = 0; position < 240; ++position) {
			if ((position % mosaicBlur) == 0) {
				currentPixel = layer[position];
			}
			else {
				layer[position] = currentPixel;
			}
		}
	}
}
GameBoyAdvanceMosaicRenderer.prototype.renderOBJMosaicHorizontal = function (layer, xSize) {
	var currentPixel = this.gfx.transparency;
	var mosaicBlur = this.gfx.OBJMosaicHSize + 1;
	if (mosaicBlur > 1) {	//Don't perform a useless loop.
		for (var position = 0; position < xSize; ++position) {
			//Properly emulate OBJ mosaic glitching on first pixel (Never a non-transparent).
			layer[position] = currentPixel;
			if ((position % mosaicBlur) == 0) {
				currentPixel = layer[position];
			}
		}
	}
}
GameBoyAdvanceMosaicRenderer.prototype.getMosaicYOffset = function (line) {
	return line % (this.gfx.BGMosaicVSize + 1);
}
GameBoyAdvanceMosaicRenderer.prototype.getOBJMosaicYOffset = function (line) {
	return line % (this.gfx.OBJMosaicVSize + 1);
}