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
function GameBoyAdvanceIRQ(IOCore) {
	//Build references:
	this.IOCore = IOCore;
	this.initializeIRQState();
}
GameBoyAdvanceIRQ.prototype.initializeIRQState = function () {
	this.interruptsEnabled = 0;
	this.interruptsRequested = 0;
	this.IME = false;
}
GameBoyAdvanceIRQ.prototype.IRQMatch = function () {
	//Used to exit HALT:
	return ((this.interruptsEnabled & this.interruptsRequested) != 0);
}
GameBoyAdvanceIRQ.prototype.isIRQEnabled = function (irqLineToCheck) {
	return ((this.interruptsEnabled & irqLineToCheck) != 0);
}
GameBoyAdvanceIRQ.prototype.requestIRQ = function (irqLineToSet) {
	this.interruptsRequested |= irqLineToSet;
	this.checkForIRQFire();
}