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
function THUMBInstructionSet(CPUCore) {
	this.CPUCore = CPUCore;
	this.initialize();
}
THUMBInstructionSet.prototype.initialize = function () {
	this.IOCore = this.CPUCore.IOCore;
	this.wait = this.IOCore.wait;
	this.registers = this.CPUCore.registers;
	this.fetch = 0;
	this.decode = 0;
	this.execute = 0;
	this.pipelineInvalid = 0x3;
	this.compileInstructionMap();
}
THUMBInstructionSet.prototype.resetPipeline = function () {
	this.pipelineInvalid = 0x3;
	//Next PC fetch has to update the address bus:
	this.wait.NonSequentialBroadcast();
	//Make sure we don't increment before our fetch:
	this.registers[15] = (this.registers[15] - 2) | 0;
}
THUMBInstructionSet.prototype.guardHighRegisterWrite = function (data) {
	var address = 0x8 | (this.execute & 0x7);
	//Guard high register writing, as it may cause a branch:
	this.registers[address] = data;
	if (address == 15) {
		//We performed a branch:
		this.resetPipeline();
	}
}
THUMBInstructionSet.prototype.writePC = function (data) {
	//We performed a branch:
	//Update the program counter to branch address:
	this.registers[15] = data & -2;
	//Flush Pipeline & Block PC Increment:
	this.resetPipeline();
}
THUMBInstructionSet.prototype.offsetPC = function (data) {
	//We performed a branch:
	//Update the program counter to branch address:
	this.registers[15] = (this.registers[15] + ((data << 24) >> 23)) | 0;
	//Flush Pipeline & Block PC Increment:
	this.resetPipeline();
}
THUMBInstructionSet.prototype.getIRQLR = function () {
	return (this.registers[15] - 4) | 0;
}
THUMBInstructionSet.prototype.executeIteration = function () {
	//Push the new fetch access:
	this.fetch = this.wait.CPUGetOpcode16(this.registers[15]);
	//Execute Instruction:
	this.executeTHUMB();
	//Increment The Program Counter:
	this.registers[15] = (this.registers[15] + 2) | 0;
	//Update the pipelining state:
	this.execute = this.decode;
	this.decode = this.fetch;
}
THUMBInstructionSet.prototype.executeTHUMB = function () {
	if (this.pipelineInvalid == 0) {
		//No condition code:
		this.instructionMap[this.execute >> 6](this);
	}
	else {
		//Tick the pipeline invalidation:
		this.pipelineInvalid >>= 1;
	}
}
THUMBInstructionSet.prototype.LSLimm = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var offset = (parentObj.execute >> 6) & 0x1F;
	if (offset > 0) {
		//CPSR Carry is set by the last bit shifted out:
		parentObj.CPUCore.CPSRCarry = (((source << (offset - 1)) & 0x80000000) != 0);
		//Perform shift:
		source <<= offset;
	}
	else {
		parentObj.CPUCore.CPSRCarry = false;
	}
	//Perform CPSR updates for N and Z (But not V):
	parentObj.CPUCore.CPSRNegative = (source < 0);
	parentObj.CPUCore.CPSRZero = (source == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = source;
}
THUMBInstructionSet.prototype.LSRimm = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var offset = (parentObj.execute >> 6) & 0x1F;
	if (offset > 0) {
		//CPSR Carry is set by the last bit shifted out:
		parentObj.CPUCore.CPSRCarry = (((source >>> (offset - 1)) & 0x1) != 0);
		//Perform shift:
		source >>>= offset;
	}
	else {
		parentObj.CPUCore.CPSRCarry = false;
	}
	//Perform CPSR updates for N and Z (But not V):
	parentObj.CPUCore.CPSRNegative = (source < 0);
	parentObj.CPUCore.CPSRZero = (source == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = source;
}
THUMBInstructionSet.prototype.ASRimm = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var offset = (parentObj.execute >> 6) & 0x1F;
	if (offset > 0) {
		//CPSR Carry is set by the last bit shifted out:
		parentObj.CPUCore.CPSRCarry = (((source >> (offset - 1)) & 0x1) != 0);
		//Perform shift:
		source >>= offset;
	}
	else {
		parentObj.CPUCore.CPSRCarry = false;
	}
	//Perform CPSR updates for N and Z (But not V):
	parentObj.CPUCore.CPSRNegative = (source < 0);
	parentObj.CPUCore.CPSRZero = (source == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = source;
}
THUMBInstructionSet.prototype.ADDreg = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var offset = parentObj.registers[(parentObj.execute >> 6) & 0x7];
	//Perform Addition:
	var dirtyResult = source + offset;
	parentObj.CPUCore.CPSRCarry = ((dirtyResult | 0) != dirtyResult);
	dirtyResult |= 0;
	parentObj.CPUCore.CPSROverflow = ((source ^ dirtyResult) < 0);
	parentObj.CPUCore.CPSRNegative = (dirtyResult < 0);
	parentObj.CPUCore.CPSRZero = (dirtyResult == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = dirtyResult;
}
THUMBInstructionSet.prototype.SUBreg = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var offset = parentObj.registers[(parentObj.execute >> 6) & 0x7];
	//Perform Subtraction:
	var dirtyResult = source - offset;
	parentObj.CPUCore.CPSRCarry = ((dirtyResult | 0) == dirtyResult);
	dirtyResult |= 0;
	parentObj.CPUCore.CPSROverflow = ((source ^ dirtyResult) < 0);
	parentObj.CPUCore.CPSRNegative = (dirtyResult < 0);
	parentObj.CPUCore.CPSRZero = (dirtyResult == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = dirtyResult;
}
THUMBInstructionSet.prototype.ADDimm3 = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var offset = (parentObj.execute >> 6) & 0x7;
	//Perform Addition:
	var dirtyResult = source + offset;
	parentObj.CPUCore.CPSRCarry = ((dirtyResult | 0) != dirtyResult);
	dirtyResult |= 0;
	parentObj.CPUCore.CPSROverflow = ((source ^ dirtyResult) < 0);
	parentObj.CPUCore.CPSRNegative = (dirtyResult < 0);
	parentObj.CPUCore.CPSRZero = (dirtyResult == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = dirtyResult;
}
THUMBInstructionSet.prototype.SUBimm3 = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var offset = (parentObj.execute >> 6) & 0x7;
	//Perform Subtraction:
	var dirtyResult = source - offset;
	parentObj.CPUCore.CPSRCarry = ((dirtyResult | 0) == dirtyResult);
	dirtyResult |= 0;
	parentObj.CPUCore.CPSROverflow = ((source ^ dirtyResult) < 0);
	parentObj.CPUCore.CPSRNegative = (dirtyResult < 0);
	parentObj.CPUCore.CPSRZero = (dirtyResult == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = dirtyResult;
}
THUMBInstructionSet.prototype.MOVimm8 = function (parentObj) {
	//Get the 8-bit value to move into the register:
	var result = parentObj.execute & 0xFF;
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register:
	parentObj.registers[(parentObj.execute >> 8) & 0x7] = result;
}
THUMBInstructionSet.prototype.CMPimm8 = function (parentObj) {
	//Compare an 8-bit immediate value with a register:
	var source = parentObj.registers[(parentObj.execute >> 8) & 0x7];
	var dirtyResult = source - (parentObj.execute & 0xFF);
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result == dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((source ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
}
THUMBInstructionSet.prototype.ADDimm8 = function (parentObj) {
	//Add an 8-bit immediate value with a register:
	var source = parentObj.registers[(parentObj.execute >> 8) & 0x7];
	var dirtyResult = source + (parentObj.execute & 0xFF);
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result != dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((source ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	parentObj.registers[(parentObj.execute >> 8) & 0x7] = result;
}
THUMBInstructionSet.prototype.SUBimm8 = function (parentObj) {
	//Subtract an 8-bit immediate value from a register:
	var source = parentObj.registers[(parentObj.execute >> 8) & 0x7];
	var dirtyResult = source - (parentObj.execute & 0xFF);
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result == dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((source ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	parentObj.registers[(parentObj.execute >> 8) & 0x7] = result;
}
THUMBInstructionSet.prototype.AND = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7];
	//Perform bitwise AND:
	var result = source & destination;
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = result;
}
THUMBInstructionSet.prototype.EOR = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7];
	//Perform bitwise EOR:
	var result = source ^ destination;
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = result;
}
THUMBInstructionSet.prototype.LSL = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7] & 0x1F;
	if (destination > 0) {
		//CPSR Carry is set by the last bit shifted out:
		parentObj.CPUCore.CPSRCarry = (((source << (destination - 1)) & 0x80000000) != 0);
		//Perform shift:
		source <<= destination;
	}
	else {
		parentObj.CPUCore.CPSRCarry = false;
	}
	//Perform CPSR updates for N and Z (But not V):
	parentObj.CPUCore.CPSRNegative = (source < 0);
	parentObj.CPUCore.CPSRZero = (source == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = source;
}
THUMBInstructionSet.prototype.LSR = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7] & 0x1F;
	if (destination > 0) {
		//CPSR Carry is set by the last bit shifted out:
		parentObj.CPUCore.CPSRCarry = (((source >>> (destination - 1)) & 0x1) != 0);
		//Perform shift:
		source >>>= destination;
	}
	else {
		parentObj.CPUCore.CPSRCarry = false;
	}
	//Perform CPSR updates for N and Z (But not V):
	parentObj.CPUCore.CPSRNegative = (source < 0);
	parentObj.CPUCore.CPSRZero = (source == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = source;
}
THUMBInstructionSet.prototype.ASR = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7] & 0x1F;
	if (destination > 0) {
		//CPSR Carry is set by the last bit shifted out:
		parentObj.CPUCore.CPSRCarry = (((source >>> (destination - 1)) & 0x1) != 0);
		//Perform shift:
		source >>= destination;
	}
	else {
		parentObj.CPUCore.CPSRCarry = false;
	}
	//Perform CPSR updates for N and Z (But not V):
	parentObj.CPUCore.CPSRNegative = (source < 0);
	parentObj.CPUCore.CPSRZero = (source == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = source;
}
THUMBInstructionSet.prototype.ADC = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7] + ((parentObj.CPUCore.CPSRCarry) ? 1 : 0);
	//Perform Addition:
	var dirtyResult = source + destination;
	parentObj.CPUCore.CPSRCarry = ((dirtyResult | 0) != dirtyResult);
	dirtyResult |= 0;
	parentObj.CPUCore.CPSROverflow = ((source ^ dirtyResult) < 0);
	parentObj.CPUCore.CPSRNegative = (dirtyResult < 0);
	parentObj.CPUCore.CPSRZero = (dirtyResult == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = dirtyResult;
}
THUMBInstructionSet.prototype.SBC = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var offset = parentObj.registers[parentObj.execute & 0x7];
	//Perform Subtraction:
	var dirtyResult = source - offset - ((parentObj.CPUCore.CPSRCarry) ? 0 : 1);
	parentObj.CPUCore.CPSRCarry = ((dirtyResult | 0) == dirtyResult);
	dirtyResult |= 0;
	parentObj.CPUCore.CPSROverflow = ((source ^ dirtyResult) < 0);
	parentObj.CPUCore.CPSRNegative = (dirtyResult < 0);
	parentObj.CPUCore.CPSRZero = (dirtyResult == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = dirtyResult;
}
THUMBInstructionSet.prototype.ROR = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7] & 0x1F;
	if (destination > 0) {
		//CPSR Carry is set by the last bit shifted out:
		parentObj.CPUCore.CPSRCarry = (((source >>> (destination - 1)) & 0x1) != 0);
		//Perform rotate:
		source = (source << (0x20 - destination)) | (source >>> destination);
	}
	else {
		parentObj.CPUCore.CPSRCarry = false;
	}
	//Perform CPSR updates for N and Z (But not V):
	parentObj.CPUCore.CPSRNegative = (source < 0);
	parentObj.CPUCore.CPSRZero = (source == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = source;
}
THUMBInstructionSet.prototype.TST = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7];
	//Perform bitwise AND:
	var result = source & destination;
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
}
THUMBInstructionSet.prototype.NEG = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSROverflow = ((source ^ (-source)) < 0);
	//Perform Subtraction:
	source = (-source) | 0;
	parentObj.CPUCore.CPSRNegative = (source < 0);
	parentObj.CPUCore.CPSRZero = (source == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = source;
}
THUMBInstructionSet.prototype.CMP = function (parentObj) {
	//Compare two registers:
	var destination = parentObj.registers[parentObj.execute & 0x7];
	var dirtyResult = destination - parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result == dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((destination ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
}
THUMBInstructionSet.prototype.CMN = function (parentObj) {
	//Compare two registers:
	var destination = parentObj.registers[parentObj.execute & 0x7];
	var dirtyResult = destination + parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result == dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((destination ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
}
THUMBInstructionSet.prototype.ORR = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7];
	//Perform bitwise ORR:
	var result = source | destination;
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = result;
}
THUMBInstructionSet.prototype.MUL = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7];
	//Perform MUL32:
	var result = parentObj.CPUCore.performMUL32(source, destination, 0);
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = result;
}
THUMBInstructionSet.prototype.BIC = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7];
	//Perform bitwise AND with a bitwise NOT on source:
	var result = ~source & destination;
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = result;
}
THUMBInstructionSet.prototype.MVN = function (parentObj) {
	//Perform bitwise NOT on source:
	var source = ~parentObj.registers[(parentObj.execute >> 3) & 0x7];
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (source < 0);
	parentObj.CPUCore.CPSRZero = (source == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = source;
}
THUMBInstructionSet.prototype.ADDH_LL = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7];
	//Perform Addition:
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = (source + destination) | 0;
}
THUMBInstructionSet.prototype.ADDH_LH = function (parentObj) {
	var source = parentObj.registers[0x8 | ((parentObj.execute >> 3) & 0x7)];
	var destination = parentObj.registers[parentObj.execute & 0x7];
	//Perform Addition:
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = (source + destination) | 0;
}
THUMBInstructionSet.prototype.ADDH_HL = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[0x8 | (parentObj.execute & 0x7)];
	//Perform Addition:
	//Update destination register:
	parentObj.guardHighRegisterWrite((source + destination) | 0);
}
THUMBInstructionSet.prototype.ADDH_HH = function (parentObj) {
	var source = parentObj.registers[0x8 | ((parentObj.execute >> 3) & 0x7)];
	var destination = parentObj.registers[0x8 | (parentObj.execute & 0x7)];
	//Perform Addition:
	//Update destination register:
	parentObj.guardHighRegisterWrite((source + destination) | 0);
}
THUMBInstructionSet.prototype.CMPH_LL = function (parentObj) {
	//Compare two registers:
	var destination = parentObj.registers[parentObj.execute & 0x7];
	var dirtyResult = destination - parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result == dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((destination ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
}
THUMBInstructionSet.prototype.CMPH_LH = function (parentObj) {
	//Compare two registers:
	var destination = parentObj.registers[parentObj.execute & 0x7];
	var dirtyResult = destination - parentObj.registers[0x8 | ((parentObj.execute >> 3) & 0x7)];
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result == dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((destination ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
}
THUMBInstructionSet.prototype.CMPH_HL = function (parentObj) {
	//Compare two registers:
	var destination = parentObj.registers[0x8 | (parentObj.execute & 0x7)];
	var dirtyResult = destination - parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result == dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((destination ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
}
THUMBInstructionSet.prototype.CMPH_HH = function (parentObj) {
	//Compare two registers:
	var destination = parentObj.registers[0x8 | (parentObj.execute & 0x7)];
	var dirtyResult = destination - parentObj.registers[0x8 | ((parentObj.execute >> 3) & 0x7)];
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result == dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((destination ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
}
THUMBInstructionSet.prototype.MOVH_LL = function (parentObj) {
	//Move a register to another register:
	parentObj.registers[parentObj.execute & 0x7] = parentObj.registers[(parentObj.execute >> 3) & 0x7];
}
THUMBInstructionSet.prototype.MOVH_LH = function (parentObj) {
	//Move a register to another register:
	parentObj.registers[parentObj.execute & 0x7] = parentObj.registers[0x8 | ((parentObj.execute >> 3) & 0x7)];
}
THUMBInstructionSet.prototype.MOVH_HL = function (parentObj) {
	//Move a register to another register:
	parentObj.guardHighRegisterWrite(parentObj.registers[(parentObj.execute >> 3) & 0x7]);
}
THUMBInstructionSet.prototype.MOVH_HH = function (parentObj) {
	//Move a register to another register:
	parentObj.guardHighRegisterWrite(parentObj.registers[0x8 | ((parentObj.execute >> 3) & 0x7)]);
}
THUMBInstructionSet.prototype.BX_L = function (parentObj) {
	//Branch & eXchange:
	var address = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	if ((address & 0x1) == 0) {
		//Enter ARM mode:
		address &= -4;
		parentObj.registers[15] = (address + 2) | 0;
		parentObj.CPUCore.enterARM();
	}
	else {
		//Stay in THUMB mode:
		address &= -2;
		parentObj.registers[15] = address;
		parentObj.resetPipeline();
	}
}
THUMBInstructionSet.prototype.BX_H = function (parentObj) {
	//Branch & eXchange:
	var address = parentObj.registers[0x8 | ((parentObj.execute >> 3) & 0x7)];
	if ((address & 0x1) == 0) {
		//Enter ARM mode:
		address &= -4;
		parentObj.registers[15] = (address + 2) | 0;
		parentObj.CPUCore.enterARM();
	}
	else {
		//Stay in THUMB mode:
		address &= -2;
		parentObj.registers[15] = address;
		parentObj.resetPipeline();
	}
}
THUMBInstructionSet.prototype.LDRPC = function (parentObj) {
	//PC-Relative Load
	var result = parentObj.CPUCore.read32(parentObj.registers[15] + ((parentObj.execute & 0xFF) << 2));
	parentObj.registers[(parentObj.execute >> 8) & 0x7] = result;
}
THUMBInstructionSet.prototype.STRreg = function (parentObj) {
	//Store Word From Register
	parentObj.CPUCore.write32(parentObj.registers[(parentObj.execute >> 6) & 0x7] + parentObj.registers[(parentObj.execute >> 3) & 0x7], parentObj.registers[parentObj.execute & 0x7]);
}
THUMBInstructionSet.prototype.STRHreg = function (parentObj) {
	//Store Hald-Word From Register
	parentObj.CPUCore.write16(parentObj.registers[(parentObj.execute >> 6) & 0x7] + parentObj.registers[(parentObj.execute >> 3) & 0x7], parentObj.registers[parentObj.execute & 0x7]);
}
THUMBInstructionSet.prototype.STRBreg = function (parentObj) {
	//Store Byte From Register
	parentObj.CPUCore.write8(parentObj.registers[(parentObj.execute >> 6) & 0x7] + parentObj.registers[(parentObj.execute >> 3) & 0x7], parentObj.registers[parentObj.execute & 0x7]);
}
THUMBInstructionSet.prototype.LDRSBreg = function (parentObj) {
	//Load Signed Byte Into Register
	parentObj.registers[parentObj.execute & 0x7] = (parentObj.CPUCore.read8(parentObj.registers[(parentObj.execute >> 6) & 0x7] + parentObj.registers[(parentObj.execute >> 3) & 0x7]) << 24) >> 24;
}
THUMBInstructionSet.prototype.LDRreg = function (parentObj) {
	//Load Word Into Register
	parentObj.registers[parentObj.execute & 0x7] = parentObj.CPUCore.read32(parentObj.registers[(parentObj.execute >> 6) & 0x7] + parentObj.registers[(parentObj.execute >> 3) & 0x7]);
}
THUMBInstructionSet.prototype.LDRHreg = function (parentObj) {
	//Load Half-Word Into Register
	parentObj.registers[parentObj.execute & 0x7] = parentObj.CPUCore.read16(parentObj.registers[(parentObj.execute >> 6) & 0x7] + parentObj.registers[(parentObj.execute >> 3) & 0x7]);
}
THUMBInstructionSet.prototype.LDRBreg = function (parentObj) {
	//Load Byte Into Register
	parentObj.registers[parentObj.execute & 0x7] = parentObj.CPUCore.read8(parentObj.registers[(parentObj.execute >> 6) & 0x7] + parentObj.registers[(parentObj.execute >> 3) & 0x7]);
}
THUMBInstructionSet.prototype.LDRSHreg = function (parentObj) {
	//Load Signed Half-Word Into Register
	parentObj.registers[parentObj.execute & 0x7] = (parentObj.CPUCore.read16(parentObj.registers[(parentObj.execute >> 6) & 0x7] + parentObj.registers[(parentObj.execute >> 3) & 0x7]) << 16) >> 16;
}
THUMBInstructionSet.prototype.STRimm5 = function (parentObj) {
	//Store Word From Register
	parentObj.CPUCore.write32((((parentObj.execute >> 6) & 0x1F) << 2) + parentObj.registers[(parentObj.execute >> 3) & 0x7], parentObj.registers[parentObj.execute & 0x7]);
}
THUMBInstructionSet.prototype.LDRimm5 = function (parentObj) {
	//Load Word Into Register
	parentObj.registers[parentObj.execute & 0x7] = parentObj.CPUCore.read32((((parentObj.execute >> 6) & 0x1F) << 2) + parentObj.registers[(parentObj.execute >> 3) & 0x7]);
}
THUMBInstructionSet.prototype.STRBimm5 = function (parentObj) {
	//Store Byte From Register
	parentObj.CPUCore.write8(((parentObj.execute >> 6) & 0x1F) + parentObj.registers[(parentObj.execute >> 3) & 0x7], parentObj.registers[parentObj.execute & 0x7]);
}
THUMBInstructionSet.prototype.LDRBimm5 = function (parentObj) {
	//Load Byte Into Register
	parentObj.registers[parentObj.execute & 0x7] = parentObj.CPUCore.read8(((parentObj.execute >> 6) & 0x1F) + parentObj.registers[(parentObj.execute >> 3) & 0x7]);
}
THUMBInstructionSet.prototype.STRHimm5 = function (parentObj) {
	//Store Half-Word From Register
	parentObj.CPUCore.write16((((parentObj.execute >> 6) & 0x1F) << 1) + parentObj.registers[(parentObj.execute >> 3) & 0x7], parentObj.registers[parentObj.execute & 0x7]);
}
THUMBInstructionSet.prototype.LDRHimm5 = function (parentObj) {
	//Load Half-Word Into Register
	parentObj.registers[parentObj.execute & 0x7] = parentObj.CPUCore.read16((((parentObj.execute >> 6) & 0x1F) << 1) + parentObj.registers[(parentObj.execute >> 3) & 0x7]);
}
THUMBInstructionSet.prototype.STRSP = function (parentObj) {
	//Store Word From Register
	parentObj.CPUCore.write32(((parentObj.execute & 0xFF) << 2) + parentObj.registers[13], parentObj.registers[(parentObj.execute >> 8) & 0x7]);
}
THUMBInstructionSet.prototype.LDRSP = function (parentObj) {
	//Load Word Into Register
	parentObj.registers[(parentObj.execute >> 8) & 0x7] = parentObj.CPUCore.read32(((parentObj.execute & 0xFF) << 2) + parentObj.registers[13]);
}
THUMBInstructionSet.prototype.ADDPC = function (parentObj) {
	//Add PC With Offset Into Register
	parentObj.registers[(parentObj.execute >> 8) & 0x7] = (((parentObj.execute & 0xFF) << 2) + parentObj.registers[15]) | 0;
}
THUMBInstructionSet.prototype.ADDSP = function (parentObj) {
	//Add SP With Offset Into Register
	parentObj.registers[(parentObj.execute >> 8) & 0x7] = (((parentObj.execute & 0xFF) << 2) + parentObj.registers[13]) | 0;
}
THUMBInstructionSet.prototype.ADDSPimm7 = function (parentObj) {
	//Add Signed Offset Into SP
	if ((parentObj.execute & 0x80) != 0) {
		parentObj.registers[13] = (parentObj.registers[13] - ((parentObj.execute & 0x7F) << 2)) | 0;
	}
	else {
		parentObj.registers[13] = (parentObj.registers[13] + ((parentObj.execute & 0x7F) << 2)) | 0;
	}
}
THUMBInstructionSet.prototype.PUSH = function (parentObj) {
	//Only initialize the PUSH sequence if the register list is non-empty:
	if ((parentObj.execute & 0xFF) > 0) {
		//Updating the address bus away from PC fetch:
		parentObj.wait.NonSequentialBroadcast();
		//Push register(s) onto the stack:
		for (var rListPosition = 7; rListPosition > -1; --rListPosition) {
			if ((parentObj.execute & (1 << rListPosition)) != 0) {
				//Push register onto the stack:
				parentObj.registers[13] = (parentObj.registers[13] - 4) | 0;
				parentObj.IOCore.memoryWrite32(parentObj.registers[13], parentObj.registers[rListPosition]);
			}
		}
		//Updating the address bus back to PC fetch:
		parentObj.wait.NonSequentialBroadcast();
	}
}
THUMBInstructionSet.prototype.PUSHlr = function (parentObj) {
	//Updating the address bus away from PC fetch:
	parentObj.wait.NonSequentialBroadcast();
	//Push register(s) onto the stack:
	for (var rListPosition = 7; rListPosition > -1; --rListPosition) {
		if ((parentObj.execute & (1 << rListPosition)) != 0) {
			//Push register onto the stack:
			parentObj.registers[13] = (parentObj.registers[13] - 4) | 0;
			parentObj.IOCore.memoryWrite32(parentObj.registers[13], parentObj.registers[rListPosition]);
		}
	}
	//Push link register onto the stack:
	parentObj.registers[13] = (parentObj.registers[13] - 4) | 0;
	parentObj.IOCore.memoryWrite32(parentObj.registers[13], parentObj.registers[14]);
	//Updating the address bus back to PC fetch:
	parentObj.wait.NonSequentialBroadcast();
}
THUMBInstructionSet.prototype.POP = function (parentObj) {
	//Only initialize the POP sequence if the register list is non-empty:
	if ((parentObj.execute & 0xFF) > 0) {
		//Updating the address bus away from PC fetch:
		parentObj.wait.NonSequentialBroadcast();
		//POP stack into register(s):
		for (var rListPosition = 0; rListPosition < 8; ++rListPosition) {
			if ((parentObj.execute & (1 << rListPosition)) != 0) {
				//POP stack into a register:
				parentObj.registers[rListPosition] = parentObj.IOCore.memoryRead32(parentObj.registers[13]);
				parentObj.registers[13] = (parentObj.registers[13] + 4) | 0;
			}
		}
		//Updating the address bus back to PC fetch:
		parentObj.wait.NonSequentialBroadcast();
	}
}
THUMBInstructionSet.prototype.POPpc = function (parentObj) {
	//Updating the address bus away from PC fetch:
	parentObj.wait.NonSequentialBroadcast();
	//POP stack into register(s):
	for (var rListPosition = 0; rListPosition < 8; ++rListPosition) {
		if ((parentObj.execute & (1 << rListPosition)) != 0) {
			//POP stack into a register:
			parentObj.registers[rListPosition] = parentObj.IOCore.memoryRead32(parentObj.registers[13]);
			parentObj.registers[13] = (parentObj.registers[13] + 4) | 0;
		}
	}
	//POP stack into the program counter (r15):
	parentObj.writePC(parentObj.IOCore.memoryRead32(parentObj.registers[13]));
	parentObj.registers[13] = (parentObj.registers[13] + 4) | 0;
	//Updating the address bus back to PC fetch:
	parentObj.wait.NonSequentialBroadcast();
}
THUMBInstructionSet.prototype.STMIA = function (parentObj) {
	//Only initialize the STMIA sequence if the register list is non-empty:
	if ((parentObj.execute & 0xFF) > 0) {
		//Get the base address:
		var currentAddress = parentObj.registers[(parentObj.execute >> 8) & 0x7];
		//Updating the address bus away from PC fetch:
		parentObj.wait.NonSequentialBroadcast();
		//Push register(s) into memory:
		for (var rListPosition = 0; rListPosition < 8; ++rListPosition) {
			if ((parentObj.execute & (1 << rListPosition)) != 0) {
				//Push a register into memory:
				parentObj.IOCore.memoryWrite32(currentAddress, parentObj.registers[rListPosition]);
				currentAddress = (currentAddress + 4) | 0;
			}
		}
		//Store the updated base address back into register:
		parentObj.registers[(parentObj.execute >> 8) & 0x7] = currentAddress;
		//Updating the address bus back to PC fetch:
		parentObj.wait.NonSequentialBroadcast();
	}
}
THUMBInstructionSet.prototype.LDMIA = function (parentObj) {
	//Only initialize the LDMIA sequence if the register list is non-empty:
	if ((parentObj.execute & 0xFF) > 0) {
		//Get the base address:
		var currentAddress = parentObj.registers[(parentObj.execute >> 8) & 0x7];
		//Updating the address bus away from PC fetch:
		parentObj.wait.NonSequentialBroadcast();
		//Load  register(s) from memory:
		for (var rListPosition = 0; rListPosition < 8; ++rListPosition) {
			if ((parentObj.execute & (1 << rListPosition)) != 0) {
				//Load a register from memory:
				parentObj.registers[rListPosition] = parentObj.IOCore.memoryRead32(currentAddress);
				currentAddress = (currentAddress + 4) | 0;
			}
		}
		//Store the updated base address back into register:
		parentObj.registers[(parentObj.execute >> 8) & 0x7] = currentAddress;
		//Updating the address bus back to PC fetch:
		parentObj.wait.NonSequentialBroadcast();
	}
}
THUMBInstructionSet.prototype.BEQ = function (parentObj) {
	//Branch if EQual:
	if (parentObj.CPUCore.CPSRZero) {
		parentObj.offsetPC(parentObj.execute);
	}
}
THUMBInstructionSet.prototype.BNE = function (parentObj) {
	//Branch if Not Equal:
	if (!parentObj.CPUCore.CPSRZero) {
		parentObj.offsetPC(parentObj.execute);
	}
}
THUMBInstructionSet.prototype.BCS = function (parentObj) {
	//Branch if Carry Set:
	if (parentObj.CPUCore.CPSRCarry) {
		parentObj.offsetPC(parentObj.execute);
	}
}
THUMBInstructionSet.prototype.BCC = function (parentObj) {
	//Branch if Carry Clear:
	if (!parentObj.CPUCore.CPSRCarry) {
		parentObj.offsetPC(parentObj.execute);
	}
}
THUMBInstructionSet.prototype.BMI = function (parentObj) {
	//Branch if Negative Set:
	if (parentObj.CPUCore.CPSRNegative) {
		parentObj.offsetPC(parentObj.execute);
	}
}
THUMBInstructionSet.prototype.BPL = function (parentObj) {
	//Branch if Negative Clear:
	if (!parentObj.CPUCore.CPSRNegative) {
		parentObj.offsetPC(parentObj.execute);
	}
}
THUMBInstructionSet.prototype.BVS = function (parentObj) {
	//Branch if Overflow Set:
	if (parentObj.CPUCore.CPSROverflow) {
		parentObj.offsetPC(parentObj.execute);
	}
}
THUMBInstructionSet.prototype.BVC = function (parentObj) {
	//Branch if Overflow Clear:
	if (!parentObj.CPUCore.CPSROverflow) {
		parentObj.offsetPC(parentObj.execute);
	}
}
THUMBInstructionSet.prototype.BHI = function (parentObj) {
	//Branch if Carry & Non-Zero:
	if (parentObj.CPUCore.CPSRCarry && !parentObj.CPUCore.CPSRZero) {
		parentObj.offsetPC(parentObj.execute);
	}
}
THUMBInstructionSet.prototype.BLS = function (parentObj) {
	//Branch if Carry Clear or is Zero Set:
	if (!parentObj.CPUCore.CPSRCarry || parentObj.CPUCore.CPSRZero) {
		parentObj.offsetPC(parentObj.execute);
	}
}
THUMBInstructionSet.prototype.BGE = function (parentObj) {
	//Branch if Negative equal to Overflow
	if (parentObj.CPUCore.CPSRNegative == parentObj.CPUCore.CPSROverflow) {
		parentObj.offsetPC(parentObj.execute);
	}
}
THUMBInstructionSet.prototype.BLT = function (parentObj) {
	//Branch if Negative NOT equal to Overflow
	if (parentObj.CPUCore.CPSRNegative != parentObj.CPUCore.CPSROverflow) {
		parentObj.offsetPC(parentObj.execute);
	}
}
THUMBInstructionSet.prototype.BGT = function (parentObj) {
	//Branch if Zero Clear and Negative equal to Overflow
	if (!parentObj.CPUCore.CPSRZero && parentObj.CPUCore.CPSRNegative == parentObj.CPUCore.CPSROverflow) {
		parentObj.offsetPC(parentObj.execute);
	}
}
THUMBInstructionSet.prototype.BLE = function (parentObj) {
	//Branch if Zero Set and Negative NOT equal to Overflow
	if (parentObj.CPUCore.CPSRZero && parentObj.CPUCore.CPSRNegative != parentObj.CPUCore.CPSROverflow) {
		parentObj.offsetPC(parentObj.execute);
	}
}
THUMBInstructionSet.prototype.SWI = function (parentObj) {
	//Software Interrupt:
	parentObj.CPUCore.SWI((parentObj.registers[15] - 2) | 0);
}
THUMBInstructionSet.prototype.B = function (parentObj) {
	//Unconditional Branch:
	//Update the program counter to branch address:
	parentObj.registers[15] = (parentObj.registers[15] + ((parentObj.execute << 21) >> 20)) | 0;
	//Flush Pipeline & Block PC Increment:
	parentObj.resetPipeline();
}
THUMBInstructionSet.prototype.BLsetup = function (parentObj) {
	//Brank with Link (High offset)
	//Update the link register to branch address:
	parentObj.registers[14] = (parentObj.registers[15] + (((parentObj.execute & 0x7FF) << 21) >> 9)) | 0;
}
THUMBInstructionSet.prototype.BLoff = function (parentObj) {
	//Brank with Link (Low offset)
	//Update the link register to branch address:
	parentObj.registers[14] = (parentObj.registers[14] + ((parentObj.execute & 0x7FF) << 1)) | 0;
	//Copy LR to PC:
	parentObj.registers[15] = parentObj.registers[14];
	//Flush Pipeline & Block PC Increment:
	parentObj.resetPipeline();
	//Set bit 0 of LR high:
	parentObj.registers[14] |= 0x1;
}
THUMBInstructionSet.prototype.UNDEFINED = function (parentObj) {
	//Undefined Exception:
	parentObj.CPUCore.UNDEFINED((parentObj.registers[15] - 2) | 0);
}
THUMBInstructionSet.prototype.compileInstructionMap = function () {
	this.instructionMap = [];
	//0-7
	this.generateLowMap(this.LSLimm);
	//8-F
	this.generateLowMap(this.LSRimm);
	//10-17
	this.generateLowMap(this.ASRimm);
	//18-19
	this.generateLowMap2(this.ADDreg);
	//1A-1B
	this.generateLowMap2(this.SUBreg);
	//1C-1D
	this.generateLowMap2(this.ADDimm3);
	//1E-1F
	this.generateLowMap2(this.SUBimm3);
	//20-27
	this.generateLowMap(this.MOVimm8);
	//28-2F
	this.generateLowMap(this.CMPimm8);
	//30-37
	this.generateLowMap(this.ADDimm8);
	//38-3F
	this.generateLowMap(this.SUBimm8);
	//40
	this.generateLowMap4(this.AND, this.EOR, this.LSL, this.LSR);
	//41
	this.generateLowMap4(this.ASR, this.ADC, this.SBC, this.ROR);
	//42
	this.generateLowMap4(this.TST, this.NEG, this.CMP, this.CMN);
	//43
	this.generateLowMap4(this.ORR, this.MUL, this.BIC, this.MVN);
	//44
	this.generateLowMap4(this.ADDH_LL, this.ADDH_LH, this.ADDH_HL, this.ADDH_HH);
	//45
	this.generateLowMap4(this.CMPH_LL, this.CMPH_LH, this.CMPH_HL, this.CMPH_HH);
	//46
	this.generateLowMap4(this.MOVH_LL, this.MOVH_LH, this.MOVH_HL, this.MOVH_HH);
	//47
	this.generateLowMap4(this.BX_L, this.BX_H, this.BX_L, this.BX_H);
	//48-4F
	this.generateLowMap(this.LDRPC);
	//50-51
	this.generateLowMap2(this.STRreg);
	//52-53
	this.generateLowMap2(this.STRHreg);
	//54-55
	this.generateLowMap2(this.STRBreg);
	//56-57
	this.generateLowMap2(this.LDRSBreg);
	//58-59
	this.generateLowMap2(this.LDRreg);
	//5A-5B
	this.generateLowMap2(this.LDRHreg);
	//5C-5D
	this.generateLowMap2(this.LDRBreg);
	//5E-5F
	this.generateLowMap2(this.LDRSHreg);
	//60-67
	this.generateLowMap(this.STRimm5);
	//68-6F
	this.generateLowMap(this.LDRimm5);
	//70-77
	this.generateLowMap(this.STRBimm5);
	//78-7F
	this.generateLowMap(this.LDRBimm5);
	//80-87
	this.generateLowMap(this.STRHimm5);
	//88-8F
	this.generateLowMap(this.LDRHimm5);
	//90-97
	this.generateLowMap(this.STRSP);
	//98-9F
	this.generateLowMap(this.LDRSP);
	//A0-A7
	this.generateLowMap(this.ADDPC);
	//A8-AF
	this.generateLowMap(this.ADDSP);
	//B0
	this.generateLowMap3(this.ADDSPimm7);
	//B1
	this.generateLowMap3(this.UNDEFINED);
	//B2
	this.generateLowMap3(this.UNDEFINED);
	//B3
	this.generateLowMap3(this.UNDEFINED);
	//B4
	this.generateLowMap3(this.PUSH);
	//B5
	this.generateLowMap3(this.PUSHlr);
	//B6
	this.generateLowMap3(this.UNDEFINED);
	//B7
	this.generateLowMap3(this.UNDEFINED);
	//B8
	this.generateLowMap3(this.UNDEFINED);
	//B9
	this.generateLowMap3(this.UNDEFINED);
	//BA
	this.generateLowMap3(this.UNDEFINED);
	//BB
	this.generateLowMap3(this.UNDEFINED);
	//BC
	this.generateLowMap3(this.POP);
	//BD
	this.generateLowMap3(this.POPpc);
	//BE
	this.generateLowMap3(this.UNDEFINED);
	//BF
	this.generateLowMap3(this.UNDEFINED);
	//C0-C7
	this.generateLowMap(this.STMIA);
	//C8-CF
	this.generateLowMap(this.LDMIA);
	//D0
	this.generateLowMap3(this.BEQ);
	//D1
	this.generateLowMap3(this.BNE);
	//D2
	this.generateLowMap3(this.BCS);
	//D3
	this.generateLowMap3(this.BCC);
	//D4
	this.generateLowMap3(this.BMI);
	//D5
	this.generateLowMap3(this.BPL);
	//D6
	this.generateLowMap3(this.BVS);
	//D7
	this.generateLowMap3(this.BVC);
	//D8
	this.generateLowMap3(this.BHI);
	//D9
	this.generateLowMap3(this.BLS);
	//DA
	this.generateLowMap3(this.BGE);
	//DB
	this.generateLowMap3(this.BLT);
	//DC
	this.generateLowMap3(this.BGT);
	//DD
	this.generateLowMap3(this.BLE);
	//DE
	this.generateLowMap3(this.UNDEFINED);
	//DF
	this.generateLowMap3(this.SWI);
	//E0-E7
	this.generateLowMap(this.B);
	//E8-EF
	this.generateLowMap(this.UNDEFINED);
	//F0-F7
	this.generateLowMap(this.BLsetup);
	//F8-FF
	this.generateLowMap(this.BLoff);
}
THUMBInstructionSet.prototype.generateLowMap = function (instruction) {
	for (var index = 0; index < 0x20; ++index) {
		this.instructionMap.push(instruction);
	}
}
THUMBInstructionSet.prototype.generateLowMap2 = function (instruction) {
	for (var index = 0; index < 0x8; ++index) {
		this.instructionMap.push(instruction);
	}
}
THUMBInstructionSet.prototype.generateLowMap3 = function (instruction) {
	for (var index = 0; index < 0x4; ++index) {
		this.instructionMap.push(instruction);
	}
}
THUMBInstructionSet.prototype.generateLowMap4 = function (instruction1, instruction2, instruction3, instruction4) {
	this.instructionMap.push(instruction1);
	this.instructionMap.push(instruction2);
	this.instructionMap.push(instruction3);
	this.instructionMap.push(instruction4);
}