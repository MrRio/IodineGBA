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
	this.WRAMConfiguration = [0xD, 0x20];	//WRAM configuration control register current data.
	this.lastBIOSREAD = [0, 0, 0, 0];		//BIOS read bus last.
	//Internal wait state marker for adding clocks later in this core:
	this.memoryAccessType = 0;
	//Initialize the A/V objects:
	this.gfx = new GameBoyAdvanceGraphics(this);
	this.sound = new GameBoyAdvanceSound(this);
}
GameBoyAdvanceIO.prototype.memoryWrite8 = function (address, data) {
	//Byte Write:
	this.memoryWrite(address >>> 0, data);
	this.accessPostProcess8[this.memoryAccessType](this);
}
GameBoyAdvanceIO.prototype.memoryWrite16 = function (address, data) {
	//Half-Word Write:
	this.memoryWrite(address >>>= 0, data & 0xFF);
	this.memoryWrite(address + 1, data >> 8);
	this.accessPostProcess16[this.memoryAccessType](this);
}
GameBoyAdvanceIO.prototype.memoryWrite32 = function (address, data) {
	//Word Write:
	this.memoryWrite(address >>>= 0, data & 0xFF);
	this.memoryWrite(address + 1, (data >> 8) & 0xFF);
	this.memoryWrite(address + 2, (data >> 16) & 0xFF);
	this.memoryWrite(address + 3, data >>> 24);
	this.accessPostProcess32[this.memoryAccessType](this);
}
GameBoyAdvanceIO.prototype.memoryWrite = function (address, data) {
	this.memoryWriter[address >>> 24](this, address, data);
}
GameBoyAdvanceIO.prototype.memoryRead8 = function (address) {
	//Byte Write:
	var data8 = this.memoryRead(address >>> 0);
	this.accessPostProcess8[this.memoryAccessType](this);
	return data8;
}
GameBoyAdvanceIO.prototype.memoryRead16 = function (address) {
	//Half-Word Write:
	var data16 = this.memoryRead(address >>>= 0);
	data16 |= this.memoryRead(address + 1) << 8;
	this.accessPostProcess16[this.memoryAccessType](this);
	return data16;
}
GameBoyAdvanceIO.prototype.memoryRead32 = function (address) {
	//Word Write:
	var data32 = this.memoryRead(address >>>= 0);
	data32 |= this.memoryRead(address + 1) << 8;
	data32 |= this.memoryRead(address + 2) << 16;
	data32 |= this.memoryRead(address + 3) << 24;
	this.accessPostProcess32[this.memoryAccessType](this);
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
		this.writeIODispatch,
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
		this.readIODispatch,
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
	this.compileMemoryAccessPostProcessDispatch();
}
GameBoyAdvanceIO.prototype.compileIOWriteDispatch = function () {
	this.writeIO = [];
	//4000000h - DISPCNT - LCD Control (Read/Write)
	this.writeIO[0] = function (parentObj, data) {
		parentObj.gfx.writeDISPCNT0(data);
	}
	//4000001h - DISPCNT - LCD Control (Read/Write)
	this.writeIO[0x1] = function (parentObj, data) {
		parentObj.gfx.writeDISPCNT1(data);
	}
	//4000002h - Undocumented - Green Swap (R/W)
	this.writeIO[0x2] = function (parentObj, data) {
		parentObj.gfx.writeGreenSwap(data);
	}
	//4000003h - Undocumented - Green Swap (R/W)
	this.writeIO[0x3] = this.NOP;
	//4000004h - DISPSTAT - General LCD Status (Read/Write)
	this.writeIO[0x4] = function (parentObj, data) {
		parentObj.gfx.writeDISPSTAT0(data);
	}
	//4000005h - DISPSTAT - General LCD Status (Read/Write)
	this.writeIO[0x5] = function (parentObj, data) {
		parentObj.gfx.writeDISPSTAT1(data);
	}
	//4000006h - VCOUNT - Vertical Counter (Read only)
	this.writeIO[0x6] = this.NOP;
	//4000007h - VCOUNT - Vertical Counter (Read only)
	this.writeIO[0x7] = this.NOP;
	//4000008h - BG0CNT - BG0 Control (R/W) (BG Modes 0,1 only)
	this.writeIO[0x8] = function (parentObj, data) {
		parentObj.gfx.writeBG0CNT0(data);
	}
	//4000009h - BG0CNT - BG0 Control (R/W) (BG Modes 0,1 only)
	this.writeIO[0x9] = function (parentObj, data) {
		parentObj.gfx.writeBG0CNT1(data);
	}
	//400000Ah - BG1CNT - BG1 Control (R/W) (BG Modes 0,1 only)
	this.writeIO[0xA] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG1Priority = data & 0x3;
		parentObj.gfx.BG1CharacterBaseBlock = (data & 0xC) >> 2;
		//Bits 5-6 always 0.
		parentObj.gfx.BG1Mosaic = ((data & 0x40) == 0x40);
		parentObj.gfx.BG1Palette256 = ((data & 0x80) == 0x80);
	}
	//400000Bh - BG1CNT - BG1 Control (R/W) (BG Modes 0,1 only)
	this.writeIO[0xB] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG1ScreenBaseBlock = data & 0x1F;
		parentObj.gfx.BG1DisplayOverflow = ((data & 0x20) == 0x20);	//Note: Only applies to BG2/3 supposedly.
		parentObj.gfx.BG1ScreenSize = (data & 0xC0) >> 6;
	}
	//400000Ch - BG2CNT - BG2 Control (R/W) (BG Modes 0,1,2 only)
	this.writeIO[0xC] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2Priority = data & 0x3;
		parentObj.gfx.BG2CharacterBaseBlock = (data & 0xC) >> 2;
		//Bits 5-6 always 0.
		parentObj.gfx.BG2Mosaic = ((data & 0x40) == 0x40);
		parentObj.gfx.BG2Palette256 = ((data & 0x80) == 0x80);
	}
	//400000Dh - BG2CNT - BG2 Control (R/W) (BG Modes 0,1,2 only)
	this.writeIO[0xD] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2ScreenBaseBlock = data & 0x1F;
		parentObj.gfx.BG2DisplayOverflow = ((data & 0x20) == 0x20);
		parentObj.gfx.BG2ScreenSize = (data & 0xC0) >> 6;
	}
	//400000Eh - BG3CNT - BG3 Control (R/W) (BG Modes 0,2 only)
	this.writeIO[0xE] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3Priority = data & 0x3;
		parentObj.gfx.BG3CharacterBaseBlock = (data & 0xC) >> 2;
		//Bits 5-6 always 0.
		parentObj.gfx.BG3Mosaic = ((data & 0x40) == 0x40);
		parentObj.gfx.BG3Palette256 = ((data & 0x80) == 0x80);
	}
	//400000Fh - BG3CNT - BG3 Control (R/W) (BG Modes 0,2 only)
	this.writeIO[0xF] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3ScreenBaseBlock = data & 0x1F;
		parentObj.gfx.BG3DisplayOverflow = ((data & 0x20) == 0x20);
		parentObj.gfx.BG3ScreenSize = (data & 0xC0) >> 6;
	}
	//4000010h - BG0HOFS - BG0 X-Offset (W)
	this.writeIO[0x10] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG0XCoord = (parentObj.gfx.BG0XCoord & 0x100) | data;
	}
	//4000011h - BG0HOFS - BG0 X-Offset (W)
	this.writeIO[0x11] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG0XCoord = ((data & 0x01) << 8) | (parentObj.gfx.BG0XCoord & 0xFF);
	}
	//4000012h - BG0VOFS - BG0 Y-Offset (W)
	this.writeIO[0x12] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG0YCoord = (parentObj.gfx.BG0YCoord & 0x100) | data;
	}
	//4000013h - BG0VOFS - BG0 Y-Offset (W)
	this.writeIO[0x13] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG0YCoord = ((data & 0x01) << 8) | (parentObj.gfx.BG0YCoord & 0xFF);
	}
	//4000014h - BG1HOFS - BG1 X-Offset (W)
	this.writeIO[0x14] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG1XCoord = (parentObj.gfx.BG1XCoord & 0x100) | data;
	}
	//4000015h - BG1HOFS - BG1 X-Offset (W)
	this.writeIO[0x15] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG1XCoord = ((data & 0x01) << 8) | (parentObj.gfx.BG1XCoord & 0xFF);
	}
	//4000016h - BG1VOFS - BG1 Y-Offset (W)
	this.writeIO[0x16] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG1YCoord = (parentObj.gfx.BG1YCoord & 0x100) | data;
	}
	//4000017h - BG1VOFS - BG1 Y-Offset (W)
	this.writeIO[0x17] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG1YCoord = ((data & 0x01) << 8) | (parentObj.gfx.BG1YCoord & 0xFF);
	}
	//4000018h - BG2HOFS - BG2 X-Offset (W)
	this.writeIO[0x18] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2XCoord = (parentObj.gfx.BG2XCoord & 0x100) | data;
	}
	//4000019h - BG2HOFS - BG2 X-Offset (W)
	this.writeIO[0x19] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2XCoord = ((data & 0x01) << 8) | (parentObj.gfx.BG2XCoord & 0xFF);
	}
	//400001Ah - BG2VOFS - BG2 Y-Offset (W)
	this.writeIO[0x1A] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2YCoord = (parentObj.gfx.BG2YCoord & 0x100) | data;
	}
	//400001Bh - BG2VOFS - BG2 Y-Offset (W)
	this.writeIO[0x1B] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2YCoord = ((data & 0x01) << 8) | (parentObj.gfx.BG2YCoord & 0xFF);
	}
	//400001Ch - BG3HOFS - BG3 X-Offset (W)
	this.writeIO[0x1C] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3XCoord = (parentObj.gfx.BG3XCoord & 0x100) | data;
	}
	//400001Dh - BG3HOFS - BG3 X-Offset (W)
	this.writeIO[0x1D] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3XCoord = ((data & 0x01) << 8) | (parentObj.gfx.BG3XCoord & 0xFF);
	}
	//400001Eh - BG3VOFS - BG3 Y-Offset (W)
	this.writeIO[0x1E] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3YCoord = (parentObj.gfx.BG3YCoord & 0x100) | data;
	}
	//400001Fh - BG3VOFS - BG3 Y-Offset (W)
	this.writeIO[0x1F] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3YCoord = ((data & 0x01) << 8) | (parentObj.gfx.BG3YCoord & 0xFF);
	}
	//4000020h - BG2PA - BG2 Rotation/Scaling Parameter A (alias dx) (W)
	this.writeIO[0x20] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2dx = (parentObj.gfx.BG2dx & 0xFF00) | data;
		parentObj.memoryAccessType = 6;
	}
	//4000021h - BG2PA - BG2 Rotation/Scaling Parameter A (alias dx) (W)
	this.writeIO[0x21] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2dx = (data << 8) | (parentObj.gfx.BG2dx & 0xFF);
		parentObj.memoryAccessType = 6;
	}
	//4000022h - BG2PB - BG2 Rotation/Scaling Parameter B (alias dmx) (W)
	this.writeIO[0x22] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2dmx = (parentObj.gfx.BG2dmx & 0xFF00) | data;
		parentObj.memoryAccessType = 7;
	}
	//4000023h - BG2PB - BG2 Rotation/Scaling Parameter B (alias dmx) (W)
	this.writeIO[0x23] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2dmx = (data << 8) | (parentObj.gfx.BG2dmx & 0xFF);
		parentObj.memoryAccessType = 7;
	}
	//4000024h - BG2PC - BG2 Rotation/Scaling Parameter C (alias dy) (W)
	this.writeIO[0x24] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2dy = (parentObj.gfx.BG2dy & 0xFF00) | data;
		parentObj.memoryAccessType = 8;
	}
	//4000025h - BG2PC - BG2 Rotation/Scaling Parameter C (alias dy) (W)
	this.writeIO[0x25] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2dy = (data << 8) | (parentObj.gfx.BG2dy & 0xFF);
		parentObj.memoryAccessType = 8;
	}
	//4000026h - BG2PD - BG2 Rotation/Scaling Parameter D (alias dmy) (W)
	this.writeIO[0x26] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2dmy = (parentObj.gfx.BG2dmy & 0xFF00) | data;
		parentObj.memoryAccessType = 9;
	}
	//4000027h - BG2PD - BG2 Rotation/Scaling Parameter D (alias dmy) (W)
	this.writeIO[0x27] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2dmy = (data << 8) | (parentObj.gfx.BG2dmy & 0xFF);
		parentObj.memoryAccessType = 9;
	}
	//4000028h - BG2X_L - BG2 Reference Point X-Coordinate, lower 16 bit (W)
	this.writeIO[0x28] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2ReferenceX = (parentObj.gfx.BG2ReferenceX & 0xFFFFF00) | data;
		parentObj.memoryAccessType = 2;
	}
	//4000029h - BG2X_L - BG2 Reference Point X-Coordinate, lower 16 bit (W)
	this.writeIO[0x29] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2ReferenceX = (data << 8) | (parentObj.gfx.BG2ReferenceX & 0xFFF00FF);
		parentObj.memoryAccessType = 2;
	}
	//400002Ah - BG2X_H - BG2 Reference Point X-Coordinate, upper 12 bit (W)
	this.writeIO[0x2A] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2ReferenceX = (data << 16) | (parentObj.gfx.BG2ReferenceX & 0xF00FFFF);
		parentObj.memoryAccessType = 2;
	}
	//400002Bh - BG2X_H - BG2 Reference Point X-Coordinate, upper 12 bit (W)
	this.writeIO[0x2B] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2ReferenceX = ((data & 0xF) << 24) | (parentObj.gfx.BG2ReferenceX & 0xFFFFFF);
		parentObj.memoryAccessType = 2;
	}
	//400002Ch - BG2Y_L - BG2 Reference Point Y-Coordinate, lower 16 bit (W)
	this.writeIO[0x2C] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2ReferenceY = (parentObj.gfx.BG2ReferenceY & 0xFFFFF00) | data;
		parentObj.memoryAccessType = 3;
	}
	//400002Dh - BG2Y_L - BG2 Reference Point Y-Coordinate, lower 16 bit (W)
	this.writeIO[0x2D] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2ReferenceY = (data << 8) | (parentObj.gfx.BG2ReferenceY & 0xFFF00FF);
		parentObj.memoryAccessType = 3;
	}
	//400002Eh - BG2Y_H - BG2 Reference Point Y-Coordinate, upper 12 bit (W)
	this.writeIO[0x2E] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2ReferenceY = (data << 16) | (parentObj.gfx.BG2ReferenceY & 0xF00FFFF);
		parentObj.memoryAccessType = 3;
	}
	//400002Fh - BG2Y_H - BG2 Reference Point Y-Coordinate, upper 12 bit (W)
	this.writeIO[0x2F] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG2ReferenceY = ((data & 0xF) << 24) | (parentObj.gfx.BG2ReferenceY & 0xFFFFFF);
		parentObj.memoryAccessType = 3;
	}
	//4000030h - BG3PA - BG3 Rotation/Scaling Parameter A (alias dx) (W)
	this.writeIO[0x30] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3dx = (parentObj.gfx.BG3dx & 0xFF00) | data;
		parentObj.memoryAccessType = 10;
	}
	//4000031h - BG3PA - BG3 Rotation/Scaling Parameter A (alias dx) (W)
	this.writeIO[0x31] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3dx = (data << 8) | (parentObj.gfx.BG3dx & 0xFF);
		parentObj.memoryAccessType = 10;
	}
	//4000032h - BG3PB - BG3 Rotation/Scaling Parameter B (alias dmx) (W)
	this.writeIO[0x32] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3dmx = (parentObj.gfx.BG3dmx & 0xFF00) | data;
		parentObj.memoryAccessType = 11;
	}
	//4000033h - BG3PB - BG3 Rotation/Scaling Parameter B (alias dmx) (W)
	this.writeIO[0x33] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3dmx = (data << 8) | (parentObj.gfx.BG3dmx & 0xFF);
		parentObj.memoryAccessType = 11;
	}
	//4000034h - BG3PC - BG3 Rotation/Scaling Parameter C (alias dy) (W)
	this.writeIO[0x34] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3dy = (parentObj.gfx.BG3dy & 0xFF00) | data;
		parentObj.memoryAccessType = 12;
	}
	//4000035h - BG3PC - BG3 Rotation/Scaling Parameter C (alias dy) (W)
	this.writeIO[0x35] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3dy = (data << 8) | (parentObj.gfx.BG3dy & 0xFF);
		parentObj.memoryAccessType = 12;
	}
	//4000036h - BG3PD - BG3 Rotation/Scaling Parameter D (alias dmy) (W)
	this.writeIO[0x36] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3dmy = (parentObj.gfx.BG3dmy & 0xFF00) | data;
		parentObj.memoryAccessType = 13;
	}
	//4000037h - BG3PD - BG3 Rotation/Scaling Parameter D (alias dmy) (W)
	this.writeIO[0x37] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3dmy = (data << 8) | (parentObj.gfx.BG3dmy & 0xFF);
		parentObj.memoryAccessType = 13;
	}
	//4000038h - BG3X_L - BG3 Reference Point X-Coordinate, lower 16 bit (W)
	this.writeIO[0x38] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3ReferenceX = (parentObj.gfx.BG3ReferenceX & 0xFFFFF00) | data;
		parentObj.memoryAccessType = 4;
	}
	//4000039h - BG3X_L - BG3 Reference Point X-Coordinate, lower 16 bit (W)
	this.writeIO[0x39] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3ReferenceX = (data << 8) | (parentObj.gfx.BG3ReferenceX & 0xFFF00FF);
		parentObj.memoryAccessType = 4;
	}
	//400003Ah - BG3X_H - BG3 Reference Point X-Coordinate, upper 12 bit (W)
	this.writeIO[0x3A] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3ReferenceX = (data << 16) | (parentObj.gfx.BG3ReferenceX & 0xF00FFFF);
		parentObj.memoryAccessType = 4;
	}
	//400003Bh - BG3X_H - BG3 Reference Point X-Coordinate, upper 12 bit (W)
	this.writeIO[0x3B] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3ReferenceX = ((data & 0xF) << 24) | (parentObj.gfx.BG3ReferenceX & 0xFFFFFF);
		parentObj.memoryAccessType = 4;
	}
	//400003Ch - BG3Y_L - BG3 Reference Point Y-Coordinate, lower 16 bit (W)
	this.writeIO[0x3C] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3ReferenceY = (parentObj.gfx.BG3ReferenceY & 0xFFFFF00) | data;
		parentObj.memoryAccessType = 5;
	}
	//400003Dh - BGY_L - BG3 Reference Point Y-Coordinate, lower 16 bit (W)
	this.writeIO[0x3D] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3ReferenceY = (data << 8) | (parentObj.gfx.BG3ReferenceY & 0xFFF00FF);
		parentObj.memoryAccessType = 5;
	}
	//400003Eh - BG3Y_H - BG3 Reference Point Y-Coordinate, upper 12 bit (W)
	this.writeIO[0x3E] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3ReferenceY = (data << 16) | (parentObj.gfx.BG3ReferenceY & 0xF00FFFF);
		parentObj.memoryAccessType = 5;
	}
	//400003Fh - BG3Y_H - BG3 Reference Point Y-Coordinate, upper 12 bit (W)
	this.writeIO[0x3F] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BG3ReferenceY = ((data & 0xF) << 24) | (parentObj.gfx.BG3ReferenceY & 0xFFFFFF);
		parentObj.memoryAccessType = 5;
	}
	//4000040h - WIN0H - Window 0 Horizontal Dimensions (W)
	this.writeIO[0x40] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.WIN0XCoordRight = data;	//Window x-coord goes up to this minus 1.
	}
	//4000041h - WIN0H - Window 0 Horizontal Dimensions (W)
	this.writeIO[0x41] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.WIN0XCoordLeft = data;
	}
	//4000042h - WIN1H - Window 1 Horizontal Dimensions (W)
	this.writeIO[0x42] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.WIN1XCoordRight = data;	//Window x-coord goes up to this minus 1.
	}
	//4000043h - WIN1H - Window 1 Horizontal Dimensions (W)
	this.writeIO[0x43] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.WIN1XCoordLeft = data;
	}
	//4000044h - WIN0V - Window 0 Vertical Dimensions (W)
	this.writeIO[0x44] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.WIN0XCoordBottom = data;	//Window y-coord goes up to this minus 1.
	}
	//4000045h - WIN0V - Window 0 Vertical Dimensions (W)
	this.writeIO[0x45] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.WIN0XCoordTop = data;
	}
	//4000046h - WIN1V - Window 1 Vertical Dimensions (W)
	this.writeIO[0x46] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.WIN1XCoordBottom = data;	//Window y-coord goes up to this minus 1.
	}
	//4000047h - WIN1V - Window 1 Vertical Dimensions (W)
	this.writeIO[0x47] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.WIN1XCoordTop = data;
	}
	//4000048h - WININ - Control of Inside of Window(s) (R/W)
	this.writeIO[0x48] = function (parentObj, data) {
		//Window 0:
		parentObj.gfx.JIT();
		parentObj.gfx.WIN0BG0 = ((data & 0x01) == 0x01);
		parentObj.gfx.WIN0BG1 = ((data & 0x02) == 0x02);
		parentObj.gfx.WIN0BG2 = ((data & 0x04) == 0x04);
		parentObj.gfx.WIN0BG3 = ((data & 0x08) == 0x08);
		parentObj.gfx.WIN0OBJ = ((data & 0x10) == 0x10);
		parentObj.gfx.WIN0Effects = ((data & 0x20) == 0x20);
	}
	//4000049h - WININ - Control of Inside of Window(s) (R/W)
	this.writeIO[0x49] = function (parentObj, data) {
		//Window 1:
		parentObj.gfx.JIT();
		parentObj.gfx.WIN1BG0 = ((data & 0x01) == 0x01);
		parentObj.gfx.WIN1BG1 = ((data & 0x02) == 0x02);
		parentObj.gfx.WIN1BG2 = ((data & 0x04) == 0x04);
		parentObj.gfx.WIN1BG3 = ((data & 0x08) == 0x08);
		parentObj.gfx.WIN1OBJ = ((data & 0x10) == 0x10);
		parentObj.gfx.WIN1Effects = ((data & 0x20) == 0x20);
	}
	//400004Ah- WINOUT - Control of Outside of Windows & Inside of OBJ Window (R/W)
	this.writeIO[0x4A] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.WINBG0Outside = ((data & 0x01) == 0x01);
		parentObj.gfx.WINBG1Outside = ((data & 0x02) == 0x02);
		parentObj.gfx.WINBG2Outside = ((data & 0x04) == 0x04);
		parentObj.gfx.WINBG3Outside = ((data & 0x08) == 0x08);
		parentObj.gfx.WINOBJOutside = ((data & 0x10) == 0x10);
		parentObj.gfx.WINEffectsOutside = ((data & 0x20) == 0x20);
	}
	//400004AB- WINOUT - Control of Outside of Windows & Inside of OBJ Window (R/W)
	this.writeIO[0x4B] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.WINOBJBG0Outside = ((data & 0x01) == 0x01);
		parentObj.gfx.WINOBJBG1Outside = ((data & 0x02) == 0x02);
		parentObj.gfx.WINOBJBG2Outside = ((data & 0x04) == 0x04);
		parentObj.gfx.WINOBJBG3Outside = ((data & 0x08) == 0x08);
		parentObj.gfx.WINOBJOBJOutside = ((data & 0x10) == 0x10);
		parentObj.gfx.WINOBJEffectsOutside = ((data & 0x20) == 0x20);
	}
	//400004Ch - MOSAIC - Mosaic Size (W)
	this.writeIO[0x4C] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.BGMosaicHSize = data & 0xF;
		parentObj.gfx.BGMosaicVSize = data >> 4;
	}
	//400004Dh - MOSAIC - Mosaic Size (W)
	this.writeIO[0x4D] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.OBJMosaicHSize = data & 0xF;
		parentObj.gfx.OBJMosaicVSize = data >> 4;
	}
	//400004Eh - NOT USED - ZERO
	this.writeIO[0x4E] = this.NOP;
	//400004Fh - NOT USED - ZERO
	this.writeIO[0x4F] = this.NOP;
	//4000050h - BLDCNT - Color Special Effects Selection (R/W)
	this.writeIO[0x50] = function (parentObj, data) {
		//Select target 1 and color effects mode:
		parentObj.gfx.JIT();
		parentObj.gfx.BG0EffectsTarget1 = ((data & 0x01) == 0x01);
		parentObj.gfx.BG1EffectsTarget1 = ((data & 0x02) == 0x02);
		parentObj.gfx.BG2EffectsTarget1 = ((data & 0x04) == 0x04);
		parentObj.gfx.BG3EffectsTarget1 = ((data & 0x08) == 0x08);
		parentObj.gfx.OBJEffectsTarget1 = ((data & 0x10) == 0x10);
		parentObj.gfx.BackdropEffectsTarget1 = ((data & 0x20) == 0x20);
		parentObj.gfx.colorEffectsType = data >> 6;
	}
	//4000051h - BLDCNT - Color Special Effects Selection (R/W)
	this.writeIO[0x51] = function (parentObj, data) {
		//Select target 2:
		parentObj.gfx.JIT();
		parentObj.gfx.BG0EffectsTarget2 = ((data & 0x01) == 0x01);
		parentObj.gfx.BG1EffectsTarget2 = ((data & 0x02) == 0x02);
		parentObj.gfx.BG2EffectsTarget2 = ((data & 0x04) == 0x04);
		parentObj.gfx.BG3EffectsTarget2 = ((data & 0x08) == 0x08);
		parentObj.gfx.OBJEffectsTarget2 = ((data & 0x10) == 0x10);
		parentObj.gfx.BackdropEffectsTarget2 = ((data & 0x20) == 0x20);
	}
	//4000052h - BLDALPHA - Alpha Blending Coefficients (W)
	this.writeIO[0x52] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.alphaBlendAmountTarget1 = data & 0x1F;
	}
	//4000053h - BLDALPHA - Alpha Blending Coefficients (W)
	this.writeIO[0x53] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.alphaBlendAmountTarget2 = data & 0x1F;
	}
	//4000054h - BLDY - Brightness (Fade-In/Out) Coefficient (W)
	this.writeIO[0x54] = function (parentObj, data) {
		parentObj.gfx.JIT();
		parentObj.gfx.brightnessEffectAmount = data & 0x1F;
	}
	//4000055h - BLDY - Brightness (Fade-In/Out) Coefficient (W)
	this.writeIO[0x55] = this.NOP;
	//4000056h - NOT USED - ZERO
	this.writeIO[0x56] = this.NOP;
	//4000057h - NOT USED - ZERO
	this.writeIO[0x57] = this.NOP;
	//4000058h - NOT USED - GLITCHED
	this.writeIO[0x58] = this.NOP;
	//4000059h - NOT USED - GLITCHED
	this.writeIO[0x59] = this.NOP;
	//400005Ah - NOT USED - GLITCHED
	this.writeIO[0x5A] = this.NOP;
	//400005Bh - NOT USED - GLITCHED
	this.writeIO[0x5B] = this.NOP;
	//400005Ch - NOT USED - GLITCHED
	this.writeIO[0x5C] = this.NOP;
	//400005Dh - NOT USED - GLITCHED
	this.writeIO[0x5D] = this.NOP;
	//400005Eh - NOT USED - GLITCHED
	this.writeIO[0x5E] = this.NOP;
	//400005Fh - NOT USED - GLITCHED
	this.writeIO[0x5F] = this.NOP;
	//4000060h - SOUND1CNT_L (NR10) - Channel 1 Sweep register (R/W)
	this.writeIO[0x60] = function (parentObj, data) {
		//NR10:
		parentObj.sound.NR10(data);
	}
	//4000061h - NOT USED - ZERO
	this.writeIO[0x61] = this.NOP;
	//4000062h - SOUND1CNT_H (NR11, NR12) - Channel 1 Duty/Len/Envelope (R/W)
	this.writeIO[0x62] = function (parentObj, data) {
		//NR11:
		parentObj.sound.NR11(data);
	}
	//4000063h - SOUND1CNT_H (NR11, NR12) - Channel 1 Duty/Len/Envelope (R/W)
	this.writeIO[0x63] = function (parentObj, data) {
		//NR12:
		parentObj.sound.NR12(data);
	}
	//4000064h - SOUND1CNT_X (NR13, NR14) - Channel 1 Frequency/Control (R/W)
	this.writeIO[0x64] = function (parentObj, data) {
		//NR13:
		parentObj.sound.NR13(data);
	}
	//4000065h - SOUND1CNT_X (NR13, NR14) - Channel 1 Frequency/Control (R/W)
	this.writeIO[0x65] = function (parentObj, data) {
		//NR14:
		parentObj.sound.NR14(data);
	}
	//4000066h - NOT USED - ZERO
	this.writeIO[0x66] = this.NOP;
	//4000067h - NOT USED - ZERO
	this.writeIO[0x67] = this.NOP;
	//4000068h - SOUND2CNT_L (NR21, NR22) - Channel 2 Duty/Length/Envelope (R/W)
	this.writeIO[0x68] = function (parentObj, data) {
		//NR21:
		parentObj.sound.NR21(data);
	}
	//4000069h - SOUND2CNT_L (NR21, NR22) - Channel 2 Duty/Length/Envelope (R/W)
	this.writeIO[0x69] = function (parentObj, data) {
		//NR22:
		parentObj.sound.NR22(data);
	}
	//400006Ah - NOT USED - ZERO
	this.writeIO[0x6A] = this.NOP;
	//400006Bh - NOT USED - ZERO
	this.writeIO[0x6B] = this.NOP;
	//400006Ch - SOUND2CNT_H (NR23, NR24) - Channel 2 Frequency/Control (R/W)
	this.writeIO[0x6C] = function (parentObj, data) {
		//NR23:
		parentObj.sound.NR23(data);
	}
	//400006Dh - SOUND2CNT_H (NR23, NR24) - Channel 2 Frequency/Control (R/W)
	this.writeIO[0x6D] = function (parentObj, data) {
		//NR24:
		parentObj.sound.NR24(data);
	}
	//400006Eh - NOT USED - ZERO
	this.writeIO[0x6E] = this.NOP;
	//400006Fh - NOT USED - ZERO
	this.writeIO[0x6F] = this.NOP;
	//4000070h - SOUND3CNT_L (NR30) - Channel 3 Stop/Wave RAM select (R/W)
	this.writeIO[0x70] = function (parentObj, data) {
		//NR30:
		parentObj.sound.NR30(data);
	}
	//4000071h - SOUND3CNT_L (NR30) - Channel 3 Stop/Wave RAM select (R/W)
	this.writeIO[0x71] = this.NOP;
	//4000072h - SOUND3CNT_H (NR31, NR32) - Channel 3 Length/Volume (R/W)
	this.writeIO[0x72] = function (parentObj, data) {
		//NR31:
		parentObj.sound.NR31(data);
	}
	//4000073h - SOUND3CNT_H (NR31, NR32) - Channel 3 Length/Volume (R/W)
	this.writeIO[0x73] = function (parentObj, data) {
		//NR32:
		parentObj.sound.NR32(data);
	}
	//4000074h - SOUND3CNT_X (NR33, NR34) - Channel 3 Frequency/Control (R/W)
	this.writeIO[0x74] = function (parentObj, data) {
		//NR33:
		parentObj.sound.NR33(data);
	}
	//4000075h - SOUND3CNT_X (NR33, NR34) - Channel 3 Frequency/Control (R/W)
	this.writeIO[0x75] = function (parentObj, data) {
		//NR34:
		parentObj.sound.NR34(data);
	}
	//4000076h - NOT USED - ZERO
	this.writeIO[0x76] = this.NOP;
	//4000077h - NOT USED - ZERO
	this.writeIO[0x77] = this.NOP;
}
GameBoyAdvanceIO.prototype.compileIOReadDispatch = function () {
	this.readIO = [];
	//4000000h - DISPCNT - LCD Control (Read/Write)
	this.readIO[0] = function (parentObj, address) {
		return (parentObj.gfx.BGMode |
		(parentObj.gfx.frameSelect << 4) |
		(parentObj.gfx.HBlankIntervalFree ? 0x20 : 0) | 
		(parentObj.gfx.VRAMOneDimensional ? 0x40 : 0) |
		(parentObj.gfx.forcedBlank ? 0x80 : 0));
	}
	//4000001h - DISPCNT - LCD Control (Read/Write)
	this.readIO[0x1] = function (parentObj, address) {
		return ((parentObj.gfx.displayBG0 ? 0x1 : 0) |
		(parentObj.gfx.displayBG1 ? 0x2 : 0) |
		(parentObj.gfx.displayBG2 ? 0x4 : 0) |
		(parentObj.gfx.displayBG3 ? 0x8 : 0) |
		(parentObj.gfx.displayOBJ ? 0x10 : 0) |
		(parentObj.gfx.displayWindow0Flag ? 0x20 : 0) |
		(parentObj.gfx.displayWindow1Flag ? 0x40 : 0) |
		(parentObj.gfx.displayObjectWindowFlag ? 0x80 : 0));
	}
	//4000002h - Undocumented - Green Swap (R/W)
	this.readIO[0x2] = function (parentObj, address) {
		return (parentObj.gfx.greenSwap ? 0x1 : 0);
	}
	//4000003h - Undocumented - Green Swap (R/W)
	this.readIO[0x3] = this.readZero;
	//4000004h - DISPSTAT - General LCD Status (Read/Write)
	this.readIO[0x4] = function (parentObj, address) {
		return ((parentObj.gfx.inVBlank ? 0x1 : 0) |
		(parentObj.gfx.inHBlank ? 0x2 : 0) |
		(parentObj.gfx.VCounterMatch ? 0x4 : 0) |
		(parentObj.gfx.IRQVBlank ? 0x8 : 0) |
		(parentObj.gfx.IRQHBlank ? 0x10 : 0) |
		(parentObj.gfx.IRQVCounter ? 0x20 : 0));
	}
	//4000005h - DISPSTAT - General LCD Status (Read/Write)
	this.readIO[0x5] = function (parentObj, address) {
		return parentObj.gfx.VCounter;
	}
	//4000006h - VCOUNT - Vertical Counter (Read only)
	this.readIO[0x6] = function (parentObj, address) {
		return parentObj.gfx.currentScanLine;
	}
	//4000007h - VCOUNT - Vertical Counter (Read only)
	this.readIO[0x7] = this.readZero;
	//4000008h - BG0CNT - BG0 Control (R/W) (BG Modes 0,1 only)
	this.readIO[0x8] = function (parentObj, address) {
		return (parentObj.gfx.BG0Priority |
		(parentObj.gfx.BG0CharacterBaseBlock << 2) |
		(parentObj.gfx.BG0Mosaic ? 0x40 : 0) | 
		(parentObj.gfx.BG0Palette256 ? 0x80 : 0));
	}
	//4000009h - BG0CNT - BG0 Control (R/W) (BG Modes 0,1 only)
	this.readIO[0x9] = function (parentObj, address) {
		return (parentObj.gfx.BG0ScreenBaseBlock |
		(parentObj.gfx.BG0DisplayOverflow ? 0x20 : 0) |
		(parentObj.gfx.BG0ScreenSize << 6));
	}
	//400000Ah - BG1CNT - BG1 Control (R/W) (BG Modes 0,1 only)
	this.readIO[0xA] = function (parentObj, address) {
		return (parentObj.gfx.BG1Priority |
		(parentObj.gfx.BG1CharacterBaseBlock << 2) |
		(parentObj.gfx.BG1Mosaic ? 0x40 : 0) | 
		(parentObj.gfx.BG1Palette256 ? 0x80 : 0));
	}
	//400000Bh - BG1CNT - BG1 Control (R/W) (BG Modes 0,1 only)
	this.readIO[0xB] = function (parentObj, address) {
		return (parentObj.gfx.BG1ScreenBaseBlock |
		(parentObj.gfx.BG1DisplayOverflow ? 0x20 : 0) |
		(parentObj.gfx.BG1ScreenSize << 6));
	}
	//400000Ch - BG2CNT - BG2 Control (R/W) (BG Modes 0,1,2 only)
	this.readIO[0xC] = function (parentObj, address) {
		return (parentObj.gfx.BG2Priority |
		(parentObj.gfx.BG2CharacterBaseBlock << 2) |
		(parentObj.gfx.BG2Mosaic ? 0x40 : 0) | 
		(parentObj.gfx.BG2Palette256 ? 0x80 : 0));
	}
	//400000Dh - BG2CNT - BG2 Control (R/W) (BG Modes 0,1,2 only)
	this.readIO[0xD] = function (parentObj, address) {
		return (parentObj.gfx.BG2ScreenBaseBlock |
		(parentObj.gfx.BG2DisplayOverflow ? 0x20 : 0) |
		(parentObj.gfx.BG2ScreenSize << 6));
	}
	//400000Eh - BG3CNT - BG3 Control (R/W) (BG Modes 0,2 only)
	this.readIO[0xE] = function (parentObj, address) {
		return (parentObj.gfx.BG3Priority |
		(parentObj.gfx.BG3CharacterBaseBlock << 2) |
		(parentObj.gfx.BG3Mosaic ? 0x40 : 0) | 
		(parentObj.gfx.BG3Palette256 ? 0x80 : 0));
	}
	//400000Fh - BG3CNT - BG3 Control (R/W) (BG Modes 0,2 only)
	this.readIO[0xF] = function (parentObj, address) {
		return (parentObj.gfx.BG3ScreenBaseBlock |
		(parentObj.gfx.BG3DisplayOverflow ? 0x20 : 0) |
		(parentObj.gfx.BG3ScreenSize << 6));
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
	//4000020h - BG2PA - BG2 Rotation/Scaling Parameter A (alias dx) (W)
	this.readIO[0x20] = this.readZero;
	//4000021h - BG2PA - BG2 Rotation/Scaling Parameter A (alias dx) (W)
	this.readIO[0x21] = this.readZero;
	//4000022h - BG2PB - BG2 Rotation/Scaling Parameter B (alias dmx) (W)
	this.readIO[0x22] = this.readZero;
	//4000023h - BG2PB - BG2 Rotation/Scaling Parameter B (alias dmx) (W)
	this.readIO[0x23] = this.readZero;
	//4000024h - BG2PC - BG2 Rotation/Scaling Parameter C (alias dy) (W)
	this.readIO[0x24] = this.readZero;
	//4000025h - BG2PC - BG2 Rotation/Scaling Parameter C (alias dy) (W)
	this.readIO[0x25] = this.readZero;
	//4000026h - BG2PD - BG2 Rotation/Scaling Parameter D (alias dmy) (W)
	this.readIO[0x26] = this.readZero;
	//4000027h - BG2PD - BG2 Rotation/Scaling Parameter D (alias dmy) (W)
	this.readIO[0x27] = this.readZero;
	//4000028h - BG2X_L - BG2 Reference Point X-Coordinate, lower 16 bit (W)
	this.readIO[0x28] = this.readZero;
	//4000029h - BG2X_L - BG2 Reference Point X-Coordinate, lower 16 bit (W)
	this.readIO[0x29] = this.readZero;
	//400002Ah - BG2X_H - BG2 Reference Point X-Coordinate, upper 12 bit (W)
	this.readIO[0x2A] = this.readZero;
	//400002Bh - BG2X_H - BG2 Reference Point X-Coordinate, upper 12 bit (W)
	this.readIO[0x2B] = this.readZero;
	//400002Ch - BG2Y_L - BG2 Reference Point Y-Coordinate, lower 16 bit (W)
	this.readIO[0x2C] = this.readZero;
	//400002Dh - BG2Y_L - BG2 Reference Point Y-Coordinate, lower 16 bit (W)
	this.readIO[0x2D] = this.readZero;
	//400002Eh - BG2Y_H - BG2 Reference Point Y-Coordinate, upper 12 bit (W)
	this.readIO[0x2E] = this.readZero;
	//400002Fh - BG2Y_H - BG2 Reference Point Y-Coordinate, upper 12 bit (W)
	this.readIO[0x2F] = this.readZero;
	//4000030h - BG3PA - BG3 Rotation/Scaling Parameter A (alias dx) (W)
	this.readIO[0x30] = this.readZero;
	//4000031h - BG3PA - BG3 Rotation/Scaling Parameter A (alias dx) (W)
	this.readIO[0x31] = this.readZero;
	//4000032h - BG3PB - BG3 Rotation/Scaling Parameter B (alias dmx) (W)
	this.readIO[0x32] = this.readZero;
	//4000033h - BG3PB - BG3 Rotation/Scaling Parameter B (alias dmx) (W)
	this.readIO[0x33] = this.readZero;
	//4000034h - BG3PC - BG3 Rotation/Scaling Parameter C (alias dy) (W)
	this.readIO[0x34] = this.readZero;
	//4000035h - BG3PC - BG3 Rotation/Scaling Parameter C (alias dy) (W)
	this.readIO[0x35] = this.readZero;
	//4000036h - BG3PD - BG3 Rotation/Scaling Parameter D (alias dmy) (W)
	this.readIO[0x36] = this.readZero;
	//4000037h - BG3PD - BG3 Rotation/Scaling Parameter D (alias dmy) (W)
	this.readIO[0x37] = this.readZero;
	//4000038h - BG3X_L - BG3 Reference Point X-Coordinate, lower 16 bit (W)
	this.readIO[0x38] = this.readZero;
	//4000039h - BG3X_L - BG3 Reference Point X-Coordinate, lower 16 bit (W)
	this.readIO[0x39] = this.readZero;
	//400003Ah - BG3X_H - BG3 Reference Point X-Coordinate, upper 12 bit (W)
	this.readIO[0x3A] = this.readZero;
	//400003Bh - BG3X_H - BG3 Reference Point X-Coordinate, upper 12 bit (W)
	this.readIO[0x3B] = this.readZero;
	//400003Ch - BG3Y_L - BG3 Reference Point Y-Coordinate, lower 16 bit (W)
	this.readIO[0x3C] = this.readZero;
	//400003Dh - BGY_L - BG3 Reference Point Y-Coordinate, lower 16 bit (W)
	this.readIO[0x3D] = this.readZero;
	//400003Eh - BG3Y_H - BG3 Reference Point Y-Coordinate, upper 12 bit (W)
	this.readIO[0x3E] = this.readZero;
	//400003Fh - BG3Y_H - BG3 Reference Point Y-Coordinate, upper 12 bit (W)
	this.readIO[0x3F] = this.readZero;
	//4000040h - WIN0H - Window 0 Horizontal Dimensions (W)
	this.readIO[0x40] = this.readZero;
	//4000041h - WIN0H - Window 0 Horizontal Dimensions (W)
	this.readIO[0x41] = this.readZero;
	//4000042h - WIN1H - Window 1 Horizontal Dimensions (W)
	this.readIO[0x42] = this.readZero;
	//4000043h - WIN1H - Window 1 Horizontal Dimensions (W)
	this.readIO[0x43] = this.readZero;
	//4000044h - WIN0V - Window 0 Vertical Dimensions (W)
	this.readIO[0x44] = this.readZero;
	//4000045h - WIN0V - Window 0 Vertical Dimensions (W)
	this.readIO[0x45] = this.readZero;
	//4000046h - WIN1V - Window 1 Vertical Dimensions (W)
	this.readIO[0x46] = this.readZero;
	//4000047h - WIN1V - Window 1 Vertical Dimensions (W)
	this.readIO[0x47] = this.readZero;
	//4000048h - WININ - Control of Inside of Window(s) (R/W)
	this.readIO[0x48] = function (parentObj, address) {
		//Window 0:
		return ((parentObj.gfx.WIN0BG0 ? 0x1 : 0) |
		(parentObj.gfx.WIN0BG1 ? 0x2 : 0) |
		(parentObj.gfx.WIN0BG2 ? 0x4 : 0) |
		(parentObj.gfx.WIN0BG3 ? 0x8 : 0) |
		(parentObj.gfx.WIN0OBJ ? 0x10 : 0) |
		(parentObj.gfx.WIN0Effects ? 0x20 : 0));
	}
	//4000049h - WININ - Control of Inside of Window(s) (R/W)
	this.readIO[0x49] = function (parentObj, address) {
		//Window 1:
		return ((parentObj.gfx.WIN1BG0 ? 0x1 : 0) |
		(parentObj.gfx.WIN1BG1 ? 0x2 : 0) |
		(parentObj.gfx.WIN1BG2 ? 0x4 : 0) |
		(parentObj.gfx.WIN1BG3 ? 0x8 : 0) |
		(parentObj.gfx.WIN1OBJ ? 0x10 : 0) |
		(parentObj.gfx.WIN1Effects ? 0x20 : 0));
	}
	//400004Ah- WINOUT - Control of Outside of Windows & Inside of OBJ Window (R/W)
	this.readIO[0x4A] = function (parentObj, address, data) {
		return ((parentObj.gfx.WINBG0Outside ? 0x1 : 0) |
		(parentObj.gfx.WINBG1Outside ? 0x2 : 0) |
		(parentObj.gfx.WINBG2Outside ? 0x4 : 0) |
		(parentObj.gfx.WINBG3Outside ? 0x8 : 0) |
		(parentObj.gfx.WINOBJOutside ? 0x10 : 0) |
		(parentObj.gfx.WINEffectsOutside ? 0x20 : 0));
	}
	//400004AB- WINOUT - Control of Outside of Windows & Inside of OBJ Window (R/W)
	this.readIO[0x4B] = function (parentObj, address, data) {
		return ((parentObj.gfx.WINOBJBG0Outside ? 0x1 : 0) |
		(parentObj.gfx.WINOBJBG1Outside ? 0x2 : 0) |
		(parentObj.gfx.WINOBJBG2Outside ? 0x4 : 0) |
		(parentObj.gfx.WINOBJBG3Outside ? 0x8 : 0) |
		(parentObj.gfx.WINOBJOBJOutside ? 0x10 : 0) |
		(parentObj.gfx.WINOBJEffectsOutside ? 0x20 : 0));
	}
	//400004Ch - MOSAIC - Mosaic Size (W)
	this.readIO[0x4C] = this.readZero;
	//400004Dh - MOSAIC - Mosaic Size (W)
	this.readIO[0x4D] = this.readZero;
	//400004Eh - NOT USED - ZERO
	this.readIO[0x4E] = this.readZero;
	//400004Fh - NOT USED - ZERO
	this.readIO[0x4F] = this.readZero;
	//4000050h - BLDCNT - Color Special Effects Selection (R/W)
	this.readIO[0x50] = function (parentObj, address, data) {
		return ((parentObj.gfx.BG0EffectsTarget1 ? 0x1 : 0) |
		(parentObj.gfx.BG1EffectsTarget1 ? 0x2 : 0) |
		(parentObj.gfx.BG2EffectsTarget1 ? 0x4 : 0) |
		(parentObj.gfx.BG3EffectsTarget1 ? 0x8 : 0) |
		(parentObj.gfx.OBJEffectsTarget1 ? 0x10 : 0) |
		(parentObj.gfx.BackdropEffectsTarget1 ? 0x20 : 0) |
		(parentObj.gfx.colorEffectsType << 6));
	}
	//4000051h - BLDCNT - Color Special Effects Selection (R/W)
	this.readIO[0x51] = function (parentObj, address, data) {
		return ((parentObj.gfx.BG0EffectsTarget2 ? 0x1 : 0) |
		(parentObj.gfx.BG1EffectsTarget2 ? 0x2 : 0) |
		(parentObj.gfx.BG2EffectsTarget2 ? 0x4 : 0) |
		(parentObj.gfx.BG3EffectsTarget2 ? 0x8 : 0) |
		(parentObj.gfx.OBJEffectsTarget2 ? 0x10 : 0) |
		(parentObj.gfx.BackdropEffectsTarget2 ? 0x20 : 0));
	}
	//4000052h - BLDALPHA - Alpha Blending Coefficients (W)
	this.readIO[0x52] = this.readZero;
	//4000053h - BLDALPHA - Alpha Blending Coefficients (W)
	this.readIO[0x53] = this.readZero;
	//4000054h - BLDY - Brightness (Fade-In/Out) Coefficient (W)
	this.readIO[0x54] = this.readZero;
	//4000055h - BLDY - Brightness (Fade-In/Out) Coefficient (W)
	this.readIO[0x55] = this.readZero;
	//4000056h - NOT USED - ZERO
	this.readIO[0x56] = this.readZero;
	//4000057h - NOT USED - ZERO
	this.readIO[0x57] = this.readZero;
	//4000058h - NOT USED - GLITCHED
	this.readIO[0x58] = this.readUnused;
	//4000059h - NOT USED - GLITCHED
	this.readIO[0x59] = this.readUnused;
	//400005Ah - NOT USED - GLITCHED
	this.readIO[0x5A] = this.readUnused;
	//400005Bh - NOT USED - GLITCHED
	this.readIO[0x5B] = this.readUnused;
	//400005Ch - NOT USED - GLITCHED
	this.readIO[0x5C] = this.readUnused;
	//400005Dh - NOT USED - GLITCHED
	this.readIO[0x5D] = this.readUnused;
	//400005Eh - NOT USED - GLITCHED
	this.readIO[0x5E] = this.readUnused;
	//400005Fh - NOT USED - GLITCHED
	this.readIO[0x5F] = this.readUnused;
}
GameBoyAdvanceIO.prototype.compileMemoryAccessPostProcessDispatch = function () {
	/*
		Create dispatches for handling special memory access cases,
		for things like wait state clocking and graphics shadow registers being updated on write.
		This way we can specialize in edge timings and cases without performance loss.
	*/
	this.accessPostProcess8 = [];
	this.accessPostProcess16 = [];
	this.accessPostProcess32 = [];
	this.accessPostProcess8[0] = this.accessPostProcess16[0] = this.accessPostProcess32[0] = function (parentObj) {
		//Nothing to delay the clock or to run after memory access.
	}
	this.accessPostProcess8[1] = this.accessPostProcess16[1] = function (parentObj) {
		//External WRAM state:
		parentObj.emulatorCore.CPUClocks += parentObj.waitStateWRAM;
	}
	this.accessPostProcess32[1] = function (parentObj) {
		//External WRAM state:
		parentObj.emulatorCore.CPUClocks += parentObj.waitStateWRAMLong;
	}
	this.accessPostProcess8[2] = this.accessPostProcess16[2] = this.accessPostProcess32[2] = function (parentObj) {
		//Shadow Copy BG2 Reference Point X:
		parentObj.gfx.shadowCopyBG2ReferenceX();
	}
	this.accessPostProcess8[3] = this.accessPostProcess16[3] = this.accessPostProcess32[3] = function (parentObj) {
		//Shadow Copy BG2 Reference Point Y:
		parentObj.gfx.shadowCopyBG2ReferenceY();
	}
	this.accessPostProcess8[4] = this.accessPostProcess16[4] = this.accessPostProcess32[4] = function (parentObj) {
		//Shadow Copy BG3 Reference Point X:
		parentObj.gfx.shadowCopyBG3ReferenceX();
	}
	this.accessPostProcess8[5] = this.accessPostProcess16[5] = this.accessPostProcess32[5] = function (parentObj) {
		//Shadow Copy BG3 Reference Point Y:
		parentObj.gfx.shadowCopyBG3ReferenceY();
	}
	this.accessPostProcess8[6] = this.accessPostProcess16[6] = this.accessPostProcess32[6] = function (parentObj) {
		//Update the adjusted BG2 dx value:
		parentObj.gfx.updateBG2dxCache();
	}
	this.accessPostProcess8[7] = this.accessPostProcess16[7] = this.accessPostProcess32[7] = function (parentObj) {
		//Update the adjusted BG2 dmx value:
		parentObj.gfx.updateBG2dmxCache();
	}
	this.accessPostProcess8[8] = this.accessPostProcess16[8] = this.accessPostProcess32[8] = function (parentObj) {
		//Update the adjusted BG2 dy value:
		parentObj.gfx.updateBG2dyCache();
	}
	this.accessPostProcess8[9] = this.accessPostProcess16[9] = this.accessPostProcess32[9] = function (parentObj) {
		//Update the adjusted BG2 dmy value:
		parentObj.gfx.updateBG2dmyCache();
	}
	this.accessPostProcess8[10] = this.accessPostProcess16[10] = this.accessPostProcess32[10] = function (parentObj) {
		//Update the adjusted BG3 dx value:
		parentObj.gfx.updateBG3dxCache();
	}
	this.accessPostProcess8[11] = this.accessPostProcess16[11] = this.accessPostProcess32[11] = function (parentObj) {
		//Update the adjusted BG3 dmx value:
		parentObj.gfx.updateBG3dmxCache();
	}
	this.accessPostProcess8[12] = this.accessPostProcess16[12] = this.accessPostProcess32[12] = function (parentObj) {
		//Update the adjusted BG3 dy value:
		parentObj.gfx.updateBG3dyCache();
	}
	this.accessPostProcess8[13] = this.accessPostProcess16[13] = this.accessPostProcess32[13] = function (parentObj) {
		//Update the adjusted BG3 dmy value:
		parentObj.gfx.updateBG3dmyCache();
	}
}
GameBoyAdvanceIO.prototype.writeExternalWRAM = function (parentObj, address, data) {
	//External WRAM:
	parentObj.externalRAM[address & 0x3FFFF] = data;
	parentObj.memoryAccessType = 1;
}
GameBoyAdvanceIO.prototype.writeInternalWRAM = function (parentObj, address, data) {
	//Internal WRAM:
	parentObj.internalRAM[address & 0x7FFF] = data;
	parentObj.memoryAccessType = 0;
}
GameBoyAdvanceIO.prototype.writeIODispatch = function (parentObj, address, data) {
	parentObj.memoryAccessType = 0;
	if (address < 0x4000400) {
		//IO Write:
		parentObj.writeIO[address & 0x3FF](parentObj, address, data);
	}
	else if ((address & 0x4FF0800) == 0x4000800) {
		//WRAM wait state control:
		parentObj.writeConfigureWRAM(address, data);
	}
}
GameBoyAdvanceIO.prototype.NOP = function (parentObj, data) {
	//Ignore the data write...
}
GameBoyAdvanceIO.prototype.writeUnused = function (parentObj, address, data) {
	parentObj.memoryAccessType = 0;
	//Ignore the data write...
}
GameBoyAdvanceIO.prototype.writeConfigureWRAM = function (address, data) {
	switch (address & 0x3) {
		case 3:
			this.WRAMConfiguration[1] = data & 0x2F;
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
			this.waitStateWRAM = (0xF - (data & 0xF)) + 1;
			this.waitStateWRAMLong = (this.waitStateWRAM << 1) + 1;	//32 bits of data in two bus requests, so the wait stating occurs twice, with the extra clock being the second request.
			this.WRAMConfiguration[0] = data;
	}
}
GameBoyAdvanceIO.prototype.readBIOS = function (parentObj, address) {
	if (address < 0x4000) {
		parentObj.memoryAccessType = 0;
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
GameBoyAdvanceIO.prototype.readIODispatch = function (parentObj, address, data) {
	if (address < 0x4000400) {
		//IO Write:
		parentObj.memoryAccessType = 0;
		return parentObj.readIO[address & 0x3FF](parentObj, address);
	}
	else if ((address & 0x4FF0800) == 0x4000800) {
		//WRAM wait state control:
		parentObj.memoryAccessType = 0;
		return parentObj.readConfigureWRAM(address);
	}
	else {
		return parentObj.readUnused(parentObj, address);
	}
}
GameBoyAdvanceIO.prototype.readConfigureWRAM = function (address) {
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
GameBoyAdvanceIO.prototype.readZero = function (parentObj, address) {
	return 0;
}
GameBoyAdvanceIO.prototype.readUnused = function (parentObj, address) {
	parentObj.memoryAccessType = 0;
	return (parentObj.emulatorCore.fetch >>> ((address & 0x3) << 8)) & 0xFF;
}