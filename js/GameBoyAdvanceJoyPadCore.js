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
function GameBoyAdvanceJoyPad(IOCore) {
	this.IOCore = IOCore;
	this.initialize();
}
GameBoyAdvanceJoyPad.prototype.initialize = function () {
	this.keyInput = 0x3FF;
	this.keyInterrupt = 0;
	this.keyIRQType = false;
	this.keyIRQEnabled = false;
}
GameBoyAdvanceJoyPad.prototype.keyPress = function (keyPressed) {
	switch (keyPressed) {
		case "A":
			this.keyInput &= ~0x1;
			break;
		case "B":
			this.keyInput &= ~0x2;
			break;
		case "SELECT":
			this.keyInput &= ~0x4;
			break;
		case "START":
			this.keyInput &= ~0x8;
			break;
		case "RIGHT":
			this.keyInput &= ~0x10;
			break;
		case "LEFT":
			this.keyInput &= ~0x20;
			break;
		case "UP":
			this.keyInput &= ~0x40;
			break;
		case "DOWN":
			this.keyInput &= ~0x80;
			break;
		case "R":
			this.keyInput &= ~0x100;
			break;
		case "L":
			this.keyInput &= ~0x200;
			break;
		default:
			return;
	}
	if (this.keyIRQEnabled) {
		this.checkForIRQ();
	}
}
GameBoyAdvanceJoyPad.prototype.keyRelease = function (keyReleased) {
	switch (keyReleased) {
		case "A":
			this.keyInput |= 0x1;
			break;
		case "B":
			this.keyInput |= 0x2;
			break;
		case "SELECT":
			this.keyInput |= 0x4;
			break;
		case "START":
			this.keyInput |= 0x8;
			break;
		case "RIGHT":
			this.keyInput |= 0x10;
			break;
		case "LEFT":
			this.keyInput |= 0x20;
			break;
		case "UP":
			this.keyInput |= 0x40;
			break;
		case "DOWN":
			this.keyInput |= 0x80;
			break;
		case "R":
			this.keyInput |= 0x100;
			break;
		case "L":
			this.keyInput |= 0x200;
			break;
		default:
			return;
	}
	if (this.keyIRQEnabled) {
		this.checkForIRQ();
	}
}
GameBoyAdvanceJoyPad.prototype.checkForIRQ = function () {
	if (this.keyIRQType) {
		if ((~this.keyInput & this.keyInterrupt & 0x3FF) == (this.keyInterrupt & 0x3FF)) {
			this.IOCore.irq.requestIRQ(0x1000);
		}
	}
	else if ((~this.keyInput & this.keyInterrupt & 0x3FF) != 0) {
		this.IOCore.irq.requestIRQ(0x1000);
	}
}
/*GameBoyAdvanceJoyPad.prototype.nextIRQEventTime = function {
	//Always return -1 here, as we don't input joypad updates at the same time we're running the interp loop:
	return -1;
}*/
GameBoyAdvanceJoyPad.prototype.readKeyStatus0 = function () {
	return this.keyInput & 0xFF;
}
GameBoyAdvanceJoyPad.prototype.readKeyStatus1 = function () {
	return ((this.keyInput >> 8) & 0x3) | 0xFC;
}
GameBoyAdvanceJoyPad.prototype.writeKeyControl0 = function (data) {
	this.keyInterrupt &= 0x300;
	this.keyInterrupt |= data;
}
GameBoyAdvanceJoyPad.prototype.readKeyControl0 = function () {
	return this.keyInterrupt & 0xFF;
}
GameBoyAdvanceJoyPad.prototype.writeKeyControl1 = function (data) {
	this.keyInterrupt &= 0xFF;
	this.keyInterrupt |= data << 8;
	this.keyIRQType = (data > 0x7F);
	this.keyIRQEnabled = ((data & 0x40) == 0x40);
}
GameBoyAdvanceJoyPad.prototype.readKeyControl1 = function () {
	return ((this.keyInterrupt >> 8) & 0xC3) | 0x3C;
}