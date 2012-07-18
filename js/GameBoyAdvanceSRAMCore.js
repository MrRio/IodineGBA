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
function GameBoyAdvanceSRAM(IOCore) {
	this.IOCore = IOCore;
	this.initialize();
}
GameBoyAdvanceSRAM.prototype.initialize = function () {
	this.SRAM = getUint8Array(0x8000);
}
GameBoyAdvanceSRAM.prototype.load = function (existingData) {
	var sramLength = existingData.length;
	for (var sramIndex = 0, sramIndex2; sramIndex < 0x8000; ++sramIndex) {
		this.SRAM[sramIndex] = existingData[sramIndex2++];
		sramIndex2 %= sramLength;
	}
}
GameBoyAdvanceSRAM.prototype.read = function (address) {
	return this.SRAM[address & 0x7FFF];
}
GameBoyAdvanceSRAM.prototype.write = function (address, data) {
	this.SRAM[address & 0x7FFF] = data;
}