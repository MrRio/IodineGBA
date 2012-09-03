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
function GameBoyAdvanceCPU(IOCore) {
	this.IOCore = IOCore;
	this.wait = this.IOCore.wait;
	this.mul64ResultHigh = 0;	//Scratch MUL64.
	this.mul64ResultLow = 0;	//Scratch MUL64.
	this.initialize();
}
GameBoyAdvanceCPU.prototype.initialize = function () {
	this.initializeRegisters();
	this.ARM = new ARMInstructionSet(this);
	this.THUMB = new THUMBInstructionSet(this);
	this.instructionHandle = this.ARM;
}
GameBoyAdvanceCPU.prototype.initializeRegisters = function () {
	/*
		R0-R7 Are known as the low registers.
		R8-R12 Are the high registers.
		R13 is the stack pointer.
		R14 is the link register.
		R15 is the program counter.
		CPSR is the program status register.
		SPSR is the saved program status register.
	*/
	//Normal R0-R15 Registers:
	this.registers = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
	//Used to copy back the R8-R14 state for normal operations:
	this.registersUSR = [0,0,0,0,0,0,0];
	//Fast IRQ mode registers (R8-R14):
	this.registersFIQ = [0,0,0,0,0,0,0];
	//Supervisor mode registers (R13-R14):
	this.registersSVC = [0,0];
	//Abort mode registers (R13-R14):
	this.registersABT = [0,0];
	//IRQ mode registers (R13-R14):
	this.registersIRQ = [0,0];
	//Undefined mode registers (R13-R14):
	this.registersUND = [0,0];
	//Pre-initialize stack pointers if no BIOS loaded:
	if (!this.IOCore.BIOSFound) {
		this.registersSVC[0] = 0x3007FE0;
		this.registersIRQ[0] = 0x3007FA0;
		this.registers[13] = 0x3007F00;
	}
	//CPSR Register:
	this.CPSRNegative = false;		//N Bit
	this.CPSRZero = false;			//Z Bit
	this.CPSROverflow = false;		//V Bit
	this.CPSRCarry = false;			//C Bit
	this.IRQDisabled = true;		//I Bit
	this.FIQDisabled = true;		//F Bit
	this.InTHUMB = false;			//T Bit
	this.MODEBits = 0x13;			//M0 thru M4 Bits
	//Banked SPSR Registers:
	this.SPSRFIQ = [false, false, false, false, true, true, false, 0x13];	//FIQ
	this.SPSRIRQ = [false, false, false, false, true, true, false, 0x13];	//IRQ
	this.SPSRSVC = [false, false, false, false, true, true, false, 0x13];	//Supervisor
	this.SPSRABT = [false, false, false, false, true, true, false, 0x13];	//Abort
	this.SPSRUND = [false, false, false, false, true, true, false, 0x13];	//Undefined
	this.triggeredIRQ = false;		//Pending IRQ found.
	this.pipelineInvalid = 0x4;		//Mark pipeline as invalid.
}
GameBoyAdvanceCPU.prototype.executeIteration = function () {
	//Check for pending IRQ:
	this.checkPendingIRQ();
	//Tick the pipeline and bubble out invalidity:
	this.pipelineInvalid >>= 1;
	//Tick the pipeline of the selected instruction set:
	this.instructionHandle.executeIteration();
	//Increment the program counter if we didn't just branch:
	if (this.pipelineInvalid < 0x4) {
		this.instructionHandle.incrementProgramCounter();
	}
}
GameBoyAdvanceCPU.prototype.branch = function (branchTo) {
	if (branchTo > 0x3FFF || this.IOCore.BIOSFound) {
		//Branch to new address:
		this.registers[15] = branchTo;
		//Mark pipeline as invalid:
		this.pipelineInvalid = 0x4;
		//Next PC fetch has to update the address bus:
		this.wait.NonSequentialBroadcast();
	}
	else {
		//We're branching into BIOS, handle specially:
		switch (branchTo) {
			//IRQ mode exit handling:
			case 0x130:
				this.ARM.execute = 0xE8BD500F;
				this.ARM.LDMIAW(this, this.ARM.guardMultiRegisterWrite);
				this.ARM.execute = 0xE25EF004;
				this.ARM.SUBS(this, this.ARM.imm);
				break;
			default:
				throw(new Error("Could not handle branch to: " + branchTo.toString(16)));
		}
	}
}
GameBoyAdvanceCPU.prototype.checkPendingIRQ = function () {
	if (!this.IRQDisabled) {
		if (this.triggeredIRQ) {
			//Clear our Pending IRQ acknowledge:
			this.IOCore.irq.checkForIRQFire();
			//Branch for IRQ now:
			this.IRQ(this.instructionHandle.getLR());
		}
	}
}
GameBoyAdvanceCPU.prototype.triggerIRQ = function (didFire) {
	this.triggeredIRQ = didFire && !this.IRQDisabled;
}
GameBoyAdvanceCPU.prototype.getCurrentFetchValue = function () {
	return this.instructionHandle.fetch;
}
GameBoyAdvanceCPU.prototype.enterARM = function () {
	this.THUMBBitModify(false);
}
GameBoyAdvanceCPU.prototype.enterTHUMB = function () {
	this.THUMBBitModify(true);
}
GameBoyAdvanceCPU.prototype.getLR = function () {
	//Get the previous instruction address:
	return this.instructionHandle.getLR();
}
GameBoyAdvanceCPU.prototype.THUMBBitModify = function (isThumb) {
	this.InTHUMB = isThumb;
	if (isThumb) {
		this.instructionHandle = this.THUMB;
	}
	else {
		this.instructionHandle = this.ARM;
	}
}
GameBoyAdvanceCPU.prototype.IRQ = function () {
	if (!this.IRQDisabled) {
		//Mode bits are set to IRQ:
		this.switchMode(0x12);
		//Save link register:
		this.registers[14] = this.instructionHandle.getIRQLR();
		//Disable IRQ:
		this.IRQDisabled = true;
		if (this.IOCore.BIOSFound) {
			//IRQ exception vector:
			this.branch(0x18);
			//Exception always enter ARM mode:
			this.enterARM();
		}
		else {
			//Exception always enter ARM mode:
			this.enterARM();
			this.ARM.execute = 0xE92D500F;
			this.ARM.STMDBW(this, this.ARM.guardMultiRegisterRead);
			this.registers[0] = 0x4000000;
			//Save link register:
			this.registers[14] = 0x130;
			//Skip BIOS ROM processing:
			this.branch(0x3FFFFFC);
		}
	}
}
GameBoyAdvanceCPU.prototype.SWI = function () {
	if (this.IOCore.BIOSFound) {
		//Mode bits are set to SWI:
		this.switchMode(0x13);
		//Save link register:
		this.registers[14] = this.getLR();
		//SWI exception vector:
		this.branch(0x8);
		//Disable IRQ:
		this.IRQDisabled = true;
		//Exception always enter ARM mode:
		this.enterARM();
	}
	else {
		//TODO
	}
}
GameBoyAdvanceCPU.prototype.UNDEFINED = function () {
	//Only process undefined instruction if BIOS loaded:
	if (this.IOCore.BIOSFound) {
		//Mode bits are set to SWI:
		this.switchMode(0x1B);
		//Save link register:
		this.registers[14] = this.getLR();
		//SWI exception vector:
		this.branch(0x4);
		//Disable IRQ:
		this.IRQDisabled = true;
		//Exception always enter ARM mode:
		this.enterARM();
	}
}
GameBoyAdvanceCPU.prototype.SPSRtoCPSR = function () {
	//Used for leaving an exception and returning to the previous state:
	switch (this.MODEBits) {
		case 0x10:	//User
		case 0x1F:	//System
			return;
		case 0x11:	//FIQ
			var spsr = this.SPSRFIQ;
			break;
		case 0x12:	//IRQ
			var spsr = this.SPSRIRQ;
			break;
		case 0x13:	//Supervisor
			var spsr = this.SPSRSVC;
			break;
		case 0x17:	//Abort
			var spsr = this.SPSRABT;
			break;
		case 0x1B:	//Undefined
			var spsr = this.SPSRUND;
	}
	this.CPSRNegative = spsr[0];
	this.CPSRZero = spsr[1];
	this.CPSROverflow = spsr[2];
	this.CPSRCarry = spsr[3];
	this.IRQDisabled = spsr[4];
	this.FIQDisabled = spsr[5];
	this.THUMBBitModify(spsr[6]);
	this.switchRegisterBank(spsr[7]);
}
GameBoyAdvanceCPU.prototype.switchMode = function (newMode) {
	this.CPSRtoSPSR(newMode);
	this.switchRegisterBank(newMode);
}
GameBoyAdvanceCPU.prototype.CPSRtoSPSR = function (newMode) {
	//Used for leaving an exception and returning to the previous state:
	switch (newMode) {
		case 0x11:	//FIQ
			var spsr = this.SPSRFIQ;
			break;
		case 0x12:	//IRQ
			var spsr = this.SPSRIRQ;
			break;
		case 0x13:	//Supervisor
			var spsr = this.SPSRSVC;
			break;
		case 0x17:	//Abort
			var spsr = this.SPSRABT;
			break;
		case 0x1B:	//Undefined
			var spsr = this.SPSRUND;
		default:	//Any other mode does not have access here.
			return;
	}
	spsr[0] = this.CPSRNegative;
	spsr[1] = this.CPSRZero;
	spsr[2] = this.CPSROverflow;
	spsr[3] = this.CPSRCarry;
	spsr[4] = this.IRQDisabled;
	spsr[5] = this.FIQDisabled;
	spsr[6] = this.InTHUMB;
	spsr[7] = this.MODEBits;
}
GameBoyAdvanceCPU.prototype.switchRegisterBank = function (newMode) {
	switch (this.MODEBits) {
		case 0x10:
		case 0x1F:
			this.registersUSR[0] = this.registers[13];
			this.registersUSR[1] = this.registers[14];
			break;
		case 0x11:
			this.registersFIQ[0] = this.registers[8];
			this.registersFIQ[1] = this.registers[9];
			this.registersFIQ[2] = this.registers[10];
			this.registersFIQ[3] = this.registers[11];
			this.registersFIQ[4] = this.registers[12];
			this.registersFIQ[5] = this.registers[13];
			this.registersFIQ[6] = this.registers[14];
			break;
		case 0x12:
			this.registersIRQ[0] = this.registers[13];
			this.registersIRQ[1] = this.registers[14];
			break;
		case 0x13:
			this.registersSVC[0] = this.registers[13];
			this.registersSVC[1] = this.registers[14];
			break;
		case 0x17:
			this.registersABT[0] = this.registers[13];
			this.registersABT[1] = this.registers[14];
			break;
		case 0x1B:
			this.registersUND[0] = this.registers[13];
			this.registersUND[1] = this.registers[14];
	}
	switch (newMode) {
		case 0x10:
		case 0x1F:
			this.registers[13] = this.registersUSR[0];
			this.registers[14] = this.registersUSR[1];
			break;
		case 0x11:
			this.registers[8] = this.registersFIQ[0];
			this.registers[9] = this.registersFIQ[1];
			this.registers[10] = this.registersFIQ[2];
			this.registers[11] = this.registersFIQ[3];
			this.registers[12] = this.registersFIQ[4];
			this.registers[13] = this.registersFIQ[5];
			this.registers[14] = this.registersFIQ[6];
			break;
		case 0x12:
			this.registers[13] = this.registersIRQ[0];
			this.registers[14] = this.registersIRQ[1];
			break;
		case 0x13:
			this.registers[13] = this.registersSVC[0];
			this.registers[14] = this.registersSVC[1];
			break;
		case 0x17:
			this.registers[13] = this.registersABT[0];
			this.registers[14] = this.registersABT[1];
			break;
		case 0x1B:
			this.registers[13] = this.registersUND[0];
			this.registers[14] = this.registersUND[1];
	}
	this.MODEBits = newMode;
}
GameBoyAdvanceCPU.prototype.performMUL32 = function (rs, rd, MLAClocks) {
	//Predict the internal cycle time:
	if ((rd >>> 8) == 0 || (rd >>> 8) == 0xFFFFFF) {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 1 + MLAClocks);
	}
	else if ((rd >>> 16) == 0 || (rd >>> 16) == 0xFFFF) {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 2 + MLAClocks);
	}
	else if ((rd >>> 24) == 0 || (rd >>> 24) == 0xFF) {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 3 + MLAClocks);
	}
	else {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 4 + MLAClocks);
	}
	/*
		We have to split up the 32 bit multiplication,
		as JavaScript does multiplication on the FPU
		as double floats, which drops the low bits
		rather than the high bits.
	*/
	var lowMul = (rs & 0xFFFF) * rd;
	var highMul = (rs >> 16) * rd;
	//Cut off bits above bit 31 and return with proper sign:
	return ((highMul << 16) + lowMul) | 0;
}
GameBoyAdvanceCPU.prototype.performMUL64 = function (rs, rd) {
	//Predict the internal cycle time:
	if ((rd >>> 8) == 0 || (rd >>> 8) == 0xFFFFFF) {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 2);
	}
	else if ((rd >>> 16) == 0 || (rd >>> 16) == 0xFFFF) {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 3);
	}
	else if ((rd >>> 24) == 0 || (rd >>> 24) == 0xFF) {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 4);
	}
	else {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 5);
	}
	//Solve for the high word (Do FPU double divide to bring down high word into the low word):
	this.mul64ResultHigh = ((rs * rd) / 0x100000000) | 0;
	/*
		We have to split up the 32 bit multiplication,
		as JavaScript does multiplication on the FPU
		as double floats, which drops the low bits
		rather than the high bits.
	*/
	var lowMul = (rs & 0xFFFF) * rd;
	var highMul = (rs >> 16) * rd;
	//Cut off bits above bit 31 and return with proper sign:
	this.mul64ResultLow = ((highMul << 16) + lowMul) | 0;
}
GameBoyAdvanceCPU.prototype.performMLA64 = function (rs, rd, mlaHigh, mlaLow) {
	//Predict the internal cycle time:
	if ((rd >>> 8) == 0 || (rd >>> 8) == 0xFFFFFF) {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 3);
	}
	else if ((rd >>> 16) == 0 || (rd >>> 16) == 0xFFFF) {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 4);
	}
	else if ((rd >>> 24) == 0 || (rd >>> 24) == 0xFF) {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 5);
	}
	else {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 6);
	}
	//Solve for the high word (Do FPU double divide to bring down high word into the low word):
	this.mul64ResultHigh = ((((rs * rd) + mlaLow) / 0x100000000) + mlaHigh) | 0;
	/*
		We have to split up the 32 bit multiplication,
		as JavaScript does multiplication on the FPU
		as double floats, which drops the low bits
		rather than the high bits.
	*/
	var lowMul = (rs & 0xFFFF) * rd;
	var highMul = (rs >> 16) * rd;
	//Cut off bits above bit 31 and return with proper sign:
	this.mul64ResultLow = ((highMul << 16) + lowMul + mlaLow) | 0;
}
GameBoyAdvanceCPU.prototype.performUMUL64 = function (rs, rd) {
	//Predict the internal cycle time:
	if ((rd >>> 8) == 0) {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 2);
	}
	else if ((rd >>> 16) == 0) {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 3);
	}
	else if ((rd >>> 24) == 0) {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 4);
	}
	else {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 5);
	}
	//Type convert to uint32:
	rs >>>= 0;
	rd >>>= 0;
	//Solve for the high word (Do FPU double divide to bring down high word into the low word):
	this.mul64ResultHigh = ((rs * rd) / 0x100000000) | 0;
	/*
		We have to split up the 32 bit multiplication,
		as JavaScript does multiplication on the FPU
		as double floats, which drops the low bits
		rather than the high bits.
	*/
	var lowMul = (rs & 0xFFFF) * rd;
	var highMul = (rs >> 16) * rd;
	//Cut off bits above bit 31 and return with proper sign:
	this.mul64ResultLow = ((highMul << 16) + lowMul) | 0;
}
GameBoyAdvanceCPU.prototype.performUMLA64 = function (rs, rd, mlaHigh, mlaLow) {
	//Predict the internal cycle time:
	if ((rd >>> 8) == 0) {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 3);
	}
	else if ((rd >>> 16) == 0) {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 4);
	}
	else if ((rd >>> 24) == 0) {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 5);
	}
	else {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 6);
	}
	//Type convert to uint32:
	rs >>>= 0;
	rd >>>= 0;
	//Solve for the high word (Do FPU double divide to bring down high word into the low word):
	this.mul64ResultHigh = ((((rs * rd) + mlaLow) / 0x100000000) + mlaHigh) | 0;
	/*
		We have to split up the 32 bit multiplication,
		as JavaScript does multiplication on the FPU
		as double floats, which drops the low bits
		rather than the high bits.
	*/
	var lowMul = (rs & 0xFFFF) * rd;
	var highMul = (rs >> 16) * rd;
	//Cut off bits above bit 31 and return with proper sign:
	this.mul64ResultLow = ((highMul << 16) + lowMul + mlaLow) | 0;
}
GameBoyAdvanceCPU.prototype.write32 = function (address, data) {
	//Updating the address bus away from PC fetch:
	this.IOCore.wait.NonSequentialBroadcast();
	this.IOCore.memoryWrite32(address, data);
	//Updating the address bus back to PC fetch:
	this.IOCore.wait.NonSequentialBroadcast();
}
GameBoyAdvanceCPU.prototype.write16 = function (address, data) {
	//Updating the address bus away from PC fetch:
	this.IOCore.wait.NonSequentialBroadcast();
	this.IOCore.memoryWrite16(address, data);
	//Updating the address bus back to PC fetch:
	this.IOCore.wait.NonSequentialBroadcast();
}
GameBoyAdvanceCPU.prototype.write8 = function (address, data) {
	//Updating the address bus away from PC fetch:
	this.IOCore.wait.NonSequentialBroadcast();
	this.IOCore.memoryWrite8(address, data);
	//Updating the address bus back to PC fetch:
	this.IOCore.wait.NonSequentialBroadcast();
}
GameBoyAdvanceCPU.prototype.read32 = function (address) {
	//Updating the address bus away from PC fetch:
	this.IOCore.wait.NonSequentialBroadcast();
	var data = this.IOCore.memoryRead32(address);
	//Updating the address bus back to PC fetch:
	this.IOCore.wait.NonSequentialBroadcast();
	return data;
}
GameBoyAdvanceCPU.prototype.read16 = function (address) {
	//Updating the address bus away from PC fetch:
	this.IOCore.wait.NonSequentialBroadcast();
	var data = this.IOCore.memoryRead16(address);
	//Updating the address bus back to PC fetch:
	this.IOCore.wait.NonSequentialBroadcast();
	return data;
}
GameBoyAdvanceCPU.prototype.read8 = function (address) {
	//Updating the address bus away from PC fetch:
	this.IOCore.wait.NonSequentialBroadcast();
	var data = this.IOCore.memoryRead8(address);
	//Updating the address bus back to PC fetch:
	this.IOCore.wait.NonSequentialBroadcast();
	return data;
}