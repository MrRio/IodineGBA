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
function ARMInstructionSet(CPUCore) {
	this.CPUCore = CPUCore;
	this.initialize();
}
ARMInstructionSet.prototype.initialize = function () {
	this.IOCore = this.CPUCore.IOCore;
	this.wait = this.IOCore.wait;
	this.registers = this.CPUCore.registers;
	this.fetch = 0;
	this.decode = 0;
	this.execute = 0;
	this.pipelineInvalid = 0x3;
	this.compileInstructionMap();
}
ARMInstructionSet.prototype.resetPipeline = function () {
	this.pipelineInvalid = 0x3;
	//Next PC fetch has to update the address bus:
	this.wait.NonSequentialBroadcast();
	//Make sure we don't increment before our fetch:
	this.registers[15] = (this.registers[15] - 4) | 0;
}
ARMInstructionSet.prototype.getIRQLR = function () {
	return (this.registers[15] - 8) | 0;
}
ARMInstructionSet.prototype.executeIteration = function () {
	//Push the new fetch access:
	debug_start_unit("ARM");
	this.fetch = this.wait.CPUGetOpcode32(this.registers[15]);
	//Execute Conditional Instruction:
	debug_pc(this.registers[15]);
	debug_sp(this.registers[14]);
	this.executeARM(this.instructionMap[(this.execute >> 20) & 0xFF][(this.execute >> 4) & 0xF]);
	//Increment The Program Counter:
	this.registers[15] = (this.registers[15] + 4) | 0;
	//Update the pipelining state:
	this.execute = this.decode;
	this.decode = this.fetch;
}
ARMInstructionSet.prototype.executeARM = function (instruction) {
	if (this.pipelineInvalid == 0) {
		//Check the condition code:
		if (this.conditionCodeTest()) {
			instruction[0](this, instruction[1]);
		}
	}
	else {
		//Tick the pipeline invalidation:
		this.pipelineInvalid >>= 1;
		debug_pipeline();
	}
}
ARMInstructionSet.prototype.conditionCodeTest = function () {
	switch (this.execute >>> 28) {
		case 0xE:		//AL (always)
						//Put this case first, since it's the most common!
			return true;
		case 0x0:		//EQ (equal)
			return this.CPUCore.CPSRZero;
		case 0x1:		//NE (not equal)
			return !this.CPUCore.CPSRZero;
		case 0x2:		//CS (unsigned higher or same)
			return this.CPUCore.CPSRCarry;
		case 0x3:		//CC (unsigned lower)
			return !this.CPUCore.CPSRCarry;
		case 0x4:		//MI (negative)
			return this.CPUCore.CPSRNegative;
		case 0x5:		//PL (positive or zero)
			return !this.CPUCore.CPSRNegative;
		case 0x6:		//VS (overflow)
			return this.CPUCore.CPSROverflow;
		case 0x7:		//VC (no overflow)
			return !this.CPUCore.CPSROverflow;
		case 0x8:		//HI (unsigned higher)
			return this.CPUCore.CPSRCarry && !this.CPUCore.CPSRZero;
		case 0x9:		//LS (unsigned lower or same)
			return !this.CPUCore.CPSRCarry || this.CPUCore.CPSRZero;
		case 0xA:		//GE (greater or equal)
			return this.CPUCore.CPSRNegative == this.CPUCore.CPSROverflow;
		case 0xB:		//LT (less than)
			return this.CPUCore.CPSRNegative != this.CPUCore.CPSROverflow;
		case 0xC:		//GT (greater than)
			return !this.CPUCore.CPSRZero && this.CPUCore.CPSRNegative == this.CPUCore.CPSROverflow;
		case 0xD:		//LE (less than or equal)
			return this.CPUCore.CPSRZero || this.CPUCore.CPSRNegative != this.CPUCore.CPSROverflow;
		//case 0xF:		//Reserved (Never Execute)
		default:
			return false;
	}
}
ARMInstructionSet.prototype.guardRegisterWrite = function (address, data) {
	address &= 0xF;
	//Guard high register writing, as it may cause a branch:
	this.registers[address] = data;
	if (address == 15) {
		//We performed a branch:
		this.resetPipeline();
	}
}
ARMInstructionSet.prototype.guardMultiRegisterWrite = function (parentObj, address, data) {
	parentObj.guardRegisterWrite(address, data);
}
ARMInstructionSet.prototype.guardMultiRegisterRead = function (parentObj, address) {
	return parentObj.registers[address];
}
ARMInstructionSet.prototype.guardRegisterWriteSpecial = function (address, data, userMode) {
	address &= 0xF;
	if (userMode) {
		this.guardRegisterWrite(address, data);
	}
	else {
		switch (this.MODEBits) {
			case 0x10:
			case 0x1F:
				this.guardRegisterWrite(address, data);
				break;
			case 0x11:
				if (address < 7 || address == 15) {
					this.guardRegisterWrite(address, data);
				}
				else {
					//User-Mode Register Write Inside Non-User-Mode:
					this.CPUCore.registersUSR[address] = data;
				}
				break;
			default:
				if (address < 13 || address == 15) {
					this.guardRegisterWrite(address, data);
				}
				else {
					//User-Mode Register Write Inside Non-User-Mode:
					this.CPUCore.registersUSR[address] = data;
				}
		}
	}
}
ARMInstructionSet.prototype.guardMultiRegisterWriteSpecial = function (parentObj, address, data) {
	switch (parentObj.MODEBits) {
		case 0x10:
		case 0x1F:
			parentObj.guardRegisterWriteCPSR(address, data);
			break;
		case 0x11:
			if (address < 7 || address == 15) {
				parentObj.guardRegisterWriteCPSR(address, data);
			}
			else {
				//User-Mode Register Write Inside Non-User-Mode:
				parentObj.CPUCore.registersUSR[address] = data;
			}
			break;
		default:
			if (address < 13 || address == 15) {
				parentObj.guardRegisterWriteCPSR(address, data);
			}
			else {
				//User-Mode Register Write Inside Non-User-Mode:
				parentObj.CPUCore.registersUSR[address] = data;
			}
	}
}
ARMInstructionSet.prototype.guardMultiRegisterReadSpecial = function (parentObj, address) {
	address &= 0xF;
	switch (parentObj.MODEBits) {
		case 0x10:
		case 0x1F:
			return parentObj.registers[address];
		case 0x11:
			if (address < 7 || address == 15) {
				return parentObj.registers[address];
			}
			else {
				//User-Mode Register Read Inside Non-User-Mode:
				return parentObj.CPUCore.registersUSR[address];
			}
			break;
		default:
			if (address < 13 || address == 15) {
				return parentObj.registers[address];
			}
			else {
				//User-Mode Register Read Inside Non-User-Mode:
				return parentObj.CPUCore.registersUSR[address];
			}
	}
}
ARMInstructionSet.prototype.guardRegisterWriteCPSR = function (address, data) {
	address &= 0xF;
	//Guard high register writing, as it may cause a branch:
	this.registers[address] = data;
	if (address == 15) {
		//We performed a branch:
		this.resetPipeline();
		//Restore SPSR to CPSR:
		this.CPUCore.SPSRtoCPSR();
	}
}
ARMInstructionSet.prototype.getDelayedRegisterRead = function (registerSelected) {
	//Get the register data (After PC is updated during function execution):
	var register = this.registers[registerSelected];
	if (registerSelected == 15) {
		//Adjust PC for it being incremented before end of instr:
		register = (register + 4) | 0;
	}
	return register;
}
ARMInstructionSet.prototype.BX = function (parentObj) {
	//Branch & eXchange:
	var address = parentObj.registers[parentObj.execute & 0xF];
	if ((address & 0x1) == 0) {
		//Stay in ARM mode:
		address &= -4;
		parentObj.registers[15] = address;
		parentObj.resetPipeline();
	}
	else {
		//Enter THUMB mode:
		address &= -2;
		parentObj.registers[15] = (address - 2) | 0;
		parentObj.CPUCore.enterTHUMB();
	}
}
ARMInstructionSet.prototype.B = function (parentObj) {
	//Branch:
	parentObj.registers[15] = (parentObj.registers[15] + ((parentObj.execute << 8) >> 6)) | 0;
	parentObj.resetPipeline();
}
ARMInstructionSet.prototype.BL = function (parentObj) {
	//Branch with Link:
	parentObj.registers[14] = (parentObj.registers[15] - 4) & -4;
	parentObj.registers[15] = (parentObj.registers[15] + ((parentObj.execute << 8) >> 6)) | 0;
	parentObj.resetPipeline();
}
ARMInstructionSet.prototype.AND = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform bitwise AND:
	//Update destination register:
	parentObj.guardRegisterWrite(parentObj.execute >> 12, operand1 & operand2);
}
ARMInstructionSet.prototype.ANDS = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform bitwise AND:
	var result = operand1 & operand2;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register and guard CPSR for PC:
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 12, result);
}
ARMInstructionSet.prototype.EOR = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform bitwise EOR:
	//Update destination register:
	parentObj.guardRegisterWrite(parentObj.execute >> 12, operand1 ^ operand2);
}
ARMInstructionSet.prototype.EORS = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform bitwise EOR:
	var result = operand1 ^ operand2;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register and guard CPSR for PC:
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 12, result);
}
ARMInstructionSet.prototype.SUB = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform Subtraction:
	//Update destination register:
	parentObj.guardRegisterWrite(parentObj.execute >> 12, (operand1 - operand2) | 0);
}
ARMInstructionSet.prototype.SUBS = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform Subtraction:
	var dirtyResult = operand1 - operand2;
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result == dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((operand1 ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register:
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 12, result);
}
ARMInstructionSet.prototype.RSB = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform Subtraction:
	//Update destination register:
	parentObj.guardRegisterWrite(parentObj.execute >> 12, (operand1 - operand2) | 0);
}
ARMInstructionSet.prototype.RSBS = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform Subtraction:
	var dirtyResult = operand2 - operand1;
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result == dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((operand1 ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register:
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 12, result);
}
ARMInstructionSet.prototype.ADD = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform Addition:
	//Update destination register:
	parentObj.guardRegisterWrite(parentObj.execute >> 12, (operand1 + operand2) | 0);
}
ARMInstructionSet.prototype.ADDS = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform Addition:
	var dirtyResult = operand1 + operand2 + ((parentObj.CPUCore.CPSRCarry) ? 1 : 0);
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result != dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((operand1 ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register:
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 12, result);
}
ARMInstructionSet.prototype.ADC = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform Addition w/ Carry:
	//Update destination register:
	parentObj.guardRegisterWrite(parentObj.execute >> 12, (operand1 + operand2) | 0);
}
ARMInstructionSet.prototype.ADCS = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform Addition w/ Carry:
	var dirtyResult = operand1 + operand2 + ((parentObj.CPUCore.CPSRCarry) ? 1 : 0);
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result != dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((operand1 ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register:
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 12, result);
}
ARMInstructionSet.prototype.SBC = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform Subtraction w/ Carry:
	//Update destination register:
	parentObj.guardRegisterWrite(parentObj.execute >> 12, (operand1 - operand2 - ((parentObj.CPUCore.CPSRCarry) ? 0 : 1)) | 0);
}
ARMInstructionSet.prototype.SBCS = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform Subtraction w/ Carry:
	var dirtyResult = operand1 - operand2 - ((parentObj.CPUCore.CPSRCarry) ? 0 : 1);
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result == dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((operand1 ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register:
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 12, result);
}
ARMInstructionSet.prototype.RSC = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform Reverse Subtraction w/ Carry:
	//Update destination register:
	parentObj.guardRegisterWrite(parentObj.execute >> 12, (operand1 - operand2 - ((parentObj.CPUCore.CPSRCarry) ? 0 : 1)) | 0);
}
ARMInstructionSet.prototype.RSCS = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform Reverse Subtraction w/ Carry:
	var dirtyResult = operand1 - operand2 - ((parentObj.CPUCore.CPSRCarry) ? 0 : 1);
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result == dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((operand1 ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register:
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 12, result);
}
ARMInstructionSet.prototype.TSTS = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform bitwise AND:
	var result = operand1 & operand2;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
}
ARMInstructionSet.prototype.TEQS = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform bitwise EOR:
	var result = operand1 ^ operand2;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
}
ARMInstructionSet.prototype.CMPS = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform Subtraction:
	var dirtyResult = operand1 - operand2;
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result == dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((operand1 ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
}
ARMInstructionSet.prototype.CMNS = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform Addition:
	var dirtyResult = operand1 + operand2 + ((parentObj.CPUCore.CPSRCarry) ? 1 : 0);
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result != dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((operand1 ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
}
ARMInstructionSet.prototype.ORR = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform bitwise OR:
	//Update destination register:
	parentObj.guardRegisterWrite(parentObj.execute >> 12, operand1 | operand2);
}
ARMInstructionSet.prototype.ORRS = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform bitwise OR:
	var result = operand1 | operand2;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register and guard CPSR for PC:
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 12, result);
}
ARMInstructionSet.prototype.MOV = function (parentObj, operand2OP) {
	//Perform move:
	//Update destination register:
	parentObj.guardRegisterWrite(parentObj.execute >> 12, operand2OP(parentObj, parentObj.execute));
}
ARMInstructionSet.prototype.MOVS = function (parentObj, operand2OP) {
	var operand2 = operand2OP(parentObj, parentObj.execute);
	//Perform move:
	parentObj.CPUCore.CPSRNegative = (operand2 < 0);
	parentObj.CPUCore.CPSRZero = (operand2 == 0);
	//Update destination register and guard CPSR for PC:
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 12, operand2);
}
ARMInstructionSet.prototype.BIC = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	//NOT operand 2:
	var operand2 = ~operand2OP(parentObj, parentObj.execute);
	//Perform bitwise AND:
	//Update destination register:
	parentObj.guardRegisterWrite(parentObj.execute >> 12, operand1 & operand2);
}
ARMInstructionSet.prototype.BICS = function (parentObj, operand2OP) {
	var operand1 = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	//NOT operand 2:
	var operand2 = ~operand2OP(parentObj, parentObj.execute);
	//Perform bitwise AND:
	var result = operand1 & operand2;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register and guard CPSR for PC:
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 12, result);
}
ARMInstructionSet.prototype.MVN = function (parentObj, operand2OP) {
	//Perform move negative:
	//Update destination register:
	parentObj.guardRegisterWrite(parentObj.execute >> 12, ~operand2OP(parentObj, parentObj.execute));
}
ARMInstructionSet.prototype.MVNS = function (parentObj, operand2OP) {
	var operand2 = ~operand2OP(parentObj, parentObj.execute);
	//Perform move negative:
	parentObj.CPUCore.CPSRNegative = (operand2 < 0);
	parentObj.CPUCore.CPSRZero = (operand2 == 0);
	//Update destination register and guard CPSR for PC:
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 12, operand2);
}
ARMInstructionSet.prototype.MRS = function (parentObj, operand2OP) {
	//Transfer PSR to Register
	parentObj.guardRegisterWrite(parentObj.execute >> 12, operand2OP(parentObj));
}
ARMInstructionSet.prototype.MSR = function (parentObj, operand2OP) {
	//Transfer Register/Immediate to PSR:
	operand2OP(parentObj, parentObj.execute);
}
ARMInstructionSet.prototype.MUL = function (parentObj, operand2OP) {
	//Perform multiplication:
	var result = parentObj.CPUCore.performMUL32(parentObj.registers[parentObj.execute & 0xF], parentObj.registers[(parentObj.execute >> 8) & 0xF], 0);
	//Update destination register:
	parentObj.guardRegisterWrite(parentObj.execute >> 16, result);
}
ARMInstructionSet.prototype.MULS = function (parentObj, operand2OP) {
	//Perform multiplication:
	var result = parentObj.CPUCore.performMUL32(parentObj.registers[parentObj.execute & 0xF], parentObj.registers[(parentObj.execute >> 8) & 0xF], 0);
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register and guard CPSR for PC:
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 16, result);
}
ARMInstructionSet.prototype.MLA = function (parentObj, operand2OP) {
	//Perform multiplication:
	var result = parentObj.CPUCore.performMUL32(parentObj.registers[parentObj.execute & 0xF], parentObj.registers[(parentObj.execute >> 8) & 0xF], 1);
	//Perform addition:
	result += parentObj.registers[(parentObj.execute >> 12) & 0xF];
	//Update destination register:
	parentObj.guardRegisterWrite(parentObj.execute >> 16, result);
}
ARMInstructionSet.prototype.MLAS = function (parentObj, operand2OP) {
	//Perform multiplication:
	var result = parentObj.CPUCore.performMUL32(parentObj.registers[parentObj.execute & 0xF], parentObj.registers[(parentObj.execute >> 8) & 0xF], 1);
	//Perform addition:
	result += parentObj.registers[(parentObj.execute >> 12) & 0xF];
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register and guard CPSR for PC:
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 16, result);
}
ARMInstructionSet.prototype.UMULL = function (parentObj, operand2OP) {
	//Perform multiplication:
	parentObj.CPUCore.performUMUL64(parentObj.registers[parentObj.execute & 0xF], parentObj.registers[(parentObj.execute >> 8) & 0xF]);
	//Update destination register:
	parentObj.guardRegisterWrite(parentObj.execute >> 16, parentObj.CPUCore.mul64ResultHigh);
	parentObj.guardRegisterWrite(parentObj.execute >> 12, parentObj.CPUCore.mul64ResultLow);
}
ARMInstructionSet.prototype.UMULLS = function (parentObj, operand2OP) {
	//Perform multiplication:
	parentObj.CPUCore.performUMUL64(parentObj.registers[parentObj.execute & 0xF], parentObj.registers[(parentObj.execute >> 8) & 0xF]);
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (parentObj.CPUCore.mul64ResultHigh < 0);
	parentObj.CPUCore.CPSRZero = (parentObj.CPUCore.mul64ResultHigh == 0 && parentObj.CPUCore.mul64ResultLow);
	//Update destination register and guard CPSR for PC:
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 16, parentObj.CPUCore.mul64ResultHigh);
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 12, parentObj.CPUCore.mul64ResultLow);
}
ARMInstructionSet.prototype.UMLAL = function (parentObj, operand2OP) {
	//Perform multiplication:
	parentObj.CPUCore.performUMLA64(parentObj.registers[parentObj.execute & 0xF], parentObj.registers[(parentObj.execute >> 8) & 0xF], parentObj.registers[(parentObj.execute >> 16) & 0xF], parentObj.registers[(parentObj.execute >> 12) & 0xF]);
	//Update destination register:
	parentObj.guardRegisterWrite(parentObj.execute >> 16, parentObj.CPUCore.mul64ResultHigh);
	parentObj.guardRegisterWrite(parentObj.execute >> 12, parentObj.CPUCore.mul64ResultLow);
}
ARMInstructionSet.prototype.UMLALS = function (parentObj, operand2OP) {
	//Perform multiplication:
	parentObj.CPUCore.performUMLA64(parentObj.registers[parentObj.execute & 0xF], parentObj.registers[(parentObj.execute >> 8) & 0xF], parentObj.registers[(parentObj.execute >> 16) & 0xF], parentObj.registers[(parentObj.execute >> 12) & 0xF]);
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (parentObj.CPUCore.mul64ResultHigh < 0);
	parentObj.CPUCore.CPSRZero = (parentObj.CPUCore.mul64ResultHigh == 0 && parentObj.CPUCore.mul64ResultLow);
	//Update destination register and guard CPSR for PC:
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 16, parentObj.CPUCore.mul64ResultHigh);
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 12, parentObj.CPUCore.mul64ResultLow);
}
ARMInstructionSet.prototype.SMULL = function (parentObj, operand2OP) {
	//Perform multiplication:
	parentObj.CPUCore.performMUL64(parentObj.registers[parentObj.execute & 0xF], parentObj.registers[(parentObj.execute >> 8) & 0xF]);
	//Update destination register:
	parentObj.guardRegisterWrite(parentObj.execute >> 16, parentObj.CPUCore.mul64ResultHigh);
	parentObj.guardRegisterWrite(parentObj.execute >> 12, parentObj.CPUCore.mul64ResultLow);
}
ARMInstructionSet.prototype.SMULLS = function (parentObj, operand2OP) {
	//Perform multiplication:
	parentObj.CPUCore.performMUL64(parentObj.registers[parentObj.execute & 0xF], parentObj.registers[(parentObj.execute >> 8) & 0xF]);
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (parentObj.CPUCore.mul64ResultHigh < 0);
	parentObj.CPUCore.CPSRZero = (parentObj.CPUCore.mul64ResultHigh == 0 && parentObj.CPUCore.mul64ResultLow);
	//Update destination register and guard CPSR for PC:
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 16, parentObj.CPUCore.mul64ResultHigh);
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 12, parentObj.CPUCore.mul64ResultLow);
}
ARMInstructionSet.prototype.SMLAL = function (parentObj, operand2OP) {
	//Perform multiplication:
	parentObj.CPUCore.performMLA64(parentObj.registers[parentObj.execute & 0xF], parentObj.registers[(parentObj.execute >> 8) & 0xF], parentObj.registers[(parentObj.execute >> 16) & 0xF], parentObj.registers[(parentObj.execute >> 12) & 0xF]);
	//Update destination register:
	parentObj.guardRegisterWrite(parentObj.execute >> 16, parentObj.CPUCore.mul64ResultHigh);
	parentObj.guardRegisterWrite(parentObj.execute >> 12, parentObj.CPUCore.mul64ResultLow);
}
ARMInstructionSet.prototype.SMLALS = function (parentObj, operand2OP) {
	//Perform multiplication:
	parentObj.CPUCore.performMLA64(parentObj.registers[parentObj.execute & 0xF], parentObj.registers[(parentObj.execute >> 8) & 0xF], parentObj.registers[(parentObj.execute >> 16) & 0xF], parentObj.registers[(parentObj.execute >> 12) & 0xF]);
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (parentObj.CPUCore.mul64ResultHigh < 0);
	parentObj.CPUCore.CPSRZero = (parentObj.CPUCore.mul64ResultHigh == 0 && parentObj.CPUCore.mul64ResultLow);
	//Update destination register and guard CPSR for PC:
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 16, parentObj.CPUCore.mul64ResultHigh);
	parentObj.guardRegisterWriteCPSR(parentObj.execute >> 12, parentObj.CPUCore.mul64ResultLow);
}
ARMInstructionSet.prototype.STRH = function (parentObj, operand2OP) {
	//Perform halfword store calculations:
	var address = operand2OP(parentObj, parentObj.execute);
	//Write to memory location:
	parentObj.CPUCore.write16(address, parentObj.getDelayedRegisterRead((parentObj.execute >> 12) & 0xF));
}
ARMInstructionSet.prototype.LDRH = function (parentObj, operand2OP) {
	//Perform word store calculations:
	var address = operand2OP(parentObj, parentObj.execute);
	//Read from memory location:
	parentObj.guardRegisterWrite((parentObj.execute >> 12) & 0xF, parentObj.CPUCore.read16(address));
}
ARMInstructionSet.prototype.LDRSH = function (parentObj, operand2OP) {
	//Perform word store calculations:
	var address = operand2OP(parentObj, parentObj.execute);
	//Read from memory location:
	parentObj.guardRegisterWrite((parentObj.execute >> 12) & 0xF, (parentObj.CPUCore.read16(address) << 16) >> 16);
}
ARMInstructionSet.prototype.LDRSB = function (parentObj, operand2OP) {
	//Perform word store calculations:
	var address = operand2OP(parentObj, parentObj.execute);
	//Read from memory location:
	parentObj.guardRegisterWrite((parentObj.execute >> 12) & 0xF, (parentObj.CPUCore.read8(address) << 24) >> 24);
}
ARMInstructionSet.prototype.STR = function (parentObj, operand2OP) {
	//Perform word store calculations:
	var address = operand2OP(parentObj, parentObj.execute, false);
	//Write to memory location:
	parentObj.CPUCore.write32(address, parentObj.getDelayedRegisterRead((parentObj.execute >> 12) & 0xF));
}
ARMInstructionSet.prototype.LDR = function (parentObj, operand2OP) {
	//Perform word store calculations:
	var address = operand2OP(parentObj, parentObj.execute, false);
	//Read from memory location:
	parentObj.guardRegisterWrite((parentObj.execute >> 12) & 0xF, parentObj.CPUCore.read32(address));
}
ARMInstructionSet.prototype.STRB = function (parentObj, operand2OP) {
	//Perform byte store calculations:
	var address = operand2OP(parentObj, parentObj.execute, false);
	//Write to memory location:
	parentObj.CPUCore.write8(address, parentObj.getDelayedRegisterRead((parentObj.execute >> 12) & 0xF));
}
ARMInstructionSet.prototype.LDRB = function (parentObj, operand2OP) {
	//Perform word store calculations:
	var address = operand2OP(parentObj, parentObj.execute, false);
	//Read from memory location:
	parentObj.guardRegisterWrite((parentObj.execute >> 12) & 0xF, parentObj.CPUCore.read8(address));
}
ARMInstructionSet.prototype.STRT = function (parentObj, operand2OP) {
	//Perform word store calculations:
	var address = operand2OP(parentObj, parentObj.execute, true);
	//Write to memory location:
	parentObj.CPUCore.write32(address, parentObj.getDelayedRegisterRead((parentObj.execute >> 12) & 0xF));
}
ARMInstructionSet.prototype.LDRT = function (parentObj, operand2OP) {
	//Perform word store calculations:
	var address = operand2OP(parentObj, parentObj.execute, true);
	//Read from memory location:
	parentObj.guardRegisterWrite((parentObj.execute >> 12) & 0xF, parentObj.CPUCore.read32(address));
}
ARMInstructionSet.prototype.STRBT = function (parentObj, operand2OP) {
	//Perform byte store calculations:
	var address = operand2OP(parentObj, parentObj.execute, true);
	//Write to memory location:
	parentObj.CPUCore.write8(address, parentObj.getDelayedRegisterRead((parentObj.execute >> 12) & 0xF));
}
ARMInstructionSet.prototype.LDRBT = function (parentObj, operand2OP) {
	//Perform word store calculations:
	var address = operand2OP(parentObj, parentObj.execute, true);
	//Read from memory location:
	parentObj.guardRegisterWrite((parentObj.execute >> 12) & 0xF, parentObj.CPUCore.read8(address));
}
ARMInstructionSet.prototype.STMIA = function (parentObj, operand2OP) {
	//Only initialize the STMIA sequence if the register list is non-empty:
	if ((parentObj.execute & 0xFFFF) > 0) {
		//Get the base address:
		var currentAddress = parentObj.registers[(parentObj.execute >> 16) & 0x7];
		//Updating the address bus away from PC fetch:
		parentObj.wait.NonSequentialBroadcast();
		//Push register(s) into memory:
		for (var rListPosition = 0; rListPosition < 0x10; ++rListPosition) {
			if ((parentObj.execute & (1 << rListPosition)) != 0) {
				//Push a register into memory:
				parentObj.IOCore.memoryWrite32(currentAddress, operand2OP(parentObj, rListPosition));
				currentAddress = (currentAddress + 4) | 0;
			}
		}
		//Updating the address bus back to PC fetch:
		parentObj.wait.NonSequentialBroadcast();
	}
}
ARMInstructionSet.prototype.STMIAW = function (parentObj, operand2OP) {
	//Only initialize the STMIA sequence if the register list is non-empty:
	if ((parentObj.execute & 0xFFFF) > 0) {
		//Get the base address:
		var currentAddress = parentObj.registers[(parentObj.execute >> 16) & 0x7];
		//Updating the address bus away from PC fetch:
		parentObj.wait.NonSequentialBroadcast();
		//Push register(s) into memory:
		for (var rListPosition = 0; rListPosition < 0x10; ++rListPosition) {
			if ((parentObj.execute & (1 << rListPosition)) != 0) {
				//Push a register into memory:
				parentObj.IOCore.memoryWrite32(currentAddress, operand2OP(parentObj, rListPosition));
				currentAddress = (currentAddress + 4) | 0;
			}
		}
		//Store the updated base address back into register:
		parentObj.registers[(parentObj.execute >> 16) & 0x7] = currentAddress;
		//Updating the address bus back to PC fetch:
		parentObj.wait.NonSequentialBroadcast();
	}
}
ARMInstructionSet.prototype.STMDA = function (parentObj, operand2OP) {
	//Only initialize the STMDA sequence if the register list is non-empty:
	if ((parentObj.execute & 0xFFFF) > 0) {
		//Get the base address:
		var currentAddress = parentObj.registers[(parentObj.execute >> 16) & 0x7];
		//Updating the address bus away from PC fetch:
		parentObj.wait.NonSequentialBroadcast();
		//Push register(s) into memory:
		for (var rListPosition = 0; rListPosition < 0x10; ++rListPosition) {
			if ((parentObj.execute & (1 << rListPosition)) != 0) {
				//Push a register into memory:
				parentObj.IOCore.memoryWrite32(currentAddress, operand2OP(parentObj, rListPosition));
				currentAddress = (currentAddress - 4) | 0;
			}
		}
		//Updating the address bus back to PC fetch:
		parentObj.wait.NonSequentialBroadcast();
	}
}
ARMInstructionSet.prototype.STMDAW = function (parentObj, operand2OP) {
	//Only initialize the STMDA sequence if the register list is non-empty:
	if ((parentObj.execute & 0xFFFF) > 0) {
		//Get the base address:
		var currentAddress = parentObj.registers[(parentObj.execute >> 16) & 0x7];
		//Updating the address bus away from PC fetch:
		parentObj.wait.NonSequentialBroadcast();
		//Push register(s) into memory:
		for (var rListPosition = 0; rListPosition < 0x10; ++rListPosition) {
			if ((parentObj.execute & (1 << rListPosition)) != 0) {
				//Push a register into memory:
				parentObj.IOCore.memoryWrite32(currentAddress, operand2OP(parentObj, rListPosition));
				currentAddress = (currentAddress - 4) | 0;
			}
		}
		//Store the updated base address back into register:
		parentObj.registers[(parentObj.execute >> 16) & 0x7] = currentAddress;
		//Updating the address bus back to PC fetch:
		parentObj.wait.NonSequentialBroadcast();
	}
}
ARMInstructionSet.prototype.STMIB = function (parentObj, operand2OP) {
	//Only initialize the STMIB sequence if the register list is non-empty:
	if ((parentObj.execute & 0xFFFF) > 0) {
		//Get the base address:
		var currentAddress = parentObj.registers[(parentObj.execute >> 16) & 0x7];
		//Updating the address bus away from PC fetch:
		parentObj.wait.NonSequentialBroadcast();
		//Push register(s) into memory:
		for (var rListPosition = 0; rListPosition < 0x10; ++rListPosition) {
			if ((parentObj.execute & (1 << rListPosition)) != 0) {
				//Push a register into memory:
				currentAddress = (currentAddress + 4) | 0;
				parentObj.IOCore.memoryWrite32(currentAddress, operand2OP(parentObj, rListPosition));
			}
		}
		//Updating the address bus back to PC fetch:
		parentObj.wait.NonSequentialBroadcast();
	}
}
ARMInstructionSet.prototype.STMIBW = function (parentObj, operand2OP) {
	//Only initialize the STMIB sequence if the register list is non-empty:
	if ((parentObj.execute & 0xFFFF) > 0) {
		//Get the base address:
		var currentAddress = parentObj.registers[(parentObj.execute >> 16) & 0x7];
		//Updating the address bus away from PC fetch:
		parentObj.wait.NonSequentialBroadcast();
		//Push register(s) into memory:
		for (var rListPosition = 0; rListPosition < 0x10; ++rListPosition) {
			if ((parentObj.execute & (1 << rListPosition)) != 0) {
				//Push a register into memory:
				currentAddress = (currentAddress + 4) | 0;
				parentObj.IOCore.memoryWrite32(currentAddress, operand2OP(parentObj, rListPosition));
			}
		}
		//Store the updated base address back into register:
		parentObj.registers[(parentObj.execute >> 16) & 0x7] = currentAddress;
		//Updating the address bus back to PC fetch:
		parentObj.wait.NonSequentialBroadcast();
	}
}
ARMInstructionSet.prototype.STMDB = function (parentObj, operand2OP) {
	//Only initialize the STMDB sequence if the register list is non-empty:
	if ((parentObj.execute & 0xFFFF) > 0) {
		//Get the base address:
		var currentAddress = parentObj.registers[(parentObj.execute >> 16) & 0x7];
		//Updating the address bus away from PC fetch:
		parentObj.wait.NonSequentialBroadcast();
		//Push register(s) into memory:
		for (var rListPosition = 0; rListPosition < 0x10; ++rListPosition) {
			if ((parentObj.execute & (1 << rListPosition)) != 0) {
				//Push a register into memory:
				currentAddress = (currentAddress - 4) | 0;
				parentObj.IOCore.memoryWrite32(currentAddress, operand2OP(parentObj, rListPosition));
			}
		}
		//Updating the address bus back to PC fetch:
		parentObj.wait.NonSequentialBroadcast();
	}
}
ARMInstructionSet.prototype.STMDBW = function (parentObj, operand2OP) {
	//Only initialize the STMDB sequence if the register list is non-empty:
	if ((parentObj.execute & 0xFFFF) > 0) {
		//Get the base address:
		var currentAddress = parentObj.registers[(parentObj.execute >> 16) & 0x7];
		//Updating the address bus away from PC fetch:
		parentObj.wait.NonSequentialBroadcast();
		//Push register(s) into memory:
		for (var rListPosition = 0; rListPosition < 0x10; ++rListPosition) {
			if ((parentObj.execute & (1 << rListPosition)) != 0) {
				//Push a register into memory:
				currentAddress = (currentAddress - 4) | 0;
				parentObj.IOCore.memoryWrite32(currentAddress, operand2OP(parentObj, rListPosition));
			}
		}
		//Store the updated base address back into register:
		parentObj.registers[(parentObj.execute >> 16) & 0x7] = currentAddress;
		//Updating the address bus back to PC fetch:
		parentObj.wait.NonSequentialBroadcast();
	}
}
ARMInstructionSet.prototype.LDMIA = function (parentObj, operand2OP) {
	//Only initialize the LDMIA sequence if the register list is non-empty:
	if ((parentObj.execute & 0xFFFF) > 0) {
		//Get the base address:
		var currentAddress = parentObj.registers[(parentObj.execute >> 16) & 0x7];
		//Updating the address bus away from PC fetch:
		parentObj.wait.NonSequentialBroadcast();
		//Load register(s) from memory:
		for (var rListPosition = 0; rListPosition < 0x10; ++rListPosition) {
			if ((parentObj.execute & (1 << rListPosition)) != 0) {
				//Load a register from memory:
				operand2OP(parentObj, rListPosition, parentObj.IOCore.memoryRead32(currentAddress));
				currentAddress = (currentAddress + 4) | 0;
			}
		}
		//Updating the address bus back to PC fetch:
		parentObj.wait.NonSequentialBroadcast();
	}
}
ARMInstructionSet.prototype.LDMIAW = function (parentObj, operand2OP) {
	//Only initialize the LDMIA sequence if the register list is non-empty:
	if ((parentObj.execute & 0xFFFF) > 0) {
		//Get the base address:
		var currentAddress = parentObj.registers[(parentObj.execute >> 16) & 0x7];
		//Updating the address bus away from PC fetch:
		parentObj.wait.NonSequentialBroadcast();
		//Load register(s) from memory:
		for (var rListPosition = 0; rListPosition < 0x10; ++rListPosition) {
			if ((parentObj.execute & (1 << rListPosition)) != 0) {
				//Load a register from memory:
				operand2OP(parentObj, rListPosition, parentObj.IOCore.memoryRead32(currentAddress));
				currentAddress = (currentAddress + 4) | 0;
			}
		}
		//Store the updated base address back into register:
		parentObj.registers[(parentObj.execute >> 16) & 0x7] = currentAddress;
		//Updating the address bus back to PC fetch:
		parentObj.wait.NonSequentialBroadcast();
	}
}
ARMInstructionSet.prototype.LDMDA = function (parentObj, operand2OP) {
	//Only initialize the LDMDA sequence if the register list is non-empty:
	if ((parentObj.execute & 0xFFFF) > 0) {
		//Get the base address:
		var currentAddress = parentObj.registers[(parentObj.execute >> 16) & 0x7];
		//Updating the address bus away from PC fetch:
		parentObj.wait.NonSequentialBroadcast();
		//Load register(s) from memory:
		for (var rListPosition = 0; rListPosition < 0x10; ++rListPosition) {
			if ((parentObj.execute & (1 << rListPosition)) != 0) {
				//Load a register from memory:
				operand2OP(parentObj, rListPosition, parentObj.IOCore.memoryRead32(currentAddress));
				currentAddress = (currentAddress - 4) | 0;
			}
		}
		//Updating the address bus back to PC fetch:
		parentObj.wait.NonSequentialBroadcast();
	}
}
ARMInstructionSet.prototype.LDMDAW = function (parentObj, operand2OP) {
	//Only initialize the LDMDA sequence if the register list is non-empty:
	if ((parentObj.execute & 0xFFFF) > 0) {
		//Get the base address:
		var currentAddress = parentObj.registers[(parentObj.execute >> 16) & 0x7];
		//Updating the address bus away from PC fetch:
		parentObj.wait.NonSequentialBroadcast();
		//Load register(s) from memory:
		for (var rListPosition = 0; rListPosition < 0x10; ++rListPosition) {
			if ((parentObj.execute & (1 << rListPosition)) != 0) {
				//Load a register from memory:
				operand2OP(parentObj, rListPosition, parentObj.IOCore.memoryRead32(currentAddress));
				currentAddress = (currentAddress - 4) | 0;
			}
		}
		//Store the updated base address back into register:
		parentObj.registers[(parentObj.execute >> 16) & 0x7] = currentAddress;
		//Updating the address bus back to PC fetch:
		parentObj.wait.NonSequentialBroadcast();
	}
}
ARMInstructionSet.prototype.LDMIB = function (parentObj, operand2OP) {
	//Only initialize the LDMIB sequence if the register list is non-empty:
	if ((parentObj.execute & 0xFFFF) > 0) {
		//Get the base address:
		var currentAddress = parentObj.registers[(parentObj.execute >> 16) & 0x7];
		//Updating the address bus away from PC fetch:
		parentObj.wait.NonSequentialBroadcast();
		//Load register(s) from memory:
		for (var rListPosition = 0; rListPosition < 0x10; ++rListPosition) {
			if ((parentObj.execute & (1 << rListPosition)) != 0) {
				//Load a register from memory:
				currentAddress = (currentAddress + 4) | 0;
				operand2OP(parentObj, rListPosition, parentObj.IOCore.memoryRead32(currentAddress));
			}
		}
		//Updating the address bus back to PC fetch:
		parentObj.wait.NonSequentialBroadcast();
	}
}
ARMInstructionSet.prototype.LDMIBW = function (parentObj, operand2OP) {
	//Only initialize the LDMIB sequence if the register list is non-empty:
	if ((parentObj.execute & 0xFFFF) > 0) {
		//Get the base address:
		var currentAddress = parentObj.registers[(parentObj.execute >> 16) & 0x7];
		//Updating the address bus away from PC fetch:
		parentObj.wait.NonSequentialBroadcast();
		//Load register(s) from memory:
		for (var rListPosition = 0; rListPosition < 0x10; ++rListPosition) {
			if ((parentObj.execute & (1 << rListPosition)) != 0) {
				//Load a register from memory:
				currentAddress = (currentAddress + 4) | 0;
				operand2OP(parentObj, rListPosition, parentObj.IOCore.memoryRead32(currentAddress));
			}
		}
		//Store the updated base address back into register:
		parentObj.registers[(parentObj.execute >> 16) & 0x7] = currentAddress;
		//Updating the address bus back to PC fetch:
		parentObj.wait.NonSequentialBroadcast();
	}
}
ARMInstructionSet.prototype.LDMDB = function (parentObj, operand2OP) {
	//Only initialize the LDMDB sequence if the register list is non-empty:
	if ((parentObj.execute & 0xFFFF) > 0) {
		//Get the base address:
		var currentAddress = parentObj.registers[(parentObj.execute >> 16) & 0x7];
		//Updating the address bus away from PC fetch:
		parentObj.wait.NonSequentialBroadcast();
		//Load register(s) from memory:
		for (var rListPosition = 0; rListPosition < 0x10; ++rListPosition) {
			if ((parentObj.execute & (1 << rListPosition)) != 0) {
				//Load a register from memory:
				currentAddress = (currentAddress - 4) | 0;
				operand2OP(parentObj, rListPosition, parentObj.IOCore.memoryRead32(currentAddress));
			}
		}
		//Updating the address bus back to PC fetch:
		parentObj.wait.NonSequentialBroadcast();
	}
}
ARMInstructionSet.prototype.LDMDBW = function (parentObj, operand2OP) {
	//Only initialize the LDMDB sequence if the register list is non-empty:
	if ((parentObj.execute & 0xFFFF) > 0) {
		//Get the base address:
		var currentAddress = parentObj.registers[(parentObj.execute >> 16) & 0x7];
		//Updating the address bus away from PC fetch:
		parentObj.wait.NonSequentialBroadcast();
		//Load register(s) from memory:
		for (var rListPosition = 0; rListPosition < 0x10; ++rListPosition) {
			if ((parentObj.execute & (1 << rListPosition)) != 0) {
				//Load a register from memory:
				currentAddress = (currentAddress - 4) | 0;
				operand2OP(parentObj, rListPosition, parentObj.IOCore.memoryRead32(currentAddress));
			}
		}
		//Store the updated base address back into register:
		parentObj.registers[(parentObj.execute >> 16) & 0x7] = currentAddress;
		//Updating the address bus back to PC fetch:
		parentObj.wait.NonSequentialBroadcast();
	}
}
ARMInstructionSet.prototype.SWP = function (parentObj, operand2OP) {
	var base = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var data = parentObj.CPUCore.read32(base);
	//Clock a cycle for the processing delaying the CPU:
	parentObj.wait.CPUInternalCyclePrefetch(parentObj.fetch, 1);
	parentObj.CPUCore.write32(base, parentObj.registers[parentObj.execute & 0xF]);
	parentObj.guardRegisterWrite(parentObj.execute >> 12, data);
}
ARMInstructionSet.prototype.SWPB = function (parentObj, operand2OP) {
	var base = parentObj.registers[(parentObj.execute >> 16) & 0xF];
	var data = parentObj.CPUCore.read8(base);
	//Clock a cycle for the processing delaying the CPU:
	parentObj.wait.CPUInternalCyclePrefetch(parentObj.fetch, 1);
	parentObj.CPUCore.write8(base, parentObj.registers[parentObj.execute & 0xF]);
	parentObj.guardRegisterWrite(parentObj.execute >> 12, data);
}
ARMInstructionSet.prototype.SWI = function (parentObj, operand2OP) {
	//Software Interrupt:
	parentObj.CPUCore.SWI((parentObj.registers[15] - 4) | 0);
}
ARMInstructionSet.prototype.CDP = function (parentObj, operand2OP) {
	//No co-processor on GBA, but we really should do the bail properly:
	parentObj.UNDEFINED();
}
ARMInstructionSet.prototype.LDC = function (parentObj, operand2OP) {
	//No co-processor on GBA, but we really should do the bail properly:
	parentObj.UNDEFINED();
}
ARMInstructionSet.prototype.STC = function (parentObj, operand2OP) {
	//No co-processor on GBA, but we really should do the bail properly:
	parentObj.UNDEFINED();
}
ARMInstructionSet.prototype.MRC = function (parentObj, operand2OP) {
	//No co-processor on GBA, but we really should do the bail properly:
	parentObj.UNDEFINED();
}
ARMInstructionSet.prototype.MCR = function (parentObj, operand2OP) {
	//No co-processor on GBA, but we really should do the bail properly:
	parentObj.UNDEFINED();
}
ARMInstructionSet.prototype.UNDEFINED = function (parentObj) {
	//Undefined Exception:
	parentObj.CPUCore.UNDEFINED((parentObj.registers[15] - 4) | 0);
}
ARMInstructionSet.prototype.lli = function (parentObj, operand) {
	var registerSelected = operand & 0xF;
	//Get the register data to be shifted:
	var register = parentObj.getDelayedRegisterRead(registerSelected);
	//Clock a cycle for the shift delaying the CPU:
	parentObj.wait.CPUInternalCyclePrefetch(parentObj.fetch, 1);
	//Shift the register data left:
	var shifter = (operand >> 7) & 0xFF;
	return (shifter < 0x20) ? (register << shifter) : 0;
}
ARMInstructionSet.prototype.llis = function (parentObj, operand) {
	var registerSelected = operand & 0xF;
	//Get the register data to be shifted:
	var register = parentObj.getDelayedRegisterRead(registerSelected);
	//Clock a cycle for the shift delaying the CPU:
	parentObj.wait.CPUInternalCyclePrefetch(parentObj.fetch, 1);
	//Get the shift amount:
	var shifter = ((operand >> 7) & 0xFF);
	//Check to see if we need to update CPSR:
	if (shifter >= 32) {
		parentObj.CPUCore.CPSRCarry = (shifter == 32 && (register & 0x1) == 0x1); 
		return 0;
	}
	else if (shifter > 0) {
		parentObj.CPUCore.CPSRCarry = ((register << (shifter - 1)) < 0); 
	}
	//Shift the register data left:
	return register << shifter;
}
ARMInstructionSet.prototype.llr = function (parentObj, operand) {
	var registerSelected = operand & 0xF;
	//Get the register data to be shifted:
	var register = parentObj.getDelayedRegisterRead(registerSelected);
	//Clock a cycle for the shift delaying the CPU:
	parentObj.wait.CPUInternalCyclePrefetch(parentObj.fetch, 1);
	//Shift the register data left:
	var shifter = parentObj.registers[(operand >> 8) & 0xF] & 0xFF;
	return (shifter < 0x20) ? (register << shifter) : 0;
}
ARMInstructionSet.prototype.llrs = function (parentObj, operand) {
	var registerSelected = operand & 0xF;
	//Get the register data to be shifted:
	var register = parentObj.getDelayedRegisterRead(registerSelected);
	//Clock a cycle for the shift delaying the CPU:
	parentObj.wait.CPUInternalCyclePrefetch(parentObj.fetch, 1);
	//Get the shift amount:
	var shifter = parentObj.registers[(operand >> 8) & 0xF] & 0xFF;
	//Check to see if we need to update CPSR:
	if (shifter >= 32) {
		parentObj.CPUCore.CPSRCarry = (shifter == 32 && (register & 0x1) == 0x1); 
		return 0;
	}
	else if (shifter > 0) {
		parentObj.CPUCore.CPSRCarry = ((register << (shifter - 1)) < 0); 
	}
	//Shift the register data left:
	return register << shifter;
}
ARMInstructionSet.prototype.lri = function (parentObj, operand) {
	var registerSelected = operand & 0xF;
	//Get the register data to be shifted:
	var register = parentObj.getDelayedRegisterRead(registerSelected);
	//Clock a cycle for the shift delaying the CPU:
	parentObj.wait.CPUInternalCyclePrefetch(parentObj.fetch, 1);
	//Shift the register data right logically:
	var shifter = (operand >> 7) & 0xFF;
	return (shifter < 0x20) ? ((register >>> shifter) | 0) : 0;
}
ARMInstructionSet.prototype.lris = function (parentObj, operand) {
	var registerSelected = operand & 0xF;
	//Get the register data to be shifted:
	var register = parentObj.getDelayedRegisterRead(registerSelected);
	//Clock a cycle for the shift delaying the CPU:
	parentObj.wait.CPUInternalCyclePrefetch(parentObj.fetch, 1);
	//Get the shift amount:
	var shifter = ((operand >> 7) & 0xFF);
	//Check to see if we need to update CPSR:
	if (shifter >= 32) {
		parentObj.CPUCore.CPSRCarry = (shifter == 32 && register < 0); 
		return 0;
	}
	else if (shifter > 0) {
		parentObj.CPUCore.CPSRCarry = (((register >>> (shifter - 1)) & 0x1) == 0x1); 
	}
	//Shift the register data right logically:
	return (register >>> shifter) | 0;
}
ARMInstructionSet.prototype.lrr = function (parentObj, operand) {
	var registerSelected = operand & 0xF;
	//Get the register data to be shifted:
	var register = parentObj.getDelayedRegisterRead(registerSelected);
	//Clock a cycle for the shift delaying the CPU:
	parentObj.wait.CPUInternalCyclePrefetch(parentObj.fetch, 1);
	//Shift the register data right logically:
	var shifter = parentObj.registers[(operand >> 8) & 0xF] & 0xFF;
	return (shifter < 0x20) ? ((register >>> shifter) | 0) : 0;
}
ARMInstructionSet.prototype.lrrs = function (parentObj, operand) {
	var registerSelected = operand & 0xF;
	//Get the register data to be shifted:
	var register = parentObj.getDelayedRegisterRead(registerSelected);
	//Clock a cycle for the shift delaying the CPU:
	parentObj.wait.CPUInternalCyclePrefetch(parentObj.fetch, 1);
	//Get the shift amount:
	var shifter = parentObj.registers[(operand >> 8) & 0xF] & 0xFF;
	//Check to see if we need to update CPSR:
	if (shifter >= 32) {
		parentObj.CPUCore.CPSRCarry = (shifter == 32 && register < 0); 
		return 0;
	}
	else if (shifter > 0) {
		parentObj.CPUCore.CPSRCarry = (((register >>> (shifter - 1)) & 0x1) == 0x1); 
	}
	//Shift the register data right logically:
	return (register >>> shifter) | 0;
}
ARMInstructionSet.prototype.ari = function (parentObj, operand) {
	var registerSelected = operand & 0xF;
	//Get the register data to be shifted:
	var register = parentObj.getDelayedRegisterRead(registerSelected);
	//Clock a cycle for the shift delaying the CPU:
	parentObj.wait.CPUInternalCyclePrefetch(parentObj.fetch, 1);
	//Shift the register data right:
	return register >> Math.min((operand >> 7) & 0xFF, 0x1F);
}
ARMInstructionSet.prototype.aris = function (parentObj, operand) {
	var registerSelected = operand & 0xF;
	//Get the register data to be shifted:
	var register = parentObj.getDelayedRegisterRead(registerSelected);
	//Clock a cycle for the shift delaying the CPU:
	parentObj.wait.CPUInternalCyclePrefetch(parentObj.fetch, 1);
	//Get the shift amount:
	var shifter = Math.min((operand >> 7) & 0xFF, 0x1F);
	//Check to see if we need to update CPSR:
	if (shifter > 0) {
		parentObj.CPUCore.CPSRCarry = (((register >>> (shifter - 1)) & 0x1) == 0x1); 
	}
	//Shift the register data right:
	return register >> shifter;
}
ARMInstructionSet.prototype.arr = function (parentObj, operand) {
	var registerSelected = operand & 0xF;
	//Get the register data to be shifted:
	var register = parentObj.getDelayedRegisterRead(registerSelected);
	//Clock a cycle for the shift delaying the CPU:
	parentObj.wait.CPUInternalCyclePrefetch(parentObj.fetch, 1);
	//Shift the register data right:
	return register >> Math.min(parentObj.registers[(operand >> 8) & 0xF] & 0xFF, 0x1F);
}
ARMInstructionSet.prototype.arrs = function (parentObj, operand) {
	var registerSelected = operand & 0xF;
	//Get the register data to be shifted:
	var register = parentObj.getDelayedRegisterRead(registerSelected);
	//Clock a cycle for the shift delaying the CPU:
	parentObj.wait.CPUInternalCyclePrefetch(parentObj.fetch, 1);
	//Get the shift amount:
	var shifter = Math.min(parentObj.registers[(operand >> 8) & 0xF] & 0xFF, 0x1F);
	//Check to see if we need to update CPSR:
	if (shifter > 0) {
		parentObj.CPUCore.CPSRCarry = (((register >>> (shifter - 1)) & 0x1) == 0x1); 
	}
	//Shift the register data right:
	return register >> shifter;
}
ARMInstructionSet.prototype.rri = function (parentObj, operand) {
	var registerSelected = operand & 0xF;
	//Get the register data to be shifted:
	var register = parentObj.getDelayedRegisterRead(registerSelected);
	//Clock a cycle for the shift delaying the CPU:
	parentObj.wait.CPUInternalCyclePrefetch(parentObj.fetch, 1);
	//Rotate the register right:
	var offset = (operand >> 7) & 0x1F;
	if (offset > 0) {
		//ROR
		return (register << (0x20 - offset)) | (register >>> offset);
	}
	else {
		//RRX
		return ((parentObj.CPUCore.CPSRCarry) ? 0x80000000 : 0) | (register >>> offset);
	}
}
ARMInstructionSet.prototype.rrr = function (parentObj, operand) {
	var registerSelected = operand & 0xF;
	//Get the register data to be shifted:
	var register = parentObj.getDelayedRegisterRead(registerSelected);
	//Clock a cycle for the shift delaying the CPU:
	parentObj.wait.CPUInternalCyclePrefetch(parentObj.fetch, 1);
	//Rotate the register right:
	var offset = parentObj.registers[(operand >> 8) & 0xF] & 0x1F;
	if (offset > 0) {
		//ROR
		return (register << (0x20 - offset)) | (register >>> offset);
	}
	else {
		//RRX
		return ((parentObj.CPUCore.CPSRCarry) ? 0x80000000 : 0) | (register >>> offset);
	}
}
ARMInstructionSet.prototype.rris = function (parentObj, operand) {
	var registerSelected = operand & 0xF;
	//Get the register data to be shifted:
	var register = parentObj.getDelayedRegisterRead(registerSelected);
	//Clock a cycle for the shift delaying the CPU:
	parentObj.wait.CPUInternalCyclePrefetch(parentObj.fetch, 1);
	//Rotate the register right:
	var shifter = (operand >> 7) & 0x1F;
	if (shifter > 0) {
		//ROR
		parentObj.CPUCore.CPSRCarry = (((register >>> (shifter - 1)) & 0x1) == 0x1);
		return (register << (0x20 - shifter)) | (register >>> shifter);
	}
	else {
		//RRX
		var oldCarry = (parentObj.CPUCore.CPSRCarry) ? 0x80000000 : 0;
		parentObj.CPUCore.CPSRCarry = ((register & 0x1) == 0x1);
		return oldCarry | (register >>> 1);
	}
}
ARMInstructionSet.prototype.rrrs = function (parentObj, operand) {
	var registerSelected = operand & 0xF;
	//Get the register data to be shifted:
	var register = parentObj.getDelayedRegisterRead(registerSelected);
	//Clock a cycle for the shift delaying the CPU:
	parentObj.wait.CPUInternalCyclePrefetch(parentObj.fetch, 1);
	//Rotate the register right:
	var shifter = parentObj.registers[(operand >> 8) & 0xF] & 0x1F;
	if (shifter > 0) {
		//ROR
		parentObj.CPUCore.CPSRCarry = (((register >>> (shifter - 1)) & 0x1) == 0x1);
		return (register << (0x20 - shifter)) | (register >>> shifter);
	}
	else {
		//RRX
		var oldCarry = (parentObj.CPUCore.CPSRCarry) ? 0x80000000 : 0;
		parentObj.CPUCore.CPSRCarry = ((register & 0x1) == 0x1);
		return oldCarry | (register >>> 1);
	}
}
ARMInstructionSet.prototype.imm = function (parentObj, operand) {
	//Get the immediate data to be shifted:
	var immediate = operand & 0xFF;
	//Rotate the immediate right:
	var shifter = ((operand >> 8) & 0xF) << 1;
	if (shifter > 0) {
		return (immediate << (0x20 - shifter)) | (immediate >>> shifter);
	}
	else {
		return immediate;
	}
}
ARMInstructionSet.prototype.rc = function (parentObj) {
	return (
		((parentObj.CPUCore.CPSRNegative) ? 0x80000000 : 0) |
		((parentObj.CPUCore.CPSRZero) ? 0x40000000 : 0) |
		((parentObj.CPUCore.CPSRCarry) ? 0x20000000 : 0) |
		((parentObj.CPUCore.CPSROverflow) ? 0x10000000 : 0) |
		((parentObj.CPUCore.IRQDisabled) ? 0x80 : 0) |
		((parentObj.CPUCore.FIQDisabled) ? 0x40 : 0) |
		((parentObj.CPUCore.InTHUMB) ? 0x20 : 0) |
		parentObj.CPUCore.MODEBits
	);
}
ARMInstructionSet.prototype.rcs = function (parentObj, operand) {
	operand = parentObj.registers[operand & 0xF];
	parentObj.CPUCore.CPSRNegative = (operand < 0);
	parentObj.CPUCore.CPSRZero = ((operand & 0x40000000) != 0);
	parentObj.CPUCore.CPSRCarry = ((operand & 0x20000000) != 0);
	parentObj.CPUCore.CPSROverflow = ((operand & 0x10000000) != 0);
	switch (parentObj.MODEBits) {
		case 0x10:
		case 0x1F:
			return;
		default:
			parentObj.CPUCore.IRQDisabled = ((operand & 0x80) != 0);
			parentObj.CPUCore.FIQDisabled = ((operand & 0x40) != 0);
			parentObj.CPUCore.InTHUMB = ((operand & 0x20) != 0);
			parentObj.CPUCore.switchRegisterBank(operand & 0x1F);
			parentObj.CPUCore.MODEBits = operand & 0x1F;
			debug_exception(parentObj.CPUCore.MODEBits);
	}
}
ARMInstructionSet.prototype.rs = function (parentObj) {
	switch (parentObj.MODEBits) {
		case 0x11:	//FIQ
			var spsr = parentObj.SPSRFIQ;
			break;
		case 0x12:	//IRQ
			var spsr = parentObj.SPSRIRQ;
			break;
		case 0x13:	//Supervisor
			var spsr = parentObj.SPSRSVC;
			break;
		case 0x17:	//Abort
			var spsr = parentObj.SPSRABT;
			break;
		case 0x1B:	//Undefined
			var spsr = parentObj.SPSRUND;
			break;
		default:
			//Instruction hit an invalid SPSR request:
			return parentObj.rc(parentObj);
	}
	return (
		((spsr[0]) ? 0x80000000 : 0) |
		((spsr[1]) ? 0x40000000 : 0) |
		((spsr[2]) ? 0x20000000 : 0) |
		((spsr[3]) ? 0x10000000 : 0) |
		((spsr[4]) ? 0x80 : 0) |
		((spsr[5]) ? 0x40 : 0) |
		((spsr[6]) ? 0x20 : 0) |
		spsr[7]
	);
}
ARMInstructionSet.prototype.rss = function (parentObj, operand) {
	operand = parentObj.registers[operand & 0xF];
	switch (parentObj.MODEBits) {
		case 0x11:	//FIQ
			var spsr = parentObj.SPSRFIQ;
			break;
		case 0x12:	//IRQ
			var spsr = parentObj.SPSRIRQ;
			break;
		case 0x13:	//Supervisor
			var spsr = parentObj.SPSRSVC;
			break;
		case 0x17:	//Abort
			var spsr = parentObj.SPSRABT;
			break;
		case 0x1B:	//Undefined
			var spsr = parentObj.SPSRUND;
			break;
		default:
			return;
	}
	spsr[0] = (operand < 0);
	spsr[1] = ((operand & 0x40000000) != 0);
	spsr[2] = ((operand & 0x20000000) != 0);
	spsr[3] = ((operand & 0x10000000) != 0);
	spsr[4] = ((operand & 0x80) != 0);
	spsr[5] = ((operand & 0x40) != 0);
	spsr[6] = ((operand & 0x20) != 0);
	spsr[7] = operand & 0x1F;
}
ARMInstructionSet.prototype.ic = function (parentObj, operand) {
	operand = parentObj.imm(parentObj, operand);
	parentObj.CPUCore.CPSRNegative = (operand < 0);
	parentObj.CPUCore.CPSRZero = ((operand & 0x40000000) != 0);
	parentObj.CPUCore.CPSRCarry = ((operand & 0x20000000) != 0);
	parentObj.CPUCore.CPSROverflow = ((operand & 0x10000000) != 0);
	switch (parentObj.MODEBits) {
		case 0x10:
		case 0x1F:
			return;
		default:
			parentObj.CPUCore.IRQDisabled = ((operand & 0x80) != 0);
			parentObj.CPUCore.FIQDisabled = ((operand & 0x40) != 0);
			parentObj.CPUCore.InTHUMB = ((operand & 0x20) != 0);
			parentObj.CPUCore.switchRegisterBank(operand & 0x1F);
			parentObj.CPUCore.MODEBits = operand & 0x1F;
			debug_exception(parentObj.CPUCore.MODEBits);
	}
}
ARMInstructionSet.prototype.is = function (parentObj, operand) {
	operand = parentObj.imm(parentObj, operand);
	switch (parentObj.MODEBits) {
		case 0x11:	//FIQ
			var spsr = parentObj.SPSRFIQ;
			break;
		case 0x12:	//IRQ
			var spsr = parentObj.SPSRIRQ;
			break;
		case 0x13:	//Supervisor
			var spsr = parentObj.SPSRSVC;
			break;
		case 0x17:	//Abort
			var spsr = parentObj.SPSRABT;
			break;
		case 0x1B:	//Undefined
			var spsr = parentObj.SPSRUND;
			break;
		default:
			return;
	}
	spsr[0] = (operand < 0);
	spsr[1] = ((operand & 0x40000000) != 0);
	spsr[2] = ((operand & 0x20000000) != 0);
	spsr[3] = ((operand & 0x10000000) != 0);
	spsr[4] = ((operand & 0x80) != 0);
	spsr[5] = ((operand & 0x40) != 0);
	spsr[6] = ((operand & 0x20) != 0);
	spsr[7] = operand & 0x1F;
}
ARMInstructionSet.prototype.ptrm = function (parentObj, operand) {
	var offset = parentObj.registers[operand & 0xF];
	var base = parentObj.registers[(operand >> 16) & 0xF];
	parentObj.guardRegisterWrite((operand >> 16) & 0xF, (base - offset) | 0);
	return base;
}
ARMInstructionSet.prototype.ptim = function (parentObj, operand) {
	var offset = ((operand & 0xF00) >> 4) | (operand & 0xF);
	var base = parentObj.registers[(operand >> 16) & 0xF];
	parentObj.guardRegisterWrite((operand >> 16) & 0xF, (base - offset) | 0);
	return base;
}
ARMInstructionSet.prototype.ptrp = function (parentObj, operand) {
	var offset = parentObj.registers[operand & 0xF];
	var base = parentObj.registers[(operand >> 16) & 0xF];
	parentObj.guardRegisterWrite((operand >> 16) & 0xF, (base + offset) | 0);
	return base;
}
ARMInstructionSet.prototype.ptip = function (parentObj, operand) {
	var offset = ((operand & 0xF00) >> 4) | (operand & 0xF);
	var base = parentObj.registers[(operand >> 16) & 0xF];
	parentObj.guardRegisterWrite((operand >> 16) & 0xF, (base + offset) | 0);
	return base;
}
ARMInstructionSet.prototype.ofrm = function (parentObj, operand) {
	var offset = parentObj.registers[operand & 0xF];
	return (parentObj.registers[(operand >> 16) & 0xF] - offset) | 0;
}
ARMInstructionSet.prototype.prrm = function (parentObj, operand) {
	var offset = parentObj.registers[operand & 0xF];
	var base = (parentObj.registers[(operand >> 16) & 0xF] - offset) | 0;
	parentObj.guardRegisterWrite((operand >> 16) & 0xF, base);
	return base;
}
ARMInstructionSet.prototype.ofim = function (parentObj, operand) {
	var offset = ((operand & 0xF00) >> 4) | (operand & 0xF);
	return (parentObj.registers[(operand >> 16) & 0xF] - offset) | 0;
}
ARMInstructionSet.prototype.prim = function (parentObj, operand) {
	var offset = ((operand & 0xF00) >> 4) | (operand & 0xF);
	var base = (parentObj.registers[(operand >> 16) & 0xF] - offset) | 0;
	parentObj.guardRegisterWrite((operand >> 16) & 0xF, base);
	return base;
}
ARMInstructionSet.prototype.ofrp = function (parentObj, operand) {
	var offset = parentObj.registers[operand & 0xF];
	return (parentObj.registers[(operand >> 16) & 0xF] + offset) | 0;
}
ARMInstructionSet.prototype.prrp = function (parentObj, operand) {
	var offset = parentObj.registers[operand & 0xF];
	var base = (parentObj.registers[(operand >> 16) & 0xF] + offset) | 0;
	parentObj.guardRegisterWrite((operand >> 16) & 0xF, base);
	return base;
}
ARMInstructionSet.prototype.ofip = function (parentObj, operand) {
	var offset = ((operand & 0xF00) >> 4) | (operand & 0xF);
	return (parentObj.registers[(operand >> 16) & 0xF] + offset) | 0;
}
ARMInstructionSet.prototype.prip = function (parentObj, operand) {
	var offset = ((operand & 0xF00) >> 4) | (operand & 0xF);
	var base = (parentObj.registers[(operand >> 16) & 0xF] + offset) | 0;
	parentObj.guardRegisterWrite((operand >> 16) & 0xF, base);
	return base;
}
ARMInstructionSet.prototype.ptrmll = function (parentObj, operand, userMode) {
	var offset = parentObj.llr(parentObj, operand);
	var base = parentObj.registers[(operand >> 16) & 0xF];
	parentObj.guardRegisterWriteSpecial((operand >> 16) & 0xF, base, userMode);
	return base;
}
ARMInstructionSet.prototype.ptrmlr = function (parentObj, operand, userMode) {
	var offset = parentObj.lrr(parentObj, operand);
	var base = parentObj.registers[(operand >> 16) & 0xF];
	parentObj.guardRegisterWriteSpecial((operand >> 16) & 0xF, base, userMode);
	return base;
}
ARMInstructionSet.prototype.ptrmar = function (parentObj, operand, userMode) {
	var offset = parentObj.arr(parentObj, operand);
	var base = parentObj.registers[(operand >> 16) & 0xF];
	parentObj.guardRegisterWriteSpecial((operand >> 16) & 0xF, base, userMode);
	return base;
}
ARMInstructionSet.prototype.ptrmrr = function (parentObj, operand, userMode) {
	var offset = parentObj.rrr(parentObj, operand);
	var base = parentObj.registers[(operand >> 16) & 0xF];
	parentObj.guardRegisterWriteSpecial((operand >> 16) & 0xF, base, userMode);
	return base;
}
ARMInstructionSet.prototype.sptim = function (parentObj, operand, userMode) {
	var offset = operand & 0xFFF;
	var base = parentObj.registers[(operand >> 16) & 0xF];
	parentObj.guardRegisterWriteSpecial((operand >> 16) & 0xF, base, userMode);
	return base;
}
ARMInstructionSet.prototype.ptrpll = function (parentObj, operand, userMode) {
	var offset = parentObj.llr(parentObj, operand);
	var base = parentObj.registers[(operand >> 16) & 0xF];
	parentObj.guardRegisterWriteSpecial((operand >> 16) & 0xF, (base + offset) | 0, userMode);
	return base;
}
ARMInstructionSet.prototype.ptrplr = function (parentObj, operand, userMode) {
	var offset = parentObj.lrr(parentObj, operand);
	var base = parentObj.registers[(operand >> 16) & 0xF];
	parentObj.guardRegisterWriteSpecial((operand >> 16) & 0xF, (base + offset) | 0, userMode);
	return base;
}
ARMInstructionSet.prototype.ptrpar = function (parentObj, operand, userMode) {
	var offset = parentObj.arr(parentObj, operand);
	var base = parentObj.registers[(operand >> 16) & 0xF];
	parentObj.guardRegisterWriteSpecial((operand >> 16) & 0xF, (base + offset) | 0, userMode);
	return base;
}
ARMInstructionSet.prototype.ptrprr = function (parentObj, operand, userMode) {
	var offset = parentObj.rrr(parentObj, operand);
	var base = parentObj.registers[(operand >> 16) & 0xF];
	parentObj.guardRegisterWriteSpecial((operand >> 16) & 0xF, (base + offset) | 0, userMode);
	return base;
}
ARMInstructionSet.prototype.sptip = function (parentObj, operand, userMode) {
	var offset = operand & 0xFFF;
	var base = parentObj.registers[(operand >> 16) & 0xF];
	parentObj.guardRegisterWriteSpecial((operand >> 16) & 0xF, (base + offset) | 0, userMode);
	return base;
}
ARMInstructionSet.prototype.ofrmll = function (parentObj, operand, userMode) {
	var offset = parentObj.llr(parentObj, operand);
	return (parentObj.registers[(operand >> 16) & 0xF] - offset) | 0;
}
ARMInstructionSet.prototype.ofrmlr = function (parentObj, operand, userMode) {
	var offset = parentObj.lrr(parentObj, operand);
	return (parentObj.registers[(operand >> 16) & 0xF] - offset) | 0;
}
ARMInstructionSet.prototype.ofrmar = function (parentObj, operand, userMode) {
	var offset = parentObj.arr(parentObj, operand);
	return (parentObj.registers[(operand >> 16) & 0xF] - offset) | 0;
}
ARMInstructionSet.prototype.ofrmrr = function (parentObj, operand, userMode) {
	var offset = parentObj.rrr(parentObj, operand);
	return (parentObj.registers[(operand >> 16) & 0xF] - offset) | 0;
}
ARMInstructionSet.prototype.prrmll = function (parentObj, operand, userMode) {
	var offset = parentObj.llr(parentObj, operand);
	var base = (parentObj.registers[(operand >> 16) & 0xF] - offset) | 0;
	parentObj.guardRegisterWriteSpecial((operand >> 16) & 0xF, base, userMode);
	return base;
}
ARMInstructionSet.prototype.prrmlr = function (parentObj, operand, userMode) {
	var offset = parentObj.lrr(parentObj, operand);
	var base = (parentObj.registers[(operand >> 16) & 0xF] - offset) | 0;
	parentObj.guardRegisterWriteSpecial((operand >> 16) & 0xF, base, userMode);
	return base;
}
ARMInstructionSet.prototype.prrmar = function (parentObj, operand, userMode) {
	var offset = parentObj.arr(parentObj, operand);
	var base = (parentObj.registers[(operand >> 16) & 0xF] - offset) | 0;
	parentObj.guardRegisterWriteSpecial((operand >> 16) & 0xF, base, userMode);
	return base;
}
ARMInstructionSet.prototype.prrmrr = function (parentObj, operand, userMode) {
	var offset = parentObj.rrr(parentObj, operand);
	var base = (parentObj.registers[(operand >> 16) & 0xF] - offset) | 0;
	parentObj.guardRegisterWriteSpecial((operand >> 16) & 0xF, base, userMode);
	return base;
}
ARMInstructionSet.prototype.sofim = function (parentObj, operand, userMode) {
	var offset = operand & 0xFFF;
	return (parentObj.registers[(operand >> 16) & 0xF] - offset) | 0;
}
ARMInstructionSet.prototype.sprim = function (parentObj, operand, userMode) {
	var offset = operand & 0xFFF;
	var base = (parentObj.registers[(operand >> 16) & 0xF] - offset) | 0;
	parentObj.guardRegisterWriteSpecial((operand >> 16) & 0xF, base, userMode);
	return base;
}
ARMInstructionSet.prototype.ofrpll = function (parentObj, operand, userMode) {
	var offset = parentObj.llr(parentObj, operand);
	return (parentObj.registers[(operand >> 16) & 0xF] + offset) | 0;
}
ARMInstructionSet.prototype.ofrplr = function (parentObj, operand, userMode) {
	var offset = parentObj.lrr(parentObj, operand);
	return (parentObj.registers[(operand >> 16) & 0xF] + offset) | 0;
}
ARMInstructionSet.prototype.ofrpar = function (parentObj, operand, userMode) {
	var offset = parentObj.arr(parentObj, operand);
	return (parentObj.registers[(operand >> 16) & 0xF] + offset) | 0;
}
ARMInstructionSet.prototype.ofrprr = function (parentObj, operand, userMode) {
	var offset = parentObj.rrr(parentObj, operand);
	return (parentObj.registers[(operand >> 16) & 0xF] + offset) | 0;
}
ARMInstructionSet.prototype.prrpll = function (parentObj, operand, userMode) {
	var offset = parentObj.llr(parentObj, operand);
	var base = (parentObj.registers[(operand >> 16) & 0xF] + offset) | 0;
	parentObj.guardRegisterWriteSpecial((operand >> 16) & 0xF, base, userMode);
	return base;
}
ARMInstructionSet.prototype.prrplr = function (parentObj, operand, userMode) {
	var offset = parentObj.lrr(parentObj, operand);
	var base = (parentObj.registers[(operand >> 16) & 0xF] + offset) | 0;
	parentObj.guardRegisterWriteSpecial((operand >> 16) & 0xF, base, userMode);
	return base;
}
ARMInstructionSet.prototype.prrpar = function (parentObj, operand, userMode) {
	var offset = parentObj.arr(parentObj, operand);
	var base = (parentObj.registers[(operand >> 16) & 0xF] + offset) | 0;
	parentObj.guardRegisterWriteSpecial((operand >> 16) & 0xF, base, userMode);
	return base;
}
ARMInstructionSet.prototype.prrprr = function (parentObj, operand, userMode) {
	var offset = parentObj.rrr(parentObj, operand);
	var base = (parentObj.registers[(operand >> 16) & 0xF] + offset) | 0;
	parentObj.guardRegisterWriteSpecial((operand >> 16) & 0xF, base, userMode);
	return base;
}
ARMInstructionSet.prototype.sofip = function (parentObj, operand, userMode) {
	var offset = operand & 0xFFF;
	return (parentObj.registers[(operand >> 16) & 0xF] + offset) | 0;
}
ARMInstructionSet.prototype.sprip = function (parentObj, operand, userMode) {
	var offset = operand & 0xFFF;
	var base = (parentObj.registers[(operand >> 16) & 0xF] + offset) | 0;
	parentObj.guardRegisterWriteSpecial((operand >> 16) & 0xF, base, userMode);
	return base;
}
ARMInstructionSet.prototype.NOP = function (parentObj, operand) {
	//nothing...
}
ARMInstructionSet.prototype.compileInstructionMap = function () {
	this.instructionMap = [
		//0
		[
			[
				this.AND,
				this.lli
			],
			[
				this.AND,
				this.llr
			],
			[
				this.AND,
				this.lri
			],
			[
				this.AND,
				this.lrr
			],
			[
				this.AND,
				this.ari
			],
			[
				this.AND,
				this.arr
			],
			[
				this.AND,
				this.rri
			],
			[
				this.AND,
				this.rrr
			],
			[
				this.AND,
				this.lli
			],
			[
				this.MUL,
				this.NOP
			],
			[
				this.AND,
				this.lri
			],
			[
				this.STRH,
				this.ptrm
			],
			[
				this.AND,
				this.ari
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.AND,
				this.rri
			],
			[
				this.UNDEFINED,
				this.NOP
			]
		],
		//1
		[
			[
				this.ANDS,
				this.llis
			],
			[
				this.ANDS,
				this.llrs
			],
			[
				this.ANDS,
				this.lris
			],
			[
				this.ANDS,
				this.lrrs
			],
			[
				this.ANDS,
				this.aris
			],
			[
				this.ANDS,
				this.arrs
			],
			[
				this.ANDS,
				this.rris
			],
			[
				this.ANDS,
				this.rrrs
			],
			[
				this.ANDS,
				this.llis
			],
			[
				this.MULS,
				this.NOP
			],
			[
				this.ANDS,
				this.lris
			],
			[
				this.LDRH,
				this.ptrm
			],
			[
				this.ANDS,
				this.aris
			],
			[
				this.LDRSB,
				this.ptrm
			],
			[
				this.ANDS,
				this.rris
			],
			[
				this.LDRSH,
				this.ptrm
			]
		],
		//2
		[
			[
				this.EOR,
				this.lli
			],
			[
				this.EOR,
				this.llr
			],
			[
				this.EOR,
				this.lri
			],
			[
				this.EOR,
				this.lrr
			],
			[
				this.EOR,
				this.ari
			],
			[
				this.EOR,
				this.arr
			],
			[
				this.EOR,
				this.rri
			],
			[
				this.EOR,
				this.rrr
			],
			[
				this.EOR,
				this.lli
			],
			[
				this.MLA,
				this.NOP
			],
			[
				this.EOR,
				this.lri
			],
			[
				this.STRH,
				this.ptrm
			],
			[
				this.EOR,
				this.ari
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.EOR,
				this.rri
			],
			[
				this.UNDEFINED,
				this.NOP
			]
		],
		//3
		[
			[
				this.EORS,
				this.llis
			],
			[
				this.EORS,
				this.llrs
			],
			[
				this.EORS,
				this.lris
			],
			[
				this.EORS,
				this.lrrs
			],
			[
				this.EORS,
				this.aris
			],
			[
				this.EORS,
				this.arrs
			],
			[
				this.EORS,
				this.rris
			],
			[
				this.EORS,
				this.rrrs
			],
			[
				this.EORS,
				this.llis
			],
			[
				this.MLAS,
				this.NOP
			],
			[
				this.EORS,
				this.lris
			],
			[
				this.LDRH,
				this.ptrm
			],
			[
				this.EORS,
				this.aris
			],
			[
				this.LDRSB,
				this.ptrm
			],
			[
				this.EORS,
				this.rris
			],
			[
				this.LDRSH,
				this.ptrm
			]
		],
		//4
		[
			[
				this.SUB,
				this.lli
			],
			[
				this.SUB,
				this.llr
			],
			[
				this.SUB,
				this.lri
			],
			[
				this.SUB,
				this.lrr
			],
			[
				this.SUB,
				this.ari
			],
			[
				this.SUB,
				this.arr
			],
			[
				this.SUB,
				this.rri
			],
			[
				this.SUB,
				this.rrr
			],
			[
				this.SUB,
				this.lli
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.SUB,
				this.lri
			],
			[
				this.STRH,
				this.ptim
			],
			[
				this.SUB,
				this.ari
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.SUB,
				this.rri
			],
			[
				this.UNDEFINED,
				this.NOP
			]
		],
		//5
		[
			[
				this.SUBS,
				this.lli
			],
			[
				this.SUBS,
				this.llr
			],
			[
				this.SUBS,
				this.lri
			],
			[
				this.SUBS,
				this.lrr
			],
			[
				this.SUBS,
				this.ari
			],
			[
				this.SUBS,
				this.arr
			],
			[
				this.SUBS,
				this.rri
			],
			[
				this.SUBS,
				this.rrr
			],
			[
				this.SUBS,
				this.lli
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.SUBS,
				this.lri
			],
			[
				this.LDRH,
				this.ptim
			],
			[
				this.SUBS,
				this.ari
			],
			[
				this.LDRSB,
				this.ptim
			],
			[
				this.SUBS,
				this.rri
			],
			[
				this.LDRSH,
				this.ptim
			]
		],
		//6
		[
			[
				this.RSB,
				this.lli
			],
			[
				this.RSB,
				this.llr
			],
			[
				this.RSB,
				this.lri
			],
			[
				this.RSB,
				this.lrr
			],
			[
				this.RSB,
				this.ari
			],
			[
				this.RSB,
				this.arr
			],
			[
				this.RSB,
				this.rri
			],
			[
				this.RSB,
				this.rrr
			],
			[
				this.RSB,
				this.lli
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.RSB,
				this.lri
			],
			[
				this.STRH,
				this.ptim
			],
			[
				this.RSB,
				this.ari
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.RSB,
				this.rri
			],
			[
				this.UNDEFINED,
				this.NOP
			]
		],
		//7
		[
			[
				this.RSBS,
				this.lli
			],
			[
				this.RSBS,
				this.llr
			],
			[
				this.RSBS,
				this.lri
			],
			[
				this.RSBS,
				this.lrr
			],
			[
				this.RSBS,
				this.ari
			],
			[
				this.RSBS,
				this.arr
			],
			[
				this.RSBS,
				this.rri
			],
			[
				this.RSBS,
				this.rrr
			],
			[
				this.RSBS,
				this.lli
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.RSBS,
				this.lri
			],
			[
				this.LDRH,
				this.ptim
			],
			[
				this.RSBS,
				this.ari
			],
			[
				this.LDRSB,
				this.ptim
			],
			[
				this.RSBS,
				this.rri
			],
			[
				this.LDRSH,
				this.ptim
			]
		],
		//8
		[
			[
				this.ADD,
				this.lli
			],
			[
				this.ADD,
				this.llr
			],
			[
				this.ADD,
				this.lri
			],
			[
				this.ADD,
				this.lrr
			],
			[
				this.ADD,
				this.ari
			],
			[
				this.ADD,
				this.arr
			],
			[
				this.ADD,
				this.rri
			],
			[
				this.ADD,
				this.rrr
			],
			[
				this.ADD,
				this.lli
			],
			[
				this.UMULL,
				this.NOP
			],
			[
				this.ADD,
				this.lri
			],
			[
				this.STRH,
				this.ptrp
			],
			[
				this.ADD,
				this.ari
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.ADD,
				this.rri
			],
			[
				this.UNDEFINED,
				this.NOP
			]
		],
		//9
		[
			[
				this.ADDS,
				this.lli
			],
			[
				this.ADDS,
				this.llr
			],
			[
				this.ADDS,
				this.lri
			],
			[
				this.ADDS,
				this.lrr
			],
			[
				this.ADDS,
				this.ari
			],
			[
				this.ADDS,
				this.arr
			],
			[
				this.ADDS,
				this.rri
			],
			[
				this.ADDS,
				this.rrr
			],
			[
				this.ADDS,
				this.lli
			],
			[
				this.UMULLS,
				this.NOP
			],
			[
				this.ADDS,
				this.lri
			],
			[
				this.LDRH,
				this.ptrp
			],
			[
				this.ADDS,
				this.ari
			],
			[
				this.LDRSB,
				this.ptrp
			],
			[
				this.ADDS,
				this.rri
			],
			[
				this.LDRSH,
				this.ptrp
			]
		],
		//A
		[
			[
				this.ADC,
				this.lli
			],
			[
				this.ADC,
				this.llr
			],
			[
				this.ADC,
				this.lri
			],
			[
				this.ADC,
				this.lrr
			],
			[
				this.ADC,
				this.ari
			],
			[
				this.ADC,
				this.arr
			],
			[
				this.ADC,
				this.rri
			],
			[
				this.ADC,
				this.rrr
			],
			[
				this.ADC,
				this.lli
			],
			[
				this.UMLAL,
				this.NOP
			],
			[
				this.ADC,
				this.lri
			],
			[
				this.STRH,
				this.ptrp
			],
			[
				this.ADC,
				this.ari
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.ADC,
				this.rri
			],
			[
				this.UNDEFINED,
				this.NOP
			]
		],
		//B
		[
			[
				this.ADCS,
				this.lli
			],
			[
				this.ADCS,
				this.llr
			],
			[
				this.ADCS,
				this.lri
			],
			[
				this.ADCS,
				this.lrr
			],
			[
				this.ADCS,
				this.ari
			],
			[
				this.ADCS,
				this.arr
			],
			[
				this.ADCS,
				this.rri
			],
			[
				this.ADCS,
				this.rrr
			],
			[
				this.ADCS,
				this.lli
			],
			[
				this.UMLALS,
				this.NOP
			],
			[
				this.ADCS,
				this.lri
			],
			[
				this.LDRH,
				this.ptrp
			],
			[
				this.ADCS,
				this.ari
			],
			[
				this.LDRSB,
				this.ptrp
			],
			[
				this.ADCS,
				this.rri
			],
			[
				this.LDRSH,
				this.ptrp
			]
		],
		//C
		[
			[
				this.SBC,
				this.lli
			],
			[
				this.SBC,
				this.llr
			],
			[
				this.SBC,
				this.lri
			],
			[
				this.SBC,
				this.lrr
			],
			[
				this.SBC,
				this.ari
			],
			[
				this.SBC,
				this.arr
			],
			[
				this.SBC,
				this.rri
			],
			[
				this.SBC,
				this.rrr
			],
			[
				this.SBC,
				this.lli
			],
			[
				this.SMULL,
				this.NOP
			],
			[
				this.SBC,
				this.lri
			],
			[
				this.STRH,
				this.ptip
			],
			[
				this.SBC,
				this.ari
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.SBC,
				this.rri
			],
			[
				this.UNDEFINED,
				this.NOP
			]
		],
		//D
		[
			[
				this.SBCS,
				this.lli
			],
			[
				this.SBCS,
				this.llr
			],
			[
				this.SBCS,
				this.lri
			],
			[
				this.SBCS,
				this.lrr
			],
			[
				this.SBCS,
				this.ari
			],
			[
				this.SBCS,
				this.arr
			],
			[
				this.SBCS,
				this.rri
			],
			[
				this.SBCS,
				this.rrr
			],
			[
				this.SBCS,
				this.lli
			],
			[
				this.SMULLS,
				this.NOP
			],
			[
				this.SBCS,
				this.lri
			],
			[
				this.LDRH,
				this.ptip
			],
			[
				this.SBCS,
				this.ari
			],
			[
				this.LDRSB,
				this.ptip
			],
			[
				this.SBCS,
				this.rri
			],
			[
				this.LDRSH,
				this.ptip
			]
		],
		//E
		[
			[
				this.RSC,
				this.lli
			],
			[
				this.RSC,
				this.llr
			],
			[
				this.RSC,
				this.lri
			],
			[
				this.RSC,
				this.lrr
			],
			[
				this.RSC,
				this.ari
			],
			[
				this.RSC,
				this.arr
			],
			[
				this.RSC,
				this.rri
			],
			[
				this.RSC,
				this.rrr
			],
			[
				this.RSC,
				this.lli
			],
			[
				this.SMLAL,
				this.NOP
			],
			[
				this.RSC,
				this.lri
			],
			[
				this.STRH,
				this.ptip
			],
			[
				this.RSC,
				this.ari
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.RSC,
				this.rri
			],
			[
				this.UNDEFINED,
				this.NOP
			]
		],
		//F
		[
			[
				this.RSCS,
				this.lli
			],
			[
				this.RSCS,
				this.llr
			],
			[
				this.RSCS,
				this.lri
			],
			[
				this.RSCS,
				this.lrr
			],
			[
				this.RSCS,
				this.ari
			],
			[
				this.RSCS,
				this.arr
			],
			[
				this.RSCS,
				this.rri
			],
			[
				this.RSCS,
				this.rrr
			],
			[
				this.RSCS,
				this.lli
			],
			[
				this.SMLALS,
				this.NOP
			],
			[
				this.RSCS,
				this.lri
			],
			[
				this.LDRH,
				this.ptip
			],
			[
				this.RSCS,
				this.ari
			],
			[
				this.LDRSB,
				this.ptip
			],
			[
				this.RSCS,
				this.rri
			],
			[
				this.LDRSH,
				this.ptip
			]
		],
		//10
		[
			[
				this.MRS,
				this.rc
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.SWP,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.STRH,
				this.ofrm
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			]
		],
		//11
		[
			[
				this.TSTS,
				this.llis
			],
			[
				this.TSTS,
				this.llrs
			],
			[
				this.TSTS,
				this.lris
			],
			[
				this.TSTS,
				this.lrrs
			],
			[
				this.TSTS,
				this.aris
			],
			[
				this.TSTS,
				this.arrs
			],
			[
				this.TSTS,
				this.rris
			],
			[
				this.TSTS,
				this.rrrs
			],
			[
				this.TSTS,
				this.llis
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.TSTS,
				this.lris
			],
			[
				this.LDRH,
				this.ofrm
			],
			[
				this.TSTS,
				this.aris
			],
			[
				this.LDRSB,
				this.ofrm
			],
			[
				this.TSTS,
				this.rris
			],
			[
				this.LDRSH,
				this.ofrm
			]
		],
		//12
		[
			[
				this.MSR,
				this.rcs
			],
			[
				this.BX,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.STRH,
				this.pprm
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			]
		],
		//13
		[
			[
				this.TEQS,
				this.llis
			],
			[
				this.TEQS,
				this.llrs
			],
			[
				this.TEQS,
				this.lris
			],
			[
				this.TEQS,
				this.lrrs
			],
			[
				this.TEQS,
				this.aris
			],
			[
				this.TEQS,
				this.arrs
			],
			[
				this.TEQS,
				this.rris
			],
			[
				this.TEQS,
				this.rrrs
			],
			[
				this.TEQS,
				this.llis
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.TEQS,
				this.lris
			],
			[
				this.LDRH,
				this.prrm
			],
			[
				this.TEQS,
				this.aris
			],
			[
				this.LDRSB,
				this.prrm
			],
			[
				this.TEQS,
				this.rris
			],
			[
				this.LDRSH,
				this.prrm
			]
		],
		//14
		[
			[
				this.MRS,
				this.rs
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.SWPB,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.STRH,
				this.ofim
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			]
		],
		//15
		[
			[
				this.CMPS,
				this.lli
			],
			[
				this.CMPS,
				this.llr
			],
			[
				this.CMPS,
				this.lri
			],
			[
				this.CMPS,
				this.lrr
			],
			[
				this.CMPS,
				this.ari
			],
			[
				this.CMPS,
				this.arr
			],
			[
				this.CMPS,
				this.rri
			],
			[
				this.CMPS,
				this.rrr
			],
			[
				this.CMPS,
				this.lli
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.CMPS,
				this.lri
			],
			[
				this.LDRH,
				this.ofim
			],
			[
				this.CMPS,
				this.ari
			],
			[
				this.LDRSB,
				this.ofim
			],
			[
				this.CMPS,
				this.rri
			],
			[
				this.LDRSH,
				this.ofim
			]
		],
		//16
		[
			[
				this.MSR,
				this.rss
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.STRH,
				this.prim
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.UNDEFINED,
				this.NOP
			]
		],
		//17
		[
			[
				this.CMNS,
				this.lli
			],
			[
				this.CMNS,
				this.llr
			],
			[
				this.CMNS,
				this.lri
			],
			[
				this.CMNS,
				this.lrr
			],
			[
				this.CMNS,
				this.ari
			],
			[
				this.CMNS,
				this.arr
			],
			[
				this.CMNS,
				this.rri
			],
			[
				this.CMNS,
				this.rrr
			],
			[
				this.CMNS,
				this.lli
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.CMNS,
				this.lri
			],
			[
				this.LDRH,
				this.prim
			],
			[
				this.CMNS,
				this.ari
			],
			[
				this.LDRSB,
				this.prim
			],
			[
				this.CMNS,
				this.rri
			],
			[
				this.LDRSH,
				this.prim
			]
		],
		//18
		[
			[
				this.ORR,
				this.lli
			],
			[
				this.ORR,
				this.llr
			],
			[
				this.ORR,
				this.lri
			],
			[
				this.ORR,
				this.lrr
			],
			[
				this.ORR,
				this.ari
			],
			[
				this.ORR,
				this.arr
			],
			[
				this.ORR,
				this.rri
			],
			[
				this.ORR,
				this.rrr
			],
			[
				this.ORR,
				this.lli
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.ORR,
				this.lri
			],
			[
				this.STRH,
				this.ofrp
			],
			[
				this.ORR,
				this.ari
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.ORR,
				this.rri
			],
			[
				this.UNDEFINED,
				this.NOP
			]
		],
		//19
		[
			[
				this.ORRS,
				this.llis
			],
			[
				this.ORRS,
				this.llrs
			],
			[
				this.ORRS,
				this.lris
			],
			[
				this.ORRS,
				this.lrrs
			],
			[
				this.ORRS,
				this.aris
			],
			[
				this.ORRS,
				this.arrs
			],
			[
				this.ORRS,
				this.rris
			],
			[
				this.ORRS,
				this.rrrs
			],
			[
				this.ORRS,
				this.llis
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.ORRS,
				this.lris
			],
			[
				this.LDRH,
				this.ofrp
			],
			[
				this.ORRS,
				this.aris
			],
			[
				this.LDRSB,
				this.ofrp
			],
			[
				this.ORRS,
				this.rris
			],
			[
				this.LDRSH,
				this.ofrp
			]
		],
		//1A
		[
			[
				this.MOV,
				this.lli
			],
			[
				this.MOV,
				this.llr
			],
			[
				this.MOV,
				this.lri
			],
			[
				this.MOV,
				this.lrr
			],
			[
				this.MOV,
				this.ari
			],
			[
				this.MOV,
				this.arr
			],
			[
				this.MOV,
				this.rri
			],
			[
				this.MOV,
				this.rrr
			],
			[
				this.MOV,
				this.lli
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.MOV,
				this.lri
			],
			[
				this.STRH,
				this.prrp
			],
			[
				this.MOV,
				this.ari
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.MOV,
				this.rri
			],
			[
				this.UNDEFINED,
				this.NOP
			]
		],
		//1B
		[
			[
				this.MOVS,
				this.llis
			],
			[
				this.MOVS,
				this.llrs
			],
			[
				this.MOVS,
				this.lris
			],
			[
				this.MOVS,
				this.lrrs
			],
			[
				this.MOVS,
				this.aris
			],
			[
				this.MOVS,
				this.arrs
			],
			[
				this.MOVS,
				this.rris
			],
			[
				this.MOVS,
				this.rrrs
			],
			[
				this.MOVS,
				this.llis
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.MOVS,
				this.lris
			],
			[
				this.LDRH,
				this.prrp
			],
			[
				this.MOVS,
				this.aris
			],
			[
				this.LDRSB,
				this.prrp
			],
			[
				this.MOVS,
				this.rris
			],
			[
				this.LDRSH,
				this.prrp
			]
		],
		//1C
		[
			[
				this.BIC,
				this.lli
			],
			[
				this.BIC,
				this.llr
			],
			[
				this.BIC,
				this.lri
			],
			[
				this.BIC,
				this.lrr
			],
			[
				this.BIC,
				this.ari
			],
			[
				this.BIC,
				this.arr
			],
			[
				this.BIC,
				this.rri
			],
			[
				this.BIC,
				this.rrr
			],
			[
				this.BIC,
				this.lli
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.BIC,
				this.lri
			],
			[
				this.STRH,
				this.ofip
			],
			[
				this.BIC,
				this.ari
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.BIC,
				this.rri
			],
			[
				this.UNDEFINED,
				this.NOP
			]
		],
		//1D
		[
			[
				this.BICS,
				this.llis
			],
			[
				this.BICS,
				this.llrs
			],
			[
				this.BICS,
				this.lris
			],
			[
				this.BICS,
				this.lrrs
			],
			[
				this.BICS,
				this.aris
			],
			[
				this.BICS,
				this.arrs
			],
			[
				this.BICS,
				this.rris
			],
			[
				this.BICS,
				this.rrrs
			],
			[
				this.BICS,
				this.llis
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.BICS,
				this.lris
			],
			[
				this.LDRH,
				this.ofip
			],
			[
				this.BICS,
				this.aris
			],
			[
				this.LDRSB,
				this.ofip
			],
			[
				this.BICS,
				this.rris
			],
			[
				this.LDRSH,
				this.ofip
			]
		],
		//1E
		[
			[
				this.MVN,
				this.lli
			],
			[
				this.MVN,
				this.llr
			],
			[
				this.MVN,
				this.lri
			],
			[
				this.MVN,
				this.lrr
			],
			[
				this.MVN,
				this.ari
			],
			[
				this.MVN,
				this.arr
			],
			[
				this.MVN,
				this.rri
			],
			[
				this.MVN,
				this.rrr
			],
			[
				this.MVN,
				this.lli
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.MVN,
				this.lri
			],
			[
				this.STRH,
				this.prip
			],
			[
				this.MVN,
				this.ari
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.MVN,
				this.rri
			],
			[
				this.UNDEFINED,
				this.NOP
			]
		],
		//1F
		[
			[
				this.MVNS,
				this.llis
			],
			[
				this.MVNS,
				this.llrs
			],
			[
				this.MVNS,
				this.lris
			],
			[
				this.MVNS,
				this.lrrs
			],
			[
				this.MVNS,
				this.aris
			],
			[
				this.MVNS,
				this.arrs
			],
			[
				this.MVNS,
				this.rris
			],
			[
				this.MVNS,
				this.rrrs
			],
			[
				this.MVNS,
				this.llis
			],
			[
				this.UNDEFINED,
				this.NOP
			],
			[
				this.MVNS,
				this.lris
			],
			[
				this.LDRH,
				this.prip
			],
			[
				this.MVNS,
				this.aris
			],
			[
				this.LDRSB,
				this.prip
			],
			[
				this.MVNS,
				this.rris
			],
			[
				this.LDRSH,
				this.prip
			]
		],
		//20
		this.generateLowMap(this.AND, this.imm),
		//21
		this.generateLowMap(this.ANDS, this.imm),
		//22
		this.generateLowMap(this.EOR, this.imm),
		//23
		this.generateLowMap(this.EORS, this.imm),
		//24
		this.generateLowMap(this.SUB, this.imm),
		//25
		this.generateLowMap(this.SUBS, this.imm),
		//26
		this.generateLowMap(this.RSB, this.imm),
		//27
		this.generateLowMap(this.RSBS, this.imm),
		//28
		this.generateLowMap(this.ADD, this.imm),
		//29
		this.generateLowMap(this.ADDS, this.imm),
		//2A
		this.generateLowMap(this.ADC, this.imm),
		//2B
		this.generateLowMap(this.ADCS, this.imm),
		//2C
		this.generateLowMap(this.SBC, this.imm),
		//2D
		this.generateLowMap(this.SBCS, this.imm),
		//2E
		this.generateLowMap(this.RSC, this.imm),
		//2F
		this.generateLowMap(this.RSCS, this.imm),
		//30
		this.generateLowMap(this.UNDEFINED, this.NOP),
		//31
		this.generateLowMap(this.TSTS, this.imm),
		//32
		this.generateLowMap(this.MSR, this.ic),
		//33
		this.generateLowMap(this.TEQS, this.imm),
		//34
		this.generateLowMap(this.UNDEFINED, this.NOP),
		//35
		this.generateLowMap(this.CMPS, this.imm),
		//36
		this.generateLowMap(this.MSR, this.is),
		//37
		this.generateLowMap(this.CMNS, this.imm),
		//38
		this.generateLowMap(this.ORR, this.imm),
		//39
		this.generateLowMap(this.ORRS, this.imm),
		//3A
		this.generateLowMap(this.MOV, this.imm),
		//3B
		this.generateLowMap(this.MOVS, this.imm),
		//3C
		this.generateLowMap(this.BIC, this.imm),
		//3D
		this.generateLowMap(this.BICS, this.imm),
		//3E
		this.generateLowMap(this.MVN, this.imm),
		//3F
		this.generateLowMap(this.MVNS, this.imm),
		//40
		this.generateLowMap(this.STR, this.sptim),
		//41
		this.generateLowMap(this.LDR, this.sptim),
		//42
		this.generateLowMap(this.STRT, this.sptim),
		//43
		this.generateLowMap(this.LDRT, this.sptim),
		//44
		this.generateLowMap(this.STRB, this.sptim),
		//45
		this.generateLowMap(this.LDRB, this.sptim),
		//46
		this.generateLowMap(this.STRBT, this.sptim),
		//47
		this.generateLowMap(this.LDRBT, this.sptim),
		//48
		this.generateLowMap(this.STR, this.sptip),
		//49
		this.generateLowMap(this.LDR, this.sptip),
		//4A
		this.generateLowMap(this.STRT, this.sptip),
		//4B
		this.generateLowMap(this.LDRT, this.sptip),
		//4C
		this.generateLowMap(this.STRB, this.sptip),
		//4D
		this.generateLowMap(this.LDRB, this.sptip),
		//4E
		this.generateLowMap(this.STRBT, this.sptip),
		//4F
		this.generateLowMap(this.LDRBT, this.sptip),
		//50
		this.generateLowMap(this.STR, this.sofim),
		//51
		this.generateLowMap(this.LDR, this.sofim),
		//52
		this.generateLowMap(this.STR, this.sprim),
		//53
		this.generateLowMap(this.LDR, this.sprim),
		//54
		this.generateLowMap(this.STRB, this.sofim),
		//55
		this.generateLowMap(this.LDRB, this.sofim),
		//56
		this.generateLowMap(this.STRB, this.sprim),
		//57
		this.generateLowMap(this.LDRB, this.sprim),
		//58
		this.generateLowMap(this.STR, this.sofip),
		//59
		this.generateLowMap(this.LDR, this.sofip),
		//5A
		this.generateLowMap(this.STR, this.sprip),
		//5B
		this.generateLowMap(this.LDR, this.sprip),
		//5C
		this.generateLowMap(this.STRB, this.sofip),
		//5D
		this.generateLowMap(this.LDRB, this.sofip),
		//5E
		this.generateLowMap(this.STRB, this.sprip),
		//5F
		this.generateLowMap(this.LDRB, this.sprip),
	];
	//60-6F
	this.generateStoreLoadInstructionSector1();
	//70-7F
	this.generateStoreLoadInstructionSector2();
	this.instructionMap = this.instructionMap.concat([
		//80
		this.generateLowMap(this.STMDA, this.guardMultiRegisterRead),
		//81
		this.generateLowMap(this.LDMDA, this.guardMultiRegisterWrite),
		//82
		this.generateLowMap(this.STMDAW, this.guardMultiRegisterRead),
		//83
		this.generateLowMap(this.LDMDAW, this.guardMultiRegisterWrite),
		//84
		this.generateLowMap(this.STMDA, this.guardMultiRegisterReadSpecial),
		//85
		this.generateLowMap(this.LDMDA, this.guardMultiRegisterWriteSpecial),
		//86
		this.generateLowMap(this.STMDAW, this.guardMultiRegisterReadSpecial),
		//87
		this.generateLowMap(this.LDMDAW, this.guardMultiRegisterWriteSpecial),
		//88
		this.generateLowMap(this.STMIA, this.guardMultiRegisterRead),
		//89
		this.generateLowMap(this.LDMIA, this.guardMultiRegisterWrite),
		//8A
		this.generateLowMap(this.STMIAW, this.guardMultiRegisterRead),
		//8B
		this.generateLowMap(this.LDMIAW, this.guardMultiRegisterWrite),
		//8C
		this.generateLowMap(this.STMIA, this.guardMultiRegisterReadSpecial),
		//8D
		this.generateLowMap(this.LDMIA, this.guardMultiRegisterWriteSpecial),
		//8E
		this.generateLowMap(this.STMIAW, this.guardMultiRegisterReadSpecial),
		//8F
		this.generateLowMap(this.LDMIAW, this.guardMultiRegisterWriteSpecial),
		//90
		this.generateLowMap(this.STMDB, this.guardMultiRegisterRead),
		//91
		this.generateLowMap(this.LDMDB, this.guardMultiRegisterWrite),
		//92
		this.generateLowMap(this.STMDBW, this.guardMultiRegisterRead),
		//93
		this.generateLowMap(this.LDMDBW, this.guardMultiRegisterWrite),
		//94
		this.generateLowMap(this.STMDB, this.guardMultiRegisterReadSpecial),
		//95
		this.generateLowMap(this.LDMDB, this.guardMultiRegisterWriteSpecial),
		//96
		this.generateLowMap(this.STMDBW, this.guardMultiRegisterReadSpecial),
		//97
		this.generateLowMap(this.LDMDBW, this.guardMultiRegisterWriteSpecial),
		//98
		this.generateLowMap(this.STMIB, this.guardMultiRegisterRead),
		//99
		this.generateLowMap(this.LDMIB, this.guardMultiRegisterWrite),
		//9A
		this.generateLowMap(this.STMIBW, this.guardMultiRegisterRead),
		//9B
		this.generateLowMap(this.LDMIBW, this.guardMultiRegisterWrite),
		//9C
		this.generateLowMap(this.STMIB, this.guardMultiRegisterReadSpecial),
		//9D
		this.generateLowMap(this.LDMIB, this.guardMultiRegisterWriteSpecial),
		//9E
		this.generateLowMap(this.STMIBW, this.guardMultiRegisterReadSpecial),
		//9F
		this.generateLowMap(this.LDMIBW, this.guardMultiRegisterWriteSpecial),
		//A0
		this.generateLowMap(this.B, this.NOP),
		//A1
		this.generateLowMap(this.B, this.NOP),
		//A2
		this.generateLowMap(this.B, this.NOP),
		//A3
		this.generateLowMap(this.B, this.NOP),
		//A4
		this.generateLowMap(this.B, this.NOP),
		//A5
		this.generateLowMap(this.B, this.NOP),
		//A6
		this.generateLowMap(this.B, this.NOP),
		//A7
		this.generateLowMap(this.B, this.NOP),
		//A8
		this.generateLowMap(this.B, this.NOP),
		//A9
		this.generateLowMap(this.B, this.NOP),
		//AA
		this.generateLowMap(this.B, this.NOP),
		//AB
		this.generateLowMap(this.B, this.NOP),
		//AC
		this.generateLowMap(this.B, this.NOP),
		//AD
		this.generateLowMap(this.B, this.NOP),
		//AE
		this.generateLowMap(this.B, this.NOP),
		//AF
		this.generateLowMap(this.B, this.NOP),
		//B0
		this.generateLowMap(this.BL, this.NOP),
		//B1
		this.generateLowMap(this.BL, this.NOP),
		//B2
		this.generateLowMap(this.BL, this.NOP),
		//B3
		this.generateLowMap(this.BL, this.NOP),
		//B4
		this.generateLowMap(this.BL, this.NOP),
		//B5
		this.generateLowMap(this.BL, this.NOP),
		//B6
		this.generateLowMap(this.BL, this.NOP),
		//B7
		this.generateLowMap(this.BL, this.NOP),
		//B8
		this.generateLowMap(this.BL, this.NOP),
		//B9
		this.generateLowMap(this.BL, this.NOP),
		//BA
		this.generateLowMap(this.BL, this.NOP),
		//BB
		this.generateLowMap(this.BL, this.NOP),
		//BC
		this.generateLowMap(this.BL, this.NOP),
		//BD
		this.generateLowMap(this.BL, this.NOP),
		//BE
		this.generateLowMap(this.BL, this.NOP),
		//BF
		this.generateLowMap(this.BL, this.NOP),
		//C0
		this.generateLowMap(this.STC, this.ofm),
		//C1
		this.generateLowMap(this.LDC, this.ofm),
		//C2
		this.generateLowMap(this.STC, this.prm),
		//C3
		this.generateLowMap(this.LDC, this.prm),
		//C4
		this.generateLowMap(this.STC, this.ofm),
		//C5
		this.generateLowMap(this.LDC, this.ofm),
		//C6
		this.generateLowMap(this.STC, this.prm),
		//C7
		this.generateLowMap(this.LDC, this.prm),
		//C8
		this.generateLowMap(this.STC, this.ofp),
		//C9
		this.generateLowMap(this.LDC, this.ofp),
		//CA
		this.generateLowMap(this.STC, this.prp),
		//CB
		this.generateLowMap(this.LDC, this.prp),
		//CC
		this.generateLowMap(this.STC, this.ofp),
		//CD
		this.generateLowMap(this.LDC, this.ofp),
		//CE
		this.generateLowMap(this.STC, this.prp),
		//CF
		this.generateLowMap(this.LDC, this.prp),
		//D0
		this.generateLowMap(this.STC, this.unm),
		//D1
		this.generateLowMap(this.LDC, this.unm),
		//D2
		this.generateLowMap(this.STC, this.ptm),
		//D3
		this.generateLowMap(this.LDC, this.ptm),
		//D4
		this.generateLowMap(this.STC, this.unm),
		//D5
		this.generateLowMap(this.LDC, this.unm),
		//D6
		this.generateLowMap(this.STC, this.ptm),
		//D7
		this.generateLowMap(this.LDC, this.ptm),
		//D8
		this.generateLowMap(this.STC, this.unp),
		//D9
		this.generateLowMap(this.LDC, this.unp),
		//DA
		this.generateLowMap(this.STC, this.ptp),
		//DB
		this.generateLowMap(this.LDC, this.ptp),
		//DC
		this.generateLowMap(this.STC, this.unp),
		//DD
		this.generateLowMap(this.LDC, this.unp),
		//DE
		this.generateLowMap(this.STC, this.ptp),
		//DF
		this.generateLowMap(this.LDC, this.ptp),
		//E0
		this.generateLowMap2(this.CDP, this.MCR),
		//E1
		this.generateLowMap2(this.CDP, this.MRC),
		//E2
		this.generateLowMap2(this.CDP, this.MCR),
		//E3
		this.generateLowMap2(this.CDP, this.MRC),
		//E4
		this.generateLowMap2(this.CDP, this.MCR),
		//E5
		this.generateLowMap2(this.CDP, this.MRC),
		//E6
		this.generateLowMap2(this.CDP, this.MCR),
		//E7
		this.generateLowMap2(this.CDP, this.MRC),
		//E8
		this.generateLowMap2(this.CDP, this.MCR),
		//E9
		this.generateLowMap2(this.CDP, this.MRC),
		//EA
		this.generateLowMap2(this.CDP, this.MCR),
		//EB
		this.generateLowMap2(this.CDP, this.MRC),
		//EC
		this.generateLowMap2(this.CDP, this.MCR),
		//ED
		this.generateLowMap2(this.CDP, this.MRC),
		//EE
		this.generateLowMap2(this.CDP, this.MCR),
		//EF
		this.generateLowMap2(this.CDP, this.MRC),
		//F0
		this.generateLowMap(this.SWI, this.NOP),
		//F1
		this.generateLowMap(this.SWI, this.NOP),
		//F2
		this.generateLowMap(this.SWI, this.NOP),
		//F3
		this.generateLowMap(this.SWI, this.NOP),
		//F4
		this.generateLowMap(this.SWI, this.NOP),
		//F5
		this.generateLowMap(this.SWI, this.NOP),
		//F6
		this.generateLowMap(this.SWI, this.NOP),
		//F7
		this.generateLowMap(this.SWI, this.NOP),
		//F8
		this.generateLowMap(this.SWI, this.NOP),
		//F9
		this.generateLowMap(this.SWI, this.NOP),
		//FA
		this.generateLowMap(this.SWI, this.NOP),
		//FB
		this.generateLowMap(this.SWI, this.NOP),
		//FC
		this.generateLowMap(this.SWI, this.NOP),
		//FD
		this.generateLowMap(this.SWI, this.NOP),
		//FE
		this.generateLowMap(this.SWI, this.NOP),
		//FF
		this.generateLowMap(this.SWI, this.NOP)
	]);
}
ARMInstructionSet.prototype.generateLowMap = function (instructionOpcode, dataOpcode) {
	return [
		[
			instructionOpcode,
			dataOpcode
		],
		[
			instructionOpcode,
			dataOpcode
		],
		[
			instructionOpcode,
			dataOpcode
		],
		[
			instructionOpcode,
			dataOpcode
		],
		[
			instructionOpcode,
			dataOpcode
		],
		[
			instructionOpcode,
			dataOpcode
		],
		[
			instructionOpcode,
			dataOpcode
		],
		[
			instructionOpcode,
			dataOpcode
		],
		[
			instructionOpcode,
			dataOpcode
		],
		[
			instructionOpcode,
			dataOpcode
		],
		[
			instructionOpcode,
			dataOpcode
		],
		[
			instructionOpcode,
			dataOpcode
		],
		[
			instructionOpcode,
			dataOpcode
		],
		[
			instructionOpcode,
			dataOpcode
		],
		[
			instructionOpcode,
			dataOpcode
		],
		[
			instructionOpcode,
			dataOpcode
		]
	];
}
ARMInstructionSet.prototype.generateLowMap2 = function (instructionOpcode, instructionOpcode2) {
	return [
		[
			instructionOpcode,
			this.NOP
		],
		[
			instructionOpcode2,
			this.NOP
		],
		[
			instructionOpcode,
			this.NOP
		],
		[
			instructionOpcode2,
			this.NOP
		],
		[
			instructionOpcode,
			this.NOP
		],
		[
			instructionOpcode2,
			this.NOP
		],
		[
			instructionOpcode,
			this.NOP
		],
		[
			instructionOpcode2,
			this.NOP
		],
		[
			instructionOpcode,
			this.NOP
		],
		[
			instructionOpcode2,
			this.NOP
		],
		[
			instructionOpcode,
			this.NOP
		],
		[
			instructionOpcode2,
			this.NOP
		],
		[
			instructionOpcode,
			this.NOP
		],
		[
			instructionOpcode2,
			this.NOP
		],
		[
			instructionOpcode,
			this.NOP
		],
		[
			instructionOpcode2,
			this.NOP
		]
	];
}
ARMInstructionSet.prototype.generateStoreLoadInstructionSector1 = function () {
	var instrMap = [
		this.STR,
		this.LDR,
		this.STRT,
		this.LDRT,
		this.STRB,
		this.LDRB,
		this.STRBT,
		this.LDRBT
	];
	var dataMap = [
		this.ptrmll,
		this.ptrmlr,
		this.ptrmar,
		this.ptrmrr
	];
	for (var instrIndex = 0; instrIndex < 0x10; ++instrIndex) {
		var lowMap = [];
		for (var dataIndex = 0; dataIndex < 0x10; ++dataIndex) {
			if ((dataIndex & 0x1) == 0) {
				lowMap.push([
					instrMap[instrIndex & 0x7],
					dataMap[(dataIndex >> 1) & 0x3]
				]);
			}
			else {
				lowMap.push([
					this.UNDEFINED,
					this.NOP
				]);
			}
		}
		this.instructionMap.push(lowMap);
	}
}
ARMInstructionSet.prototype.generateStoreLoadInstructionSector2 = function () {
	var instrMap = [
		this.STR,
		this.LDR,
		this.STR,
		this.LDR,
		this.STRB,
		this.LDRB,
		this.STRB,
		this.LDRB,
	];
	var dataMap = [
		[
			this.ofrmll,
			this.ofrmlr,
			this.ofrmar,
			this.ofrmrr
		],
		[
			this.prrmll,
			this.prrmlr,
			this.prrmar,
			this.prrmrr
		],
		[
			this.ofrpll,
			this.ofrplr,
			this.ofrpar,
			this.ofrprr
		],
		[
			this.prrpll,
			this.prrplr,
			this.prrpar,
			this.prrprr
		]
	];
	for (var instrIndex = 0; instrIndex < 0x10; ++instrIndex) {
		var lowMap = [];
		for (var dataIndex = 0; dataIndex < 0x10; ++dataIndex) {
			if ((dataIndex & 0x1) == 0) {
				lowMap.push([
					instrMap[instrIndex & 0x7],
					dataMap[((instrIndex & 0x8)  >> 2) | ((instrIndex & 0x3) >> 1)][(dataIndex >> 1) & 0x3]
				]);
			}
			else {
				lowMap.push([
					this.UNDEFINED,
					this.NOP
				]);
			}
		}
		this.instructionMap.push(lowMap);
	}
}