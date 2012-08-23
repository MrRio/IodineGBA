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
GameBoyAdvanceIRQ.prototype.checkForIRQFire = function () {
	//Tell the CPU core when the emulated hardware is triggering an IRQ:
	this.IOCore.cpu.triggerIRQ((this.interruptsEnabled & this.interruptsRequested) != 0 && this.IME);
}
GameBoyAdvanceIRQ.prototype.requestIRQ = function (irqLineToSet) {
	this.interruptsRequested |= irqLineToSet;
	this.checkForIRQFire();
}
GameBoyAdvanceIRQ.prototype.writeIME = function (data) {
	this.IME = ((data & 0x1) == 0x1);
	this.checkForIRQFire();
}
GameBoyAdvanceIRQ.prototype.readIME = function () {
	return (this.IME ? 0xFF : 0xFE);
}
GameBoyAdvanceIRQ.prototype.writeIE0 = function (data) {
	this.interruptsEnabled &= 0x3F00;
	this.interruptsEnabled |= data;
	this.checkForIRQFire();
}
GameBoyAdvanceIRQ.prototype.readIE0 = function () {
	return this.interruptsEnabled & 0xFF;
}
GameBoyAdvanceIRQ.prototype.writeIE1 = function (data) {
	this.interruptsEnabled &= 0xFF;
	this.interruptsEnabled |= (data << 8) & 0x3F00;
	this.checkForIRQFire();
}
GameBoyAdvanceIRQ.prototype.readIE1 = function () {
	return this.interruptsEnabled >> 8;
}
GameBoyAdvanceIRQ.prototype.writeIF0 = function (data) {
	this.interruptsRequested &= ~data;
	this.checkForIRQFire();
}
GameBoyAdvanceIRQ.prototype.readIF0 = function () {
	return this.interruptsRequested & 0xFF;
}
GameBoyAdvanceIRQ.prototype.writeIF1 = function (data) {
	this.interruptsRequested &= ~(data << 8);
	this.checkForIRQFire();
}
GameBoyAdvanceIRQ.prototype.readIF1 = function () {
	return this.interruptsRequested >> 8;
}
GameBoyAdvanceIRQ.prototype.nextEventTime = function () {
	var clocks = this.IOCore.gfx.nextVBlankIRQEventTime();
	clocks = this.findClosestEvent(clocks, this.IOCore.gfx.nextHBlankIRQEventTime());
	clocks = this.findClosestEvent(clocks, this.IOCore.gfx.nextVCounterIRQEventTime());
	clocks = this.findClosestEvent(clocks, this.IOCore.timer.nextTimer0IRQEventTime());
	clocks = this.findClosestEvent(clocks, this.IOCore.timer.nextTimer1IRQEventTime());
	clocks = this.findClosestEvent(clocks, this.IOCore.timer.nextTimer2IRQEventTime());
	clocks = this.findClosestEvent(clocks, this.IOCore.timer.nextTimer3IRQEventTime());
	clocks = this.findClosestEvent(clocks, this.IOCore.serial.nextIRQEventTime());
	clocks = this.findClosestEvent(clocks, this.IOCore.dma.nextIRQEventTime());
	//JoyPad input state should never update while we're in halt:
	//clocks = this.findClosestEvent(clocks, this.IOCore.joypad.nextIRQEventTime());
	clocks = this.findClosestEvent(clocks, this.IOCore.cartridge.nextIRQEventTime());
	return clocks;
}
GameBoyAdvanceIRQ.prototype.findClosestEvent = function (oldClocks, newClocks) {
	if (oldClocks > -1) {
		if (newClocks > -1) {
			return Math.min(oldClocks, newClocks);
		}
		return oldClocks;
	}
	return newClocks;
}