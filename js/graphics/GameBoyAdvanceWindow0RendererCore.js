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
function GameBoyAdvanceWindow0Renderer(gfx) {
	this.gfx = gfx;
	this.preprocess();
}
GameBoyAdvanceWindow0Renderer.prototype.renderNormalScanLine = function (line, lineBuffer, OBJBuffer, BG0Buffer, BG1Buffer, BG2Buffer, BG3Buffer) {
	//Arrange our layer stack so we can remove disabled and order for correct edge case priority:
	var layerStack = this.gfx.cleanLayerStack(OBJBuffer, BG0Buffer, BG1Buffer, BG2Buffer, BG3Buffer);
	var stackDepth = layerStack.length;
	var stackIndex = 0;
	if (this.WIN0YCoordTop <= line && line <= this.WIN0YCoordBottom) {
		//Loop through each pixel on the line:
		for (var pixelPosition = this.gfx.WIN0XCoordLeft, currentPixel = 0, workingPixel = 0, lowerPixel = 0, endPosition = Math.min(this.gfx.WIN0XCoordRight, 240); pixelPosition <= endPosition; ++pixelPosition) {
			//Start with backdrop color:
			lowerPixel = currentPixel = this.palette256[0];
			//Loop through all layers each pixel to resolve priority:
			for (stackIndex = 0; stackIndex < stackDepth; ++stackIndex) {
				workingPixel = layerStack[stackIndex][pixelPosition];
				if ((workingPixel & 0x1D00000) <= (currentPixel & 0x1D00000)) {
					/*
						If higher priority than last pixel and not transparent.
						Also clear any plane layer bits other than backplane for
						transparency.
						
						Keep a copy of the previous pixel (backdrop or non-transparent) for the color effects:
					*/
					lowerPixel = currentPixel;
					currentPixel = workingPixel;
				}
			}
			if ((currentPixel & 0x200000) == 0) {
				//Normal Pixel:
				lineBuffer[pixelPosition] = currentPixel;
			}
			else {
				//OAM Pixel Processing:
				//Pass the highest two pixels to be arbitrated in the color effects processing:
				lineBuffer[pixelPosition] = this.gfx.colorEffectsRenderer.processOAMSemiTransparent(lowerPixel, currentPixel);
			}
		}
	}
}
GameBoyAdvanceWindow0Renderer.prototype.renderScanLineWithEffects = function (line, lineBuffer, OBJBuffer, BG0Buffer, BG1Buffer, BG2Buffer, BG3Buffer) {
	//Arrange our layer stack so we can remove disabled and order for correct edge case priority:
	var layerStack = this.gfx.cleanLayerStack(OBJBuffer, BG0Buffer, BG1Buffer, BG2Buffer, BG3Buffer);
	var stackDepth = layerStack.length;
	var stackIndex = 0;
	if (this.WIN0YCoordTop <= line && line <= this.WIN0YCoordBottom) {
		//Loop through each pixel on the line:
		for (var pixelPosition = this.gfx.WIN0XCoordLeft, currentPixel = 0, workingPixel = 0, lowerPixel = 0, endPosition = Math.min(this.gfx.WIN0XCoordRight, 240); pixelPosition <= endPosition; ++pixelPosition) {
			//Start with backdrop color:
			lowerPixel = currentPixel = this.palette256[0];
			//Loop through all layers each pixel to resolve priority:
			for (stackIndex = 0; stackIndex < stackDepth; ++stackIndex) {
				workingPixel = layerStack[stackIndex][pixelPosition];
				if ((workingPixel & 0x1D00000) <= (currentPixel & 0x1D00000)) {
					/*
						If higher priority than last pixel and not transparent.
						Also clear any plane layer bits other than backplane for
						transparency.
						
						Keep a copy of the previous pixel (backdrop or non-transparent) for the color effects:
					*/
					lowerPixel = currentPixel;
					currentPixel = workingPixel;
				}
			}
			if ((currentPixel & 0x200000) == 0) {
				//Normal Pixel:
				//Pass the highest two pixels to be arbitrated in the color effects processing:
				lineBuffer[pixelPosition] = this.gfx.colorEffectsRenderer.process(lowerPixel, currentPixel);
			}
			else {
				//OAM Pixel Processing:
				//Pass the highest two pixels to be arbitrated in the color effects processing:
				lineBuffer[pixelPosition] = this.gfx.colorEffectsRenderer.processOAMSemiTransparent(lowerPixel, currentPixel);
			}
		}
	}
}
GameBoyAdvanceWindow0Renderer.prototype.preprocess = function () {
	this.renderScanLine = (this.gfx.WIN0Effects) ? this.renderScanLineWithEffects : this.renderNormalScanLine;
}