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
function GameBoyAdvanceIO(emulatorCore) {
	//Reference to the emulator core:
	this.emulatorCore = emulatorCore;
	//Game Pak Wait State setting:
	this.waitStateGamePak = 0;
	//WRAM Settings:
	this.waitStateWRAM = 2;					//External WRAM 8 and 16 bit request wait states
	this.waitStateWRAMLong = 5;				//External WRAM 32 bit request (Due to 16 bit data bus) wait states.
	this.WRAMConfiguration = [0x20, 0xD];	//WRAM configuration control register current data.
	this.lastBIOSREAD = [0, 0, 0, 0];		//BIOS read bus last.
	//Internal wait state marker for adding clocks later in this core:
	this.waitStateType = 0;
}
GameBoyAdvanceIO.prototype.memoryWrite8 = function (address, data) {
	//Byte Write:
	this.memoryWrite(address >>> 0, data);
	this.waitStateDelay8();
}
GameBoyAdvanceIO.prototype.memoryWrite16 = function (address, data) {
	//Half-Word Write:
	this.memoryWrite(address >>>= 0, data & 0xFF);
	this.memoryWrite(address + 1, data >> 8);
	this.waitStateDelay16();
}
GameBoyAdvanceIO.prototype.memoryWrite32 = function (address, data) {
	//Word Write:
	this.memoryWrite(address >>>= 0, data & 0xFF);
	this.memoryWrite(address + 1, (data >> 8) & 0xFF);
	this.memoryWrite(address + 2, (data >> 16) & 0xFF);
	this.memoryWrite(address + 3, data >>> 24);
	this.waitStateDelay32();
}
GameBoyAdvanceIO.prototype.memoryWrite = function (address, data) {
	this.memoryWriter[address >>> 24](this, address, data);
}
GameBoyAdvanceIO.prototype.memoryRead8 = function (address) {
	//Byte Write:
	var data8 = this.memoryRead(address >>> 0);
	this.waitStateDelay8();
	return data8;
}
GameBoyAdvanceIO.prototype.memoryRead16 = function (address) {
	//Half-Word Write:
	var data16 = this.memoryRead(address >>>= 0);
	data16 |= this.memoryRead(address + 1) << 8;
	this.waitStateDelay16();
	return data16;
}
GameBoyAdvanceIO.prototype.memoryRead32 = function (address) {
	//Word Write:
	var data32 = this.memoryRead(address >>>= 0);
	data32 |= this.memoryRead(address + 1) << 8;
	data32 |= this.memoryRead(address + 2) << 16;
	data32 |= this.memoryRead(address + 3) << 24;
	this.waitStateDelay32();
	return data32;
}
GameBoyAdvanceIO.prototype.memoryRead = function (address) {
	return this.memoryReader[address >>> 24](this, address);
}
GameBoyAdvanceIO.prototype.compileMemoryDispatches = function () {
	/*
		Decoder for the nibble at bits 24-27
			(Top 4 bits of the address is not used,
			so the next nibble down is used for dispatch.):
	*/
	this.memoryWriter = [
		/*
			BIOS Area (00000000-00003FFF)
			Unused (00004000-01FFFFFF)
		*/
		this.writeUnused,
		/*
			Unused (00004000-01FFFFFF)
		*/
		this.writeUnused,
		/*
			WRAM - On-board Work RAM (02000000-0203FFFF)
			Unused (02040000-02FFFFFF)
		*/
		this.writeExternalWRAM,
		/*
			WRAM - In-Chip Work RAM (03000000-03007FFF)
			Unused (03008000-03FFFFFF)
		*/
		this.writeInternalWRAM,
		/*
			I/O Registers (04000000-040003FE)
			Unused (04000400-04FFFFFF)
		*/
		this.writeIO,
		/*
			BG/OBJ Palette RAM (05000000-050003FF)
			Unused (05000400-05FFFFFF)
		*/
		this.writePalette,
		/*
			VRAM - Video RAM (06000000-06017FFF)
			Unused (06018000-06FFFFFF)
		*/
		this.writeVRAM,
		/*
			OAM - OBJ Attributes (07000000-070003FF)
			Unused (07000400-07FFFFFF)
		*/
		this.writeOAM,
		/*
			Game Pak ROM (max 16MB) - Wait State 0 (08000000-08FFFFFF)
		*/
		this.writeROM0Low,
		/*
			Game Pak ROM/FlashROM (max 16MB) - Wait State 0 (09000000-09FFFFFF)
		*/
		this.writeROM0High,
		/*
			Game Pak ROM (max 16MB) - Wait State 1 (0A000000-0AFFFFFF)
		*/
		this.writeROM1Low,
		/*
			Game Pak ROM/FlashROM (max 16MB) - Wait State 1 (0B000000-0BFFFFFF)
		*/
		this.writeROM1High,
		/*
			Game Pak ROM (max 16MB) - Wait State 2 (0C000000-0CFFFFFF)
		*/
		this.writeROM2Low,
		/*
			Game Pak ROM/FlashROM (max 16MB) - Wait State 2 (0D000000-0DFFFFFF)
		*/
		this.writeROM2High,
		/*
			Game Pak SRAM  (max 64 KBytes) - 8bit Bus width (0E000000-0E00FFFF)
		*/
		this.writeSRAM,
		/*
			Unused (0E010000-FFFFFFFF)
		*/
		this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused,
		this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused, this.writeUnused
	];
	this.memoryReader = [
		/*
			BIOS Area (00000000-00003FFF)
			Unused (00004000-01FFFFFF)
		*/
		this.readBIOS,
		/*
			Unused (00004000-01FFFFFF)
		*/
		this.readUnused,
		/*
			WRAM - On-board Work RAM (02000000-0203FFFF)
			Unused (02040000-02FFFFFF)
		*/
		this.readExternalWRAM,
		/*
			WRAM - In-Chip Work RAM (03000000-03007FFF)
			Unused (03008000-03FFFFFF)
		*/
		this.readInternalWRAM,
		/*
			I/O Registers (04000000-040003FE)
			Unused (04000400-04FFFFFF)
		*/
		this.readIO,
		/*
			BG/OBJ Palette RAM (05000000-050003FF)
			Unused (05000400-05FFFFFF)
		*/
		this.readPalette,
		/*
			VRAM - Video RAM (06000000-06017FFF)
			Unused (06018000-06FFFFFF)
		*/
		this.readVRAM,
		/*
			OAM - OBJ Attributes (07000000-070003FF)
			Unused (07000400-07FFFFFF)
		*/
		this.readOAM,
		/*
			Game Pak ROM (max 16MB) - Wait State 0 (08000000-08FFFFFF)
		*/
		this.readROM0Low,
		/*
			Game Pak ROM/FlashROM (max 16MB) - Wait State 0 (09000000-09FFFFFF)
		*/
		this.readROM0High,
		/*
			Game Pak ROM (max 16MB) - Wait State 1 (0A000000-0AFFFFFF)
		*/
		this.readROM1Low,
		/*
			Game Pak ROM/FlashROM (max 16MB) - Wait State 1 (0B000000-0BFFFFFF)
		*/
		this.readROM1High,
		/*
			Game Pak ROM (max 16MB) - Wait State 2 (0C000000-0CFFFFFF)
		*/
		this.readROM2Low,
		/*
			Game Pak ROM/FlashROM (max 16MB) - Wait State 2 (0D000000-0DFFFFFF)
		*/
		this.readROM2High,
		/*
			Game Pak SRAM  (max 64 KBytes) - 8bit Bus width (0E000000-0E00FFFF)
		*/
		this.readSRAM,
		/*
			Unused (0E010000-FFFFFFFF)
		*/
		this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused,
		this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused, this.readUnused
	];
	this.compileIOWriteDispatch();
	this.compileIOReadDispatch();
}
GameBoyAdvanceIO.prototype.compileIOWriteDispatch = function () {
	this.writeIO = [];
	//4000000h - DISPCNT - LCD Control (Read/Write)
	this.writeIO[0] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BGMode = data & 0x07;
		parentObj.emulatorCore.gfx.frameSelect = (data & 0x10) >> 4;
		parentObj.emulatorCore.gfx.HBlankIntervalFree = ((data & 0x20) == 0x20);
		parentObj.emulatorCore.gfx.VRAMOneDimensional = ((data & 0x40) == 0x40);
		parentObj.emulatorCore.gfx.forcedBlank = ((data & 0x80) == 0x80);
	}
	//4000001h - DISPCNT - LCD Control (Read/Write)
	this.writeIO[1] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.displayBG0 = ((data & 0x01) == 0x01);
		parentObj.emulatorCore.gfx.displayBG1 = ((data & 0x02) == 0x02);
		parentObj.emulatorCore.gfx.displayBG2 = ((data & 0x04) == 0x04);
		parentObj.emulatorCore.gfx.displayBG3 = ((data & 0x08) == 0x08);
		parentObj.emulatorCore.gfx.displayOBJ = ((data & 0x10) == 0x10);
		parentObj.emulatorCore.gfx.displayWindow0Flag = ((data & 0x20) == 0x20);
		parentObj.emulatorCore.gfx.displayWindow1Flag = ((data & 0x40) == 0x40);
		parentObj.emulatorCore.gfx.displayObjectWindowFlag = ((data & 0x80) == 0x80);
	}
	//4000002h - Undocumented - Green Swap (R/W)
	this.writeIO[2] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.greenSwap = ((data & 0x01) == 0x01);
	}
	//4000003h - Undocumented - Green Swap (R/W)
	this.writeIO[3] = this.NOP;
	//4000004h - DISPSTAT - General LCD Status (Read/Write)
	this.writeIO[4] = function (parentObj, address, data) {
		//VBlank flag read only.
		//HBlank flag read only.
		//V-Counter flag read only.
		//Only LCD IRQ generation enablers can be set here:
		parentObj.emulatorCore.gfx.IRQVBlank = ((data & 0x08) == 0x08);
		parentObj.emulatorCore.gfx.IRQHBlank = ((data & 0x10) == 0x10);
		parentObj.emulatorCore.gfx.IRQVCounter = ((data & 0x20) == 0x20);
	}
	//4000005h - DISPSTAT - General LCD Status (Read/Write)
	this.writeIO[5] = function (parentObj, address, data) {
		//V-Counter match value:
		parentObj.emulatorCore.gfx.VCounter = data;
	}
	//4000006h - VCOUNT - Vertical Counter (Read only)
	this.writeIO[6] = this.NOP;
	//4000007h - VCOUNT - Vertical Counter (Read only)
	this.writeIO[7] = this.NOP;
	//4000008h - BG0CNT - BG0 Control (R/W) (BG Modes 0,1 only)
	this.writeIO[8] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG0Priority = data & 0x3;
		parentObj.emulatorCore.gfx.BG0CharacterBaseBlock = (data & 0xC) >> 2;
		//Bits 5-6 always 0.
		parentObj.emulatorCore.gfx.BG0Mosaic = ((data & 0x40) == 0x40);
		parentObj.emulatorCore.gfx.BG0Palette256 = ((data & 0x80) == 0x80);
	}
	//4000009h - BG0CNT - BG0 Control (R/W) (BG Modes 0,1 only)
	this.writeIO[9] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG0ScreenBaseBlock = data & 0x1F;
		parentObj.emulatorCore.gfx.BG0DisplayOverflow = ((data & 0x20) == 0x20);	//Note: Only applies to BG2/3 supposedly.
		parentObj.emulatorCore.gfx.BG0ScreenSize = (data & 0xC0) >> 6;
	}
	//400000Ah - BG1CNT - BG1 Control (R/W) (BG Modes 0,1 only)
	this.writeIO[0xA] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG1Priority = data & 0x3;
		parentObj.emulatorCore.gfx.BG1CharacterBaseBlock = (data & 0xC) >> 2;
		//Bits 5-6 always 0.
		parentObj.emulatorCore.gfx.BG1Mosaic = ((data & 0x40) == 0x40);
		parentObj.emulatorCore.gfx.BG1Palette256 = ((data & 0x80) == 0x80);
	}
	//400000Bh - BG1CNT - BG1 Control (R/W) (BG Modes 0,1 only)
	this.writeIO[0xB] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG1ScreenBaseBlock = data & 0x1F;
		parentObj.emulatorCore.gfx.BG1DisplayOverflow = ((data & 0x20) == 0x20);	//Note: Only applies to BG2/3 supposedly.
		parentObj.emulatorCore.gfx.BG1ScreenSize = (data & 0xC0) >> 6;
	}
	//400000Ch - BG2CNT - BG2 Control (R/W) (BG Modes 0,1,2 only)
	this.writeIO[0xC] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG2Priority = data & 0x3;
		parentObj.emulatorCore.gfx.BG2CharacterBaseBlock = (data & 0xC) >> 2;
		//Bits 5-6 always 0.
		parentObj.emulatorCore.gfx.BG2Mosaic = ((data & 0x40) == 0x40);
		parentObj.emulatorCore.gfx.BG2Palette256 = ((data & 0x80) == 0x80);
	}
	//400000Dh - BG2CNT - BG2 Control (R/W) (BG Modes 0,1,2 only)
	this.writeIO[0xD] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG2ScreenBaseBlock = data & 0x1F;
		parentObj.emulatorCore.gfx.BG2DisplayOverflow = ((data & 0x20) == 0x20);
		parentObj.emulatorCore.gfx.BG2ScreenSize = (data & 0xC0) >> 6;
	}
	//400000Eh - BG3CNT - BG3 Control (R/W) (BG Modes 0,2 only)
	this.writeIO[0xE] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG3Priority = data & 0x3;
		parentObj.emulatorCore.gfx.BG3CharacterBaseBlock = (data & 0xC) >> 2;
		//Bits 5-6 always 0.
		parentObj.emulatorCore.gfx.BG3Mosaic = ((data & 0x40) == 0x40);
		parentObj.emulatorCore.gfx.BG3Palette256 = ((data & 0x80) == 0x80);
	}
	//400000Fh - BG3CNT - BG3 Control (R/W) (BG Modes 0,2 only)
	this.writeIO[0xF] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG3ScreenBaseBlock = data & 0x1F;
		parentObj.emulatorCore.gfx.BG3DisplayOverflow = ((data & 0x20) == 0x20);
		parentObj.emulatorCore.gfx.BG3ScreenSize = (data & 0xC0) >> 6;
	}
	//4000010h - BG0HOFS - BG0 X-Offset (W)
	this.writeIO[0x10] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG0XCoord = (parentObj.emulatorCore.gfx.BG0XCoord & 0x100) | data;
	}
	//4000011h - BG0HOFS - BG0 X-Offset (W)
	this.writeIO[0x11] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG0XCoord = ((data & 0x01) << 8) | (parentObj.emulatorCore.gfx.BG0XCoord & 0xFF);
	}
	//4000012h - BG0VOFS - BG0 Y-Offset (W)
	this.writeIO[0x12] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG0YCoord = (parentObj.emulatorCore.gfx.BG0YCoord & 0x100) | data;
	}
	//4000013h - BG0VOFS - BG0 Y-Offset (W)
	this.writeIO[0x13] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG0YCoord = ((data & 0x01) << 8) | (parentObj.emulatorCore.gfx.BG0YCoord & 0xFF);
	}
	//4000014h - BG1HOFS - BG1 X-Offset (W)
	this.writeIO[0x14] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG1XCoord = (parentObj.emulatorCore.gfx.BG1XCoord & 0x100) | data;
	}
	//4000015h - BG1HOFS - BG1 X-Offset (W)
	this.writeIO[0x15] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG1XCoord = ((data & 0x01) << 8) | (parentObj.emulatorCore.gfx.BG1XCoord & 0xFF);
	}
	//4000016h - BG1VOFS - BG1 Y-Offset (W)
	this.writeIO[0x16] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG1YCoord = (parentObj.emulatorCore.gfx.BG1YCoord & 0x100) | data;
	}
	//4000017h - BG1VOFS - BG1 Y-Offset (W)
	this.writeIO[0x17] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG1YCoord = ((data & 0x01) << 8) | (parentObj.emulatorCore.gfx.BG1YCoord & 0xFF);
	}
	//4000018h - BG2HOFS - BG2 X-Offset (W)
	this.writeIO[0x18] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG2XCoord = (parentObj.emulatorCore.gfx.BG2XCoord & 0x100) | data;
	}
	//4000019h - BG2HOFS - BG2 X-Offset (W)
	this.writeIO[0x19] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG2XCoord = ((data & 0x01) << 8) | (parentObj.emulatorCore.gfx.BG2XCoord & 0xFF);
	}
	//400001Ah - BG2VOFS - BG2 Y-Offset (W)
	this.writeIO[0x1A] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG2YCoord = (parentObj.emulatorCore.gfx.BG2YCoord & 0x100) | data;
	}
	//400001Bh - BG2VOFS - BG2 Y-Offset (W)
	this.writeIO[0x1B] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG2YCoord = ((data & 0x01) << 8) | (parentObj.emulatorCore.gfx.BG2YCoord & 0xFF);
	}
	//400001Ch - BG3HOFS - BG3 X-Offset (W)
	this.writeIO[0x1C] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG3XCoord = (parentObj.emulatorCore.gfx.BG3XCoord & 0x100) | data;
	}
	//400001Dh - BG3HOFS - BG3 X-Offset (W)
	this.writeIO[0x1D] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG3XCoord = ((data & 0x01) << 8) | (parentObj.emulatorCore.gfx.BG3XCoord & 0xFF);
	}
	//400001Eh - BG3VOFS - BG3 Y-Offset (W)
	this.writeIO[0x1E] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG3YCoord = (parentObj.emulatorCore.gfx.BG3YCoord & 0x100) | data;
	}
	//400001Fh - BG3VOFS - BG3 Y-Offset (W)
	this.writeIO[0x1F] = function (parentObj, address, data) {
		parentObj.emulatorCore.gfx.BG3YCoord = ((data & 0x01) << 8) | (parentObj.emulatorCore.gfx.BG3YCoord & 0xFF);
	}
}
GameBoyAdvanceIO.prototype.compileIOReadDispatch = function () {
	this.readIO = [];
	//4000000h - DISPCNT - LCD Control (Read/Write)
	this.readIO[0] = function (parentObj, address) {
		return (parentObj.emulatorCore.gfx.BGMode |
		(parentObj.emulatorCore.gfx.frameSelect << 4) |
		(parentObj.emulatorCore.gfx.HBlankIntervalFree ? 0x20 : 0) | 
		(parentObj.emulatorCore.gfx.VRAMOneDimensional ? 0x40 : 0) |
		(parentObj.emulatorCore.gfx.forcedBlank ? 0x80 : 0));
	}
	//4000001h - DISPCNT - LCD Control (Read/Write)
	this.readIO[1] = function (parentObj, address) {
		return ((parentObj.emulatorCore.gfx.displayBG0 ? 0x1 : 0) |
		(parentObj.emulatorCore.gfx.displayBG1 ? 0x2 : 0) |
		(parentObj.emulatorCore.gfx.displayBG2 ? 0x4 : 0) |
		(parentObj.emulatorCore.gfx.displayBG3 ? 0x8 : 0) |
		(parentObj.emulatorCore.gfx.displayOBJ ? 0x10 : 0) |
		(parentObj.emulatorCore.gfx.displayWindow0Flag ? 0x20 : 0) |
		(parentObj.emulatorCore.gfx.displayWindow1Flag ? 0x40 : 0) |
		(parentObj.emulatorCore.gfx.displayObjectWindowFlag ? 0x80 : 0));
	}
	//4000002h - Undocumented - Green Swap (R/W)
	this.readIO[2] = function (parentObj, address) {
		return (parentObj.emulatorCore.gfx.greenSwap ? 0x1 : 0);
	}
	//4000003h - Undocumented - Green Swap (R/W)
	this.readIO[3] = this.readZero;
	//4000004h - DISPSTAT - General LCD Status (Read/Write)
	this.readIO[4] = function (parentObj, address) {
		return ((parentObj.emulatorCore.inVBlank ? 0x1 : 0) |
		(parentObj.emulatorCore.inHBlank ? 0x2 : 0) |
		(parentObj.emulatorCore.VCounterMatch ? 0x4 : 0) |
		(parentObj.emulatorCore.IRQVBlank ? 0x8 : 0) |
		(parentObj.emulatorCore.IRQHBlank ? 0x10 : 0) |
		(parentObj.emulatorCore.IRQVCounter ? 0x20 : 0));
	}
	//4000005h - DISPSTAT - General LCD Status (Read/Write)
	this.readIO[5] = function (parentObj, address) {
		return parentObj.emulatorCore.gfx.VCounter;
	}
	//4000006h - VCOUNT - Vertical Counter (Read only)
	this.readIO[6] = function (parentObj, address) {
		return parentObj.emulatorCore.gfx.currentScanLine;
	}
	//4000007h - VCOUNT - Vertical Counter (Read only)
	this.readIO[7] = this.readZero;
	//4000008h - BG0CNT - BG0 Control (R/W) (BG Modes 0,1 only)
	this.readIO[8] = function (parentObj, address) {
		return (parentObj.emulatorCore.gfx.BG0Priority |
		(parentObj.emulatorCore.gfx.BG0CharacterBaseBlock << 2) |
		(parentObj.emulatorCore.gfx.BG0Mosaic ? 0x40 : 0) | 
		(parentObj.emulatorCore.gfx.BG0Palette256 ? 0x80 : 0));
	}
	//4000009h - BG0CNT - BG0 Control (R/W) (BG Modes 0,1 only)
	this.readIO[9] = function (parentObj, address) {
		return (parentObj.emulatorCore.gfx.BG0ScreenBaseBlock |
		(parentObj.emulatorCore.gfx.BG0DisplayOverflow ? 0x20 : 0) |
		(parentObj.emulatorCore.gfx.BG0ScreenSize << 6));
	}
	//400000Ah - BG1CNT - BG1 Control (R/W) (BG Modes 0,1 only)
	this.readIO[0xA] = function (parentObj, address) {
		return (parentObj.emulatorCore.gfx.BG1Priority |
		(parentObj.emulatorCore.gfx.BG1CharacterBaseBlock << 2) |
		(parentObj.emulatorCore.gfx.BG1Mosaic ? 0x40 : 0) | 
		(parentObj.emulatorCore.gfx.BG1Palette256 ? 0x80 : 0));
	}
	//400000Bh - BG1CNT - BG1 Control (R/W) (BG Modes 0,1 only)
	this.readIO[0xB] = function (parentObj, address) {
		return (parentObj.emulatorCore.gfx.BG1ScreenBaseBlock |
		(parentObj.emulatorCore.gfx.BG1DisplayOverflow ? 0x20 : 0) |
		(parentObj.emulatorCore.gfx.BG1ScreenSize << 6));
	}
	//400000Ch - BG2CNT - BG2 Control (R/W) (BG Modes 0,1,2 only)
	this.readIO[0xC] = function (parentObj, address) {
		return (parentObj.emulatorCore.gfx.BG2Priority |
		(parentObj.emulatorCore.gfx.BG2CharacterBaseBlock << 2) |
		(parentObj.emulatorCore.gfx.BG2Mosaic ? 0x40 : 0) | 
		(parentObj.emulatorCore.gfx.BG2Palette256 ? 0x80 : 0));
	}
	//400000Dh - BG2CNT - BG2 Control (R/W) (BG Modes 0,1,2 only)
	this.readIO[0xD] = function (parentObj, address) {
		return (parentObj.emulatorCore.gfx.BG2ScreenBaseBlock |
		(parentObj.emulatorCore.gfx.BG2DisplayOverflow ? 0x20 : 0) |
		(parentObj.emulatorCore.gfx.BG2ScreenSize << 6));
	}
	//400000Eh - BG3CNT - BG3 Control (R/W) (BG Modes 0,2 only)
	this.readIO[0xE] = function (parentObj, address) {
		return (parentObj.emulatorCore.gfx.BG3Priority |
		(parentObj.emulatorCore.gfx.BG3CharacterBaseBlock << 2) |
		(parentObj.emulatorCore.gfx.BG3Mosaic ? 0x40 : 0) | 
		(parentObj.emulatorCore.gfx.BG3Palette256 ? 0x80 : 0));
	}
	//400000Fh - BG3CNT - BG3 Control (R/W) (BG Modes 0,2 only)
	this.readIO[0xF] = function (parentObj, address) {
		return (parentObj.emulatorCore.gfx.BG3ScreenBaseBlock |
		(parentObj.emulatorCore.gfx.BG3DisplayOverflow ? 0x20 : 0) |
		(parentObj.emulatorCore.gfx.BG3ScreenSize << 6));
	}
	//4000010h - BG0HOFS - BG0 X-Offset (W)
	this.readIO[0x10] = this.readZero;
	//4000011h - BG0HOFS - BG0 X-Offset (W)
	this.readIO[0x11] = this.readZero;
	//4000012h - BG0VOFS - BG0 Y-Offset (W)
	this.readIO[0x12] = this.readZero;
	//4000013h - BG0VOFS - BG0 Y-Offset (W)
	this.readIO[0x13] = this.readZero;
	//4000014h - BG1HOFS - BG1 X-Offset (W)
	this.readIO[0x14] = this.readZero;
	//4000015h - BG1HOFS - BG1 X-Offset (W)
	this.readIO[0x15] = this.readZero;
	//4000016h - BG1VOFS - BG1 Y-Offset (W)
	this.readIO[0x16] = this.readZero;
	//4000017h - BG1VOFS - BG1 Y-Offset (W)
	this.readIO[0x17] = this.readZero;
	//4000018h - BG2HOFS - BG2 X-Offset (W)
	this.readIO[0x18] = this.readZero;
	//4000019h - BG2HOFS - BG2 X-Offset (W)
	this.readIO[0x19] = this.readZero;
	//400001Ah - BG2VOFS - BG2 Y-Offset (W)
	this.readIO[0x1A] = this.readZero;
	//400001Bh - BG2VOFS - BG2 Y-Offset (W)
	this.readIO[0x1B] = this.readZero;
	//400001Ch - BG3HOFS - BG3 X-Offset (W)
	this.readIO[0x1C] = this.readZero;
	//400001Dh - BG3HOFS - BG3 X-Offset (W)
	this.readIO[0x1D] = this.readZero;
	//400001Eh - BG3VOFS - BG3 Y-Offset (W)
	this.readIO[0x1E] = this.readZero;
	//400001Fh - BG3VOFS - BG3 Y-Offset (W)
	this.readIO[0x1F] = this.readZero;
}
GameBoyAdvanceIO.prototype.writeExternalWRAM = function (parentObj, address, data) {
	//External WRAM:
	parentObj.externalRAM[address & 0x3FFFF] = data;
	parentObj.waitStateType = 1;
}
GameBoyAdvanceIO.prototype.writeInternalWRAM = function (parentObj, address, data) {
	//Internal WRAM:
	parentObj.internalRAM[address & 0x7FFF] = data;
	parentObj.waitStateType = 0;
}
GameBoyAdvanceIO.prototype.writeIO = function (parentObj, address, data) {
	parentObj.waitStateType = 0;
	if (address < 0x4000400) {
		//IO Write:
		parentObj.writeIO[address & 0x3FF](parentObj, address, data);
	}
	else if ((address & 0x4FF0800) == 0x4000800) {
		//WRAM wait state control:
		parentObj.configureWRAM(address, data);
	}
}
GameBoyAdvanceIO.prototype.NOP = function (parentObj, address, data) {
	//Ignore the data write...
}
GameBoyAdvanceIO.prototype.writeUnused = function (parentObj, address, data) {
	parentObj.waitStateType = 0;
	//Ignore the data write...
}
GameBoyAdvanceIO.prototype.waitStateDelay8 = function () {
	switch (this.waitStateType) {
		case 0:
			//No wait state.
			break;
		case 1:
			//External WRAM state:
			this.emulatorCore.CPUClocks += this.waitStateWRAM;
	}
}
GameBoyAdvanceIO.prototype.waitStateDelay16 = function () {
	switch (this.waitStateType) {
		case 0:
			//No wait state.
			break;
		case 1:
			//External WRAM state:
			this.emulatorCore.CPUClocks += this.waitStateWRAM;
	}
}
GameBoyAdvanceIO.prototype.waitStateDelay32 = function () {
	switch (this.waitStateType) {
		case 0:
			//No wait state.
			break;
		case 1:
			//External WRAM state:
			this.emulatorCore.CPUClocks += this.waitStateWRAMLong;
	}
}
GameBoyAdvanceIO.prototype.configureWRAM = function (address, data) {
	switch (address & 0x3) {
		case 3:
			this.WRAMConfiguration[0] = data & 0x2F;
			//We're overwriting the master dispatch table for address decoding to handle the new RAM access cases:
			if ((data & 0x01) == 0) {
				this.memoryWriter[2] = ((data & 0x20) == 0x20) ? this.writeExternalWRAM : this.writeInternalWRAM;
				this.memoryReader[2] = ((data & 0x20) == 0x20) ? this.readExternalWRAM : this.readInternalWRAM;
				this.memoryWriter[3] = this.writeInternalWRAM;
				this.memoryReader[3] = this.readInternalWRAM;
			}
			else {
				this.memoryWriter[2] = this.memoryWriter[3] = this.writeUnused;
				this.memoryReader[2] = this.memoryReader[3] = this.readUnused;
			}
			break;
		case 0:
			this.waitStateWRAM = data + 1;
			this.waitStateWRAMLong = (this.waitStateWRAM << 1) + 1;
			this.WRAMConfiguration[1] = data;
	}
}
GameBoyAdvanceIO.prototype.readBIOS = function (parentObj, address) {
	if (address < 0x4000) {
		parentObj.waitStateType = 0;
		if (parentObj.emulatorCore.register[0x15] < 0x4000) {
			//If reading from BIOS while executing it:
			parentObj.lastBIOSREAD[address & 0x3] = parentObj.emulatorCore.registers[0x15];
			return parentObj.BIOS[address];
		}
		else {
			//Not allowed to read from BIOS while executing outside of it:
			return parentObj.lastBIOSREAD[address & 0x3];
		}
	}
	else {
		return parentObj.readUnused(parentObj, address);
	}
}
GameBoyAdvanceIO.prototype.readZero = function (parentObj, address) {
	return 0;
}
GameBoyAdvanceIO.prototype.readUnused = function (parentObj, address) {
	parentObj.waitStateType = 0;
	return parentObj.emulatorCore.fetch >>> ((address & 0x3) << 8);
}