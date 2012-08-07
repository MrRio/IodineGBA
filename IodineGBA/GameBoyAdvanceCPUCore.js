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
	this.initialize();
}
GameBoyAdvanceCPU.prototype.initialize = function () {
	this.ARM = new ARMInstructionSet(this);
	this.THUMB = new THUMBInstructionSet(this);
	this.instructionHandle = this.ARM;
}
ARM7TDMI.prototype.initializeRegisters = function () {
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
	this.registers = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
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
	this.SPSRFIQ = [false, false, false, false, true, true, false];	//FIQ
	this.SPSRIRQ = [false, false, false, false, true, true, false];	//IRQ
	this.SPSRSVC = [false, false, false, false, true, true, false];	//Supervisor
	this.SPSRABT = [false, false, false, false, true, true, false];	//Abort
	this.SPSRUND = [false, false, false, false, true, true, false];	//Undefined
	this.triggeredIRQ = false;		//Pending IRQ found.
}
GameBoyAdvanceCPU.prototype.executeIteration = function () {
	//Check for pending IRQ:
	if (this.triggeredIRQ) {
		this.triggeredIRQ = false;
		this.IRQ(this.instructionHandle.getIRQLR());
	}
	//Tick the pipeline of the selected instruction set:
	this.instructionHandle.executeIteration();
}
GameBoyAdvanceCPU.prototype.triggerIRQ = function () {
	this.triggeredIRQ = !this.IRQDisabled;
}
GameBoyAdvanceCPU.prototype.getCurrentFetchValue = function () {
	return this.instructionHandle.fetch;
}
GameBoyAdvanceCPU.prototype.enterARM = function () {
	this.instructionHandle = this.ARM;
	this.instructionHandle.resetPipeline();
}
GameBoyAdvanceCPU.prototype.enterTHUMB = function () {
	this.instructionHandle = this.THUMB;
	this.instructionHandle.resetPipeline();
}
GameBoyAdvanceCPU.prototype.FIQ = function (LR) {
	if (!this.FIQDisabled) {
		//Exception always enter ARM mode:
		this.enterARM();
		//Save link register:
		this.registers[14] = LR;
		//FIQ exception vector:
		this.registers[15] = 0x1C;
		//Mode bits are set to FIQ:
		this.MODEBits = 0x11;
		//Disable IRQ:
		this.IRQDisabled = true;
		//Disable FIQ:
		this.FIQDisabled = true;
	}
}
GameBoyAdvanceCPU.prototype.IRQ = function (LR) {
	if (!this.IRQDisabled) {
		//Exception always enter ARM mode:
		this.enterARM();
		//Save link register:
		this.registers[14] = LR;
		//IRQ exception vector:
		this.registers[15] = 0x18;
		//Mode bits are set to IRQ:
		this.MODEBits = 0x12;
		//Disable IRQ:
		this.IRQDisabled = true;
	}
}
GameBoyAdvanceCPU.prototype.SWI = function (LR) {
	//Exception always enter ARM mode:
	this.enterARM();
	//Save link register:
	this.registers[14] = LR;
	//SWI enters the SVC vector:
	this.registers[15] = 0x8;
	//Mode bits are set to SVC:
	this.MODEBits = 0x13;
	//Disable IRQ:
	this.IRQDisabled = true;
}
GameBoyAdvanceCPU.prototype.UNDEFINED = function (LR) {
	//Exception always enter ARM mode:
	this.enterARM();
	//Save link register:
	this.registers[14] = LR;
	//Undefined exception vector:
	this.registers[15] = 0x4;
	//Mode bits are set to UNDEFINED:
	this.MODEBits = 0x1C;
	//Disable IRQ:
	this.IRQDisabled = true;
}
GameBoyAdvanceCPU.prototype.performMUL32 = function (rs, rd) {
	//Predict the internal cycle time:
	if ((rd >>> 8) == 0 || (rd >>> 8) == 0xFFFFFF) {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 1);
	}
	else if ((rd >>> 16) == 0 || (rd >>> 16) == 0xFFFF) {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 2);
	}
	else if ((rd >>> 24) == 0 || (rd >>> 24) == 0xFF) {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 3);
	}
	else {
		this.IOCore.wait.CPUInternalCyclePrefetch(this.instructionHandle.fetch, 4);
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
}
GameBoyAdvanceCPU.prototype.read32 = function (address) {
	//Updating the address bus away from PC fetch:
	this.IOCore.wait.NonSequentialBroadcast();
	this.IOCore.memoryRead32(address);
	//Updating the address bus back to PC fetch:
	this.IOCore.wait.NonSequentialBroadcast();
}
GameBoyAdvanceCPU.prototype.read16 = function (address) {
	//Updating the address bus away from PC fetch:
	this.IOCore.wait.NonSequentialBroadcast();
	this.IOCore.memoryRead16(address);
	//Updating the address bus back to PC fetch:
	this.IOCore.wait.NonSequentialBroadcast();
}
GameBoyAdvanceCPU.prototype.read8 = function (address) {
	//Updating the address bus away from PC fetch:
	this.IOCore.wait.NonSequentialBroadcast();
	this.IOCore.memoryRead8(address);
	//Updating the address bus back to PC fetch:
	this.IOCore.wait.NonSequentialBroadcast();
}