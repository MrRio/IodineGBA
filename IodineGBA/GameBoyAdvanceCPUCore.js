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
}
GameBoyAdvanceCPU.prototype.executeIteration = function () {
	this.instructionHandle.executeIteration();
}
GameBoyAdvanceCPU.prototype.triggerIRQ = function () {
	return this.instructionHandle.raiseIRQException();
}
GameBoyAdvanceCPU.prototype.getCurrentFetchValue = function () {
	return this.instructionHandle.fetch;
}
GameBoyAdvanceCPU.prototype.performMUL32 = function (rs, rd) {
	/*
		We have to split up the 32 bit multiplication,
		as JavaScript does multiplication on the FPU
		as double floats, which drops the low bits
		rather than the high bits.
	*/
	var lowMul = (rs & 0xFFFF) * rd;
	var highMul = (rs >> 16) * rd;
	//Cut off bits above bit 31 and return with proper sign:
	return ((highMul << 16) + lowMul) & -1;
}