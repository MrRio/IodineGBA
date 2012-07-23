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
function GameBoyAdvanceMode0Renderer(gfx) {
	this.gfx = gfx;
}
GameBoyAdvanceMode0Renderer.prototype.renderScanLine = function (line) {
	var BG0Buffer = (this.gfx.displayBG0) ? this.gfx.bg0Renderer.renderScanLine(line) : null;
	var BG1Buffer = (this.gfx.displayBG1) ? this.gfx.bg1Renderer.renderScanLine(line) : null;
	var BG2Buffer = (this.gfx.displayBG2) ? this.gfx.bg2TextRenderer.renderScanLine(line) : null;
	var BG3Buffer = (this.gfx.displayBG3) ? this.gfx.bg3TextRenderer.renderScanLine(line) : null;
	var OBJBuffer = (this.gfx.displayOBJ) ? this.gfx.objRenderer.renderScanLine(line) : null;
	this.gfx.compositeLayers(OBJBuffer, BG0Buffer, BG1Buffer, BG2Buffer, BG3Buffer);
	if (this.gfx.displayObjectWindowFlag) {
		this.gfx.objWindowRenderer.renderScanLine(line, this.gfx.lineBuffer, OBJBuffer, BG0Buffer, BG1Buffer, BG2Buffer, BG3Buffer);
	}
	if (this.gfx.displayWindow1Flag) {
		this.gfx.window1Renderer.renderScanLine(line, this.gfx.lineBuffer, OBJBuffer, BG0Buffer, BG1Buffer, BG2Buffer, BG3Buffer);
	}
	if (this.gfx.displayWindow0Flag) {
		this.gfx.window0Renderer.renderScanLine(line, this.gfx.lineBuffer, OBJBuffer, BG0Buffer, BG1Buffer, BG2Buffer, BG3Buffer);
	}
	this.gfx.copyLineToFrameBuffer(line);
}