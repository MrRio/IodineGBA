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
function GameBoyAdvanceFlash(IOCore, memoryLarge) {
	this.IOCore = IOCore;
	this.memorySize = (memoryLarge == 0x20000) ? 0x20000 : 0x10000;
	this.initialize();
}
GameBoyAdvanceFlash.prototype.initialize = function () {
	this.FLASH = getUint8Array(this.memorySize);
	this.bankOffset = 0;
	this.maxBankOffset = this.memorySize >>> 16;
}
GameBoyAdvanceFlash.prototype.load = function (existingData) {
	var sramLength = existingData.length;
	for (var sramIndex = 0, sramIndex2; sramIndex < this.memorySize; ++sramIndex) {
		this.FLASH[sramIndex] = existingData[sramIndex2++];
		sramIndex2 %= sramLength;
	}
}
GameBoyAdvanceFlash.prototype.read = function (address) {
	//return this.FLASH[this.bankOffset | (address & 0xFFFF)];
}
GameBoyAdvanceFlash.prototype.write = function (address, data) {
	//this.FLASH[this.bankOffset | (address & 0xFFFF)] = data;
}