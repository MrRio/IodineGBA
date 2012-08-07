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
function GameBoyAdvanceWait(IOCore) {
	this.IOCore = IOCore;
	this.initialize();
}
GameBoyAdvanceWait.prototype.GAMEPAKWaitStateTable = [
	5, 4, 3, 9
];
GameBoyAdvanceWait.prototype.initialize = function () {
	this.WRAMConfiguration = [0xD, 0x20];	//WRAM configuration control register current data.
	this.WRAMWaitState = 3;					//External WRAM wait state.
	this.SRAMWaitState = 5;
	this.CARTWaitState0First = 5;
	this.CARTWaitState0Second = 3;
	this.CARTWaitState1First = 5;
	this.CARTWaitState1Second = 5;
	this.CARTWaitState2First = 5;
	this.CARTWaitState2Second = 9;
	this.POSTBOOT = 0;
	this.width = 8;
	this.nonSequential = true;
	this.ROMPrebuffer = 0;
	this.prefetchEnabled = false;
	this.WAITCNT0 = 0;
	this.WAITCNT1 = 0;
}
GameBoyAdvanceWait.prototype.writeWAITCNT0 = function (data) {
	this.SRAMWaitState = this.GAMEPAKWaitStateTable[data & 0x3];
	this.CARTWaitState0First = this.GAMEPAKWaitStateTable[(data >> 2) & 0x3];
	this.CARTWaitState0Second = ((data & 0x10) == 0x10) ? 0x2 : 0x3;
	this.CARTWaitState1First = this.GAMEPAKWaitStateTable[(data >> 5) & 0x3];
	this.CARTWaitState1Second = (data > 0x7F) ? 0x2 : 0x5;
	this.WAITCNT0 = data;
}
GameBoyAdvanceWait.prototype.readWAITCNT0 = function () {
	return this.WAITCNT0;
}
GameBoyAdvanceWait.prototype.writeWAITCNT1 = function (data) {
	this.CARTWaitState2First = this.GAMEPAKWaitStateTable[data & 0x3];
	this.CARTWaitState2Second = ((data & 0x8) == 0x8) ? 0x2 : 0x9;
	this.prefetchEnabled = ((data & 0x40) == 0x40);
	if (!this.prefetchEnabled) {
		this.ROMPrebuffer = 0;
	}
	this.WAITCNT1 = data;
}
GameBoyAdvanceWait.prototype.readWAITCNT1 = function () {
	return this.WAITCNT1 | 0x20;
}
GameBoyAdvanceWait.prototype.writePOSTBOOT = function (data) {
	this.POSTBOOT = data;
}
GameBoyAdvanceWait.prototype.readPOSTBOOT = function () {
	return this.POSTBOOT;
}
GameBoyAdvanceWait.prototype.writeHALTCNT = function (data) {
	//HALT/STOP mode entrance:
	this.systemStatus |= (data < 0x80) ? 2 : 4;
}
GameBoyAdvanceIO.prototype.writeConfigureWRAM = function (address, data) {
	switch (address & 0x3) {
		case 3:
			this.WRAMConfiguration[1] = data & 0x2F;
			this.IOCore.remapWRAM(data);
			break;
		case 0:
			this.WRAMWaitState = 0x10 - (data & 0xF);
			this.WRAMConfiguration[0] = data;
	}
}
GameBoyAdvanceWait.prototype.readConfigureWRAM = function (address) {
	switch (address & 0x3) {
		case 3:
			return this.WRAMConfiguration[1];
			break;
		case 0:
			return this.WRAMConfiguration[0];
			break;
		default:
			return 0;
	}
}
GameBoyAdvanceWait.prototype.CPUInternalCyclePrefetch = function (address, clocks) {
	//Clock for idle CPU time:
	this.IOCore.clocks = clocks;
	this.IOCore.updateCore();
	//Check for ROM prefetching:
	if (this.prefetchEnabled) {
		//We were already in ROM, so if prefetch do so as sequential:
		//Only case for non-sequential ROM prefetch is invalid anyways:
		switch ((address >>> 24) & 0xF) {
			case 0x8:
			case 0x9:
				while (clocks >= this.CARTWaitState0Second) {
					clocks -= this.CARTWaitState0Second;
					++this.ROMPrebuffer;
				}
				break;
			case 0xA:
			case 0xB:
				while (clocks >= this.CARTWaitState1Second) {
					clocks -= this.CARTWaitState1Second;
					++this.ROMPrebuffer;
				}
				break;
			case 0xC:
			case 0xD:
				while (clocks >= this.CARTWaitState1Second) {
					clocks -= this.CARTWaitState1Second;
					++this.ROMPrebuffer;
				}
		}
		//ROM buffer caps out at 8 x 16 bit:
		if (this.ROMPrebuffer > 8) {
			this.ROMPrebuffer = 8;
		}
	}
}
GameBoyAdvanceWait.prototype.CPUGetOpcode16 = function (address) {
	if ((address >>> 24) >= 0x8 && (address >>> 24) < 0xE) {
		if (this.prefetchEnabled) {
			if (this.ROMPrebuffer > 0) {
				--this.ROMPrebuffer;
				this.FASTAccess();
				return (this.IOCore.cartridge.readROM(address & 0x1FFFFFF) +
					(this.IOCore.cartridge.readROM((address + 1) & 0x1FFFFFF) << 8));
			}
		}
		else {
			this.NonSequentialBroadcast();
		}
	}
	return this.IOCore.memoryRead16(address);
}
GameBoyAdvanceWait.prototype.CPUGetOpcode32 = function (address) {
	if ((address >>> 24) >= 0x8 && (address >>> 24) < 0xE) {
		if (this.prefetchEnabled) {
			if (this.ROMPrebuffer > 1) {
				this.ROMPrebuffer -= 2;
				this.FASTAccess();
				return (this.IOCore.cartridge.readROM(address & 0x1FFFFFF) |
					(this.IOCore.cartridge.readROM((address + 1) & 0x1FFFFFF) << 8) |
					(this.IOCore.cartridge.readROM((address + 2) & 0x1FFFFFF) << 16) |
					(this.IOCore.cartridge.readROM((address + 3) & 0x1FFFFFF) << 24));
			}
			else if (this.ROMPrebuffer == 1) {
				//Buffer miss if only 16 bits out of 32 bits stored:
				--this.ROMPrebuffer;
			}
		}
		else {
			this.NonSequentialBroadcast();
		}
	}
	return this.IOCore.memoryRead32(address);
}
GameBoyAdvanceWait.prototype.NonSequentialBroadcast = function () {
	this.nonSequential = true;
	this.ROMPrebuffer = 0;
}
GameBoyAdvanceWait.prototype.FASTAccess = function () {
	this.IOCore.clocks = 1;
	this.IOCore.updateCore();
	this.nonSequential = false;
}
GameBoyAdvanceWait.prototype.WRAMAccess = function (reqByteNumber) {
	if ((reqByteNumber & 0x1) == 0x1 || this.width == 8) {
		this.IOCore.clocks = this.WRAMWaitState;
		this.IOCore.updateCore();
	}
	this.nonSequential = false;
}
GameBoyAdvanceWait.prototype.ROM0Access = function (reqByteNumber) {
	if ((reqByteNumber & 0x1) == 0x1 || this.width == 8) {
		if (this.nonSequential) {
			this.IOCore.clocks = this.CARTWaitState0First;
			this.nonSequential = false;
		}
		else {
			this.IOCore.clocks = this.CARTWaitState0Second;
		}
		this.IOCore.updateCore();
	}
}
GameBoyAdvanceWait.prototype.ROM1Access = function (reqByteNumber) {
	if ((reqByteNumber & 0x1) == 0x1 || this.width == 8) {
		if (this.nonSequential) {
			this.IOCore.clocks = this.CARTWaitState1First;
			this.nonSequential = false;
		}
		else {
			this.IOCore.clocks = this.CARTWaitState1Second;
		}
		this.IOCore.updateCore();
	}
}
GameBoyAdvanceWait.prototype.ROM2Access = function (reqByteNumber) {
	if ((reqByteNumber & 0x1) == 0x1 || this.width == 8) {
		if (this.nonSequential) {
			this.IOCore.clocks = this.CARTWaitState2First;
			this.nonSequential = false;
		}
		else {
			this.IOCore.clocks = this.CARTWaitState2Second;
		}
		this.IOCore.updateCore();
	}
}
GameBoyAdvanceWait.prototype.SRAMAccess = function (reqByteNumber) {
	this.IOCore.clocks = this.SRAMWaitState;
	this.IOCore.updateCore();
	this.nonSequential = false;
}
GameBoyAdvanceWait.prototype.VRAMAccess = function (reqByteNumber) {
	if ((reqByteNumber & 0x1) == 0x1 || this.width == 8) {
		this.IOCore.clocks = (this.IOCore.gfx.isRendering()) ? 2 : 1;
		this.IOCore.updateCore();
	}
	this.nonSequential = false;
}
GameBoyAdvanceWait.prototype.OAMAccess = function (reqByteNumber) {
	switch (reqByteNumber) {
		case 0:
			if (this.width != 8) {
				return;
			}
		case 1:
			if (this.width != 16) {
				return;
			}
		case 3:
			this.IOCore.clocks = this.IOCore.gfx.OAMLockedCycles() + 1;
			this.IOCore.updateCore();
	}
	this.nonSequential = false;
}