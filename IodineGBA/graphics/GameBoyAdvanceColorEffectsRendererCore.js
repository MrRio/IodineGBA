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
function GameBoyAdvanceColorEffectsRenderer(gfx) {
	this.gfx = gfx;
}
GameBoyAdvanceColorEffectsRenderer.prototype.processOAMSemiTransparent = function (lowerPixel, topPixel) {
	if ((lowerPixel & this.gfx.effectsTarget2) > 0) {
		return this.alphaBlend(topPixel, lowerPixel);
	}
	else if ((topPixel & this.gfx.effectsTarget1) > 0) {
		switch (this.gfx.colorEffectsType) {
			case 2:
				return this.brightnessIncrease(topPixel);
			case 3:
				return this.brightnessDecrease(topPixel);
		}
	}
	return topPixel;
}
GameBoyAdvanceColorEffectsRenderer.prototype.process = function (lowerPixel, topPixel) {
	if ((topPixel & this.gfx.effectsTarget1) > 0) {
		switch (this.gfx.colorEffectsType) {
			case 1:
				if ((lowerPixel & this.gfx.effectsTarget2) > 0) {
					return this.alphaBlend(topPixel, lowerPixel);
				}
				break;
			case 2:
				return this.brightnessIncrease(topPixel);
			case 3:
				return this.brightnessDecrease(topPixel);
		}
	}
	return topPixel;
}
GameBoyAdvanceColorEffectsRenderer.prototype.alphaBlend = function (topPixel, lowerPixel) {
	var b1 = topPixel >> 10;
	var g1 = (topPixel >> 5) & 0x1F;
	var r1 = (topPixel & 0x1F);
	var b2 = lowerPixel >> 10;
	var g2 = (lowerPixel >> 5) & 0x1F;
	var r2 = lowerPixel & 0x1F;
	b1 *= this.gfx.alphaBlendAmountTarget1;
	g1 *= this.gfx.alphaBlendAmountTarget1;
	r1 *= this.gfx.alphaBlendAmountTarget1;
	b2 *= this.gfx.alphaBlendAmountTarget2;
	g2 *= this.gfx.alphaBlendAmountTarget2;
	r2 *= this.gfx.alphaBlendAmountTarget2;
	return (Math.min(b1 + b2, 0x1F) << 10) | (Math.min(g1 + g2, 0x1F) << 5) | Math.min(r1 + r2, 0x1F);
}
GameBoyAdvanceColorEffectsRenderer.prototype.brightnessIncrease = function (topPixel) {
	var b1 = topPixel >> 10;
	var g1 = (topPixel >> 5) & 0x1F;
	var r1 = (topPixel & 0x1F);
	b1 += (0x1F - b1) * this.gfx.brightnessEffectAmount;
	g1 += (0x1F - g1) * this.gfx.brightnessEffectAmount;
	r1 += (0x1F - r1) * this.gfx.brightnessEffectAmount;
	return (b1 << 10) | (g1 << 5) | r1;
}
GameBoyAdvanceColorEffectsRenderer.prototype.brightnessDecrease = function (topPixel) {
	var b1 = topPixel >> 10;
	var g1 = (topPixel >> 5) & 0x1F;
	var r1 = (topPixel & 0x1F);
	var decreaseMultiplier = 1 - this.gfx.brightnessEffectAmount;
	b1 *= decreaseMultiplier;
	g1 *= decreaseMultiplier;
	r1 *= decreaseMultiplier;
	return (b1 << 10) | (g1 << 5) | r1;
}