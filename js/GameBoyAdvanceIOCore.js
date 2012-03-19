function GameBoyAdvanceIO(emulatorCore) {
	//Reference to the emulator core:
	this.emulatorCore = emulatorCore;
	//Game Pak Wait State setting:
	this.waitStateGamePak = 0;
	//WRAM Settings:
	this.waitStateWRAM = 2;					//External WRAM 8 and 16 bit request wait states
	this.waitStateWRAMLong = 5;				//External WRAM 32 bit request (Due to 16 bit data bus) wait states.
	this.WRAMConfiguration = [0x20, 0xD];	//WRAM configuration control register current data.
	this.lastBIOSREAD = [0, 0, 0, 0];		//BIOS read bus last .
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
}
GameBoyAdvanceIO.prototype.writeExternalWRAM = function (parentObj, address, data) {
	if (address < 0x2040000) {
		//External WRAM:
		parentObj.waitStateType = 1;
		parentObj.externalRAM[address & 0x3FFFF] = data;
	}
	else {
		//Unused Memory Address:
		parentObj.waitStateType = 0;
	}
}
GameBoyAdvanceIO.prototype.writeInternalWRAM = function (parentObj, address, data) {
	parentObj.waitStateType = 0;
	if (address < 03x008000) {
		//Internal WRAM:
		parentObj.internalRAM[address & 0x7FFF] = data;
	}
}
GameBoyAdvanceIO.prototype.writeInternalWRAMMirrored = function (parentObj, address, data) {
	parentObj.waitStateType = 0;
	if (address < 0x2040000) {
		//Internal WRAM:
		parentObj.internalRAM[address & 0x7FFF] = data;
	}
}
GameBoyAdvanceIO.prototype.writeIO = function (parentObj, address, data) {
	parentObj.waitStateType = 0;
	if (address < 0x4000400) {
		//IO Write:
		parentObj.internalRAM[address & 0x7FFF](parentObj, address, data);
	}
	else if ((address & 0x4FF0800) == 0x4000800) {
		//WRAM wait state control:
		parentObj.configureWRAM(address, data);
	}
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
		case 0:
			this.WRAMConfiguration[0] = data & 0x2F;
			if ((data & 0x01) == 0) {
				this.memoryWriter[2] = ((data & 0x20) == 0x20) ? this.writeExternalWRAM : this.writeInternalWRAMMirrored;
				this.memoryReader[2] = ((data & 0x20) == 0x20) ? this.readExternalWRAM : this.readInternalWRAMMirrored;
				this.memoryWriter[3] = this.writeInternalWRAM;
				this.memoryReader[3] = this.readInternalWRAM;
			}
			else {
				this.memoryWriter[2] = this.memoryWriter[3] = this.writeUnused;
				this.memoryReader[2] = this.memoryReader[3] = this.readUnused;
			}
			break;
		case 3:
			this.waitStateWRAM = data + 1;
			this.waitStateWRAMLong = (this.waitStateWRAM << 1) + 1;
			this.WRAMConfiguration[1] = data;
	}
}
GameBoyAdvanceIO.prototype.readBIOS = function (parentObj, address, data) {
	if (address < 0x4000) {
		parentObj.waitStateType = 0;
		if (parentObj.emulatorCore.register[0x15] < 0x4000) {
			//If reading from BIOS while executing it:
			parentObj.lastBIOSREAD[address & 0x3] = parentObj.BIOS[address];
			return parentObj.BIOS[address];
		}
		else {
			//Not allowed to read from BIOS while executing outside of it:
			return parentObj.lastBIOSREAD[address & 0x3];
		}
	}
	else {
		return parentObj.readUnused(parentObj, address, data);
	}
}
GameBoyAdvanceIO.prototype.readUnused = function (parentObj, address, data) {
	parentObj.waitStateType = 0;
	return parentObj.emulatorCore.fetch >>> ((address & 0x3) << 8);
}