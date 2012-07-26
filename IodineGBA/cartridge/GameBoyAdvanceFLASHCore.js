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
	this.maxBankOffset = this.memorySize >>> 17;
	this.writeStep = 0;
	this.mode = "NONE";
}
GameBoyAdvanceFlash.prototype.load = function (existingData) {
	var sramLength = existingData.length;
	for (var sramIndex = 0, sramIndex2; sramIndex < this.memorySize; ++sramIndex) {
		this.FLASH[sramIndex] = existingData[sramIndex2++];
		sramIndex2 %= sramLength;
	}
}
GameBoyAdvanceFlash.prototype.read = function (address) {
	switch (address) {
		case 0:
			if (this.mode == "ID") {
				return 0xBF;
			}
			
		case 1:
			if (this.mode == "ID") {
				return 0xD4;
			}
		default:
			return this.FLASH[this.bankOffset | (address & 0xFFFF)];
	}
}
GameBoyAdvanceFlash.prototype.write = function (address, data) {
	switch (address) {
		case 0x5555:
			switch (this.writeStep) {
				case 0:
					if (data == 0xAA) {
						this.writeStep = 1;
						break;
					}
					else if (data != 0xF0) {
						this.FLASH[this.bankOffset | address] = data;
					}
					this.mode = "NONE";
					break;
				case 1:
					this.writeStep = 0;
					break;
				case 2:
					switch (data) {
						case 0x90:
							this.mode = "ID";
							break;
						case 0x80:
							this.mode = "ERASE_COMMAND";
							break;
						case 0x10:
							if (this.mode == "ERASE_COMMAND") {
								this.mode = "NONE";
								this.eraseChip();
							}
							break;
						case 0xB0:
							this.mode = "NONE";
							this.bankOffset = (data & this.maxBankOffset & 0x1) << 16;
							break;
						default:
							this.mode = "NONE";
					}
					this.writeStep = 0;
			}
			break;
		case 0x1000:
		case 0x2000:
		case 0x3000:
		case 0x4000:
		case 0x5000:
		case 0x6000:
		case 0x7000:
		case 0x8000:
		case 0x9000:
		case 0xA000:
		case 0xB000:
		case 0xC000:
		case 0xD000:
		case 0xE000:
		case 0xF000:
			if (this.mode == "ERASE_COMMAND" && this.writeStep == 2 && data == 0x30) {
				this.eraseSector(address & 0xF000);
			}
			else {
				this.FLASH[this.bankOffset | address] = data;
			}
			this.mode = "NONE";
			this.writeStep = 0;
			break;
		case 0x2AAA:
			if (this.writeStep == 1 && data == 0x55) {
				this.writeStep = 2;
			}
			else {
				this.mode = "NONE";
				this.writeStep = 0;
				this.FLASH[this.bankOffset | address] = data;
			}
			break;
		default:
			this.mode = "NONE";
			this.writeStep = 0;
			this.FLASH[this.bankOffset | address] = data;
	}
}