function ARM7TDMI() {
	
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
	//Supervisor mode registers (R12-R14):
	this.registersSVC = [0,0,0];
	//Abort mode registers (R12-R14):
	this.registersABT = [0,0,0];
	//IRQ mode registers (R12-R14):
	this.registersIRQ = [0,0,0];
	//Undefined mode registers (R12-R14):
	this.registersUND = [0,0,0];
	//CPSR Register:
	this.CPSRNegative = false;		//N Bit
	this.CPSRZero = false;			//Z Bit
	this.CPSROverflow = false;		//V Bit
	this.CPSRCarry = false;			//C Bit
	this.IRQDisabled = false;		//I Bit
	this.FIQDisabled = false;		//F Bit
	this.InARM = true;				//T Bit
	this.MODEBits = 0x10;			//M0 thru M4 Bits
	//Banked SPSR Registers:
	this.SPSRFIQ = [false, false, false, false, true, true, true, 0];	//FIQ
	this.SPSRIRQ = [false, false, false, false, true, true, true, 0];	//IRQ
	this.SPSRSVC = [false, false, false, false, true, true, true, 0];	//Supervisor
	this.SPSRABT = [false, false, false, false, true, true, true, 0];	//Abort
	this.SPSRUND = [false, false, false, false, true, true, true, 0];	//Undefined
	//Emulator variables:
	this.targetRegister = 0;
	this.shiftOffset = 0;
}
ARM7TDMI.prototype.ARM32PipelineStaging = function () {
	//Push the new fetch access:
	this.fetch = this.memory.request32(this.programCounter);
	//Execute Conditional Instruction:
	this.executeARM();
	//Update the pipelining state:
	this.instruction = this.decode;
	this.decode = this.fetch;
	//Update the prefetch abort status:
	this.instructionAbort = this.decodeAbort;
	if (this.fetchAbort) {
		this.decodeAbort = true;
		this.fetchAbort = false;
	}
}
/*ARM7TDMI.prototype.modeSwitch = function () {
	switch (this.MODEBits) {
		case 0x10:	//User
		case 0x1F:	//System
			break;
		case 0x11:	//FIQ
			break;
		case 0x12:	//IRQ
			break;
		case 0x13:	//Supervisor
			break;
		case 0x17:	//Abort
			break;
		case 0x1B:	//Undefined
	}
}*/
ARM7TDMI.prototype.SPSRtoCPSR = function () {
	//Used for leaving an exception and returning to the previous state:
	switch (this.MODEBits) {
		case 0x10:	//User
		case 0x1F:	//System
			return;
		case 0x11:	//FIQ
			var spsr = this.SPSRFIQ[0];
			break;
		case 0x12:	//IRQ
			var spsr = this.SPSRIRQ[1];
			break;
		case 0x13:	//Supervisor
			var spsr = this.SPSRSVC[2];
			break;
		case 0x17:	//Abort
			var spsr = this.SPSRABT[3];
			break;
		case 0x1B:	//Undefined
			var spsr = this.SPSRUND[4];
	}
	this.CPSRNegative = spsr[0];
	this.CPSRZero = spsr[1];
	this.CPSROverflow = spsr[2];
	this.CPSRCarry = spsr[3];
	this.IRQDisabled = spsr[4];
	this.FIQDisabled = spsr[5];
	this.InARM = spsr[6];
	this.MODEBits = spsr[7];
}
ARM7TDMI.prototype.checkMOVSPSR = function () {
	//Implied SPSR copy to CPSR when target is the program counter:
	if (this.targetRegister == 15) {
		this.SPSRtoCPSR();
	}
}
ARM7TDMI.prototype.targetRegisterCleanse32 = function (output) {
	//Make sure we cleanse for the PC assignment:
	return (this.targetRegister == 15) ? (output & -3) : output;
}
ARM7TDMI.prototype.targetRegisterCleanse32Safe = function (output) {
	//Make sure we cleanse for the PC assignment as well as 32 bit bounding:
	return (this.targetRegister == 15) ? (output & -3) : (output | 0);
}
ARM7TDMI.prototype.targetRegisterCleanse32andMOVSPSR = function (output) {
	//Make sure we cleanse for the PC assignment and check for SPSR to CPSR copy:
	if (this.targetRegister == 15) {
		this.SPSRtoCPSR();
		return (output & -3);
	}
	else {
		return output;
	}
}
ARM7TDMI.prototype.targetRegisterCleanse32SafeandMOVSPSR = function (output) {
	//Make sure we cleanse for the PC assignment and 32 bit bounding and check for SPSR to CPSR copy:
	if (this.targetRegister == 15) {
		this.SPSRtoCPSR();
		return (output & -3);
	}
	else {
		return (output | 0);
	}
}
ARM7TDMI.prototype.checkCarryReset = function () {
	//Reset the carry on a bitwise op if the shift was != 0:
	if (this.shiftOffset > 0) {
		this.SPSRtoCPSR();
	}
}
ARM7TDMI.prototype.shiftImmediate = function (immediate, shift) {
	//Used for computing the operand2 of shifted immediate-value instructions:
	if (shift == 0) {
		//No shift:
		return immediate;
	}
	//Rotated right and around:
	this.shiftOffset = shift;
	return ((immediate << (0x20 - shift)) | (immediate >> shift));
}
ARM7TDMI.prototype.MUL32 = function () {
	return (this.registers[(this.instruction & 0xF00) >> 8] * this.registers[this.instruction & 0xF]) | 0;
}
ARM7TDMI.prototype.MLA32 = function () {
	return ((this.registers[(this.instruction & 0F00) >> 8] * this.registers[this.instruction & 0xF]) + this.registers[(this.instruction & 0xF000) >> 12]) | 0;
}
ARM7TDMI.prototype.UMULL64 = function () {
	return (this.registers[(this.instruction & 0xF00) >> 8] >>> 0) * (this.registers[this.instruction & 0xF] >>> 0);
}
ARM7TDMI.prototype.UMLAL64 = function () {
	return (((this.registers[(this.instruction & 0xF00) >> 8] >>> 0) * (this.registers[this.instruction & 0xF] >>> 0)) + 
	((this.registers[(this.instruction & 0xF0000) >> 16] >>> 0) * 0x100000000) +
	(this.registers[(this.instruction & 0xF000) >> 12] >>> 0));
}
ARM7TDMI.prototype.SAVEMUL32 = function (value) {
	this.registers[(this.instruction & 0xF0000) >> 16] = value;
}
ARM7TDMI.prototype.CALCMUL32 = function (value) {
	this.CPSRZero = (value == 0);
	this.CPSRNegative = (value < 0);
	this.SAVEMUL32(value);
}
ARM7TDMI.prototype.SAVEMUL64 = function (value) {
	this.registers[(this.instruction & 0xF000) >> 12] = value | 0;
	this.registers[(this.instruction & 0xF0000) >> 16] = (value / 0x100000000) | 0;
}
ARM7TDMI.prototype.CALCMUL64 = function (value) {
	this.CPSRZero = (value == 0);
	this.CPSRNegative = (value < 0);
	this.SAVEMUL64(value);
}
ARM7TDMI.prototype.SWPWord = function () {
	var memory_address = this.registers[(this.instruction & 0xF0000) >> 16];
	var old_data = this.request32(memory_address);
	this.write32(memory_address, this.registers[this.instruction & 0xF]);
	this.registers[(this.instruction & 0xF000) >> 12] = old_data;
}
ARM7TDMI.prototype.SWPByte = function () {
	var memory_address = this.registers[(this.instruction & 0xF0000) >> 16];
	var old_data = this.request8(memory_address);
	this.write8(memory_address, this.registers[this.instruction & 0xF]);
	this.registers[(this.instruction & 0xF000) >> 12] = old_data;
}
ARM7TDMI.prototype.branchAndExchange = function () {	
	//Branch and Exchange (BX)
	this.registers[15] = this.registers[this.instruction & 0xF];
	//Clear the pipeline:
	this.decode = this.fetch = null;
	if ((this.registers[15] & 0x1) == 0x1) {
		//THUMB MODE:
		this.registers[15] &= -2;
		this.InARM = false;
	}
	else {
		//Stay in ARM mode:
		this.registers[15] &= -3;
	}
}
ARM7TDMI.prototype.performBranch = function () {
	//Branch (B)
	if ((this.instruction & 0x1000000) == 0x1000000) {
		//Branch With Link (BL)
		this.registers[14] = this.registers[15] - 4;	//LR register keeps a copy of the fetch memory address.
	}
	if ((this.instruction & 0x800000) == 0x800000) {
		//Negative Offset:
		this.registers[15] = (this.registers[15] + ((this.instruction & 0x7FFFFF) << 2) - 0x2000000) & -3;
	}
	else {
		//Positive Offset:
		this.registers[15] = (this.registers[15] + ((this.instruction & 0x7FFFFF) << 2) & -3;
	}
	//Clear the pipeline:
	this.decode = this.fetch = null;
}
ARM7TDMI.prototype.performDataProcessing = function () {
	//Data Processing / PSR Transfer
	//jump table (operand 1, operand 2, dest reg addr)
	//operand 1 is a value from a register.
	//operand 2 is an immediate value shifted.
	this.targetRegister = (this.instruction & 0xF000) >> 12;
	this.registers[this.targetRegister] = this.dataProcessingImmediate[(this.instruction & 0x1F00000) >> 20](this, this.registers[(this.instruction & 0xF0000) >> 16], this.shiftImmediate(this.instruction & 0xFF, (this.instruction & 0xF00) >> 7));
}
ARM7TDMI.prototype.conditionCodeTest = function () {
	switch (this.instruction >> 28) {
		case 0xE:		//AL (always)
						//Put this case first, since it's the most common!
			return true;
		case 0x0:		//EQ (equal)
			if (!this.CPSRZero) {
				return false;
			}
			break;
		case 0x1:		//NE (not equal)
			if (this.CPSRZero) {
				return false;
			}
			break;
		case 0x2:		//CS (unsigned higher or same)
			if (!this.CPSRCarry) {
				return false;
			}
			break;
		case 0x3:		//CC (unsigned lower)
			if (this.CPSRCarry) {
				return false;
			}
			break;
		case 0x4:		//MI (negative)
			if (!this.CPSRNegative) {
				return false;
			}
			break;
		case 0x5:		//PL (positive or zero)
			if (this.CPSRNegative) {
				return false;
			}
			break;
		case 0x6:		//VS (overflow)
			if (!this.CPSROverflow) {
				return false;
			}
			break;
		case 0x7:		//VC (no overflow)
			if (this.CPSROverflow) {
				return false;
			}
			break;
		case 0x8:		//HI (unsigned higher)
			if (!this.CPSRCarry || this.CPSRZero) {
				return false;
			}
			break;
		case 0x9:		//LS (unsigned lower or same)
			if (this.CPSRCarry && !this.CPSRZero) {
				return false;
			}
			break;
		case 0xA:		//GE (greater or equal)
			if (this.CPSRNegative != this.CPSROverflow) {
				return false;
			}
			break;
		case 0xB:		//LT (less than)
			if (this.CPSRNegative == this.CPSROverflow) {
				return false;
			}
			break;
		case 0xC:		//GT (greater than)
			if (this.CPSRZero || this.CPSRNegative != this.CPSROverflow) {
				return false;
			}
			break;
		case 0xD:		//LE (less than or equal)
			if (!this.CPSRZero && this.CPSRNegative == this.CPSROverflow) {
				return false;
			}
			break;
		//case 0xF:		//Reserved (Never Execute)
		default:
			return false;
	}
}
ARM7TDMI.prototype.executeARM = function () {
	if (this.instruction != null) {
		//Check the condition code:
		if (this.conditionCodeTest()) {
			//Check for prefetch abort:
			if (this.instructionAbort) {
				this.prefetchAbort();
			}
			this.executeARMInstruction();
		}
	}
}
ARM7TDMI.prototype.executeARMInstruction = function () {
	switch (this.instruction & 0x0E000000) {
		case 0x00000000:
			switch (this.instruction & 0x01F00000) {
				//Multiply (MUL / MLA)
				//MUL S=0
				case 0x00000000:
					this.SAVEMUL32(this.MUL32());
					break;
				//MUL S=1
				case 0x00100000:
					this.CALCMUL32(this.MUL32());
					break;
				//MLA S=0
				case 0x00200000:
					this.SAVEMUL32(this.MLA32());
					break;
				//MLA S=1
				case 0x00300000:
					this.CALCMUL32(this.MLA32());
					break;
				//Multiply Long (MULL / MLAL)
				//UMULL S=0
				case 0x00C00000:
					this.SAVEMUL64(this.UMULL64());
					break;
				//UMULL S=1
				case 0x00D00000:
					this.CALCMUL64(this.UMULL64());
					break;
				//UMLAL S=0
				case 0x00E00000:
					this.SAVEMUL64(this.UMLAL64());
					break;
				//UMLAL S=1
				case 0x00F00000:
					this.CALCMUL64(this.UMLAL64());
					break;
				//SWP Single Data Swap (Word)
				case 0x01000000:
					this.SWPWord();
					break;
				//BX, 
				case 0x01200000:
					//BX
					if ((this.instruction & 0x012FFFF0) == 0x012FFF10) {
						this.branchAndExchange();
					}
					else {
						
					}
					break;
				//SWP Single Data Swap (Byte)
				case 0x01400000:
					this.SWPByte();
					break;
				//Halfword Data Transfer: register offset
				//Halfword Data Transfer: immediate offset
			}
			break;
		case 0x02000000:
			//Data Processing / PSR Transfer
			this.performDataProcessing();
			break;
		case 0x04000000:
			//Single Data Transfer
			break;
		case 0x06000000:
			//Single Data Transfer
			break;
		case 0x08000000:
			//Block Data Transfer
			
			break;
		case 0x0A000000:
			//Branch:
			this.performBranch();
			break;
		case 0x0C000000:
			//Coprocessor Data Transfer
			break;
		case 0x0E000000:
			if (this.instruction & 0x01000000) {
				//Software Interrupt
			}
			else {
				//Coprocessor Data Operation
				//Coprocessor Register Transfer
			}
	}
}
//Data Processing Instruction w/ Immediate as Operand2
ARM7TDMI.prototype.dataProcessingImmediate = [
	////0x00:
	//AND S=0
	function (parentObj, operand1, operand2) {
		return operand1 & operand2;
	},
	//AND S=1
	function (parentObj, operand1, operand2) {
		var value = operand1 & operand2;
		if (value > 0) {
			parentObj.CPSRNegative = parentObj.CPSRZero = false;
		}
		else if (value < 0) {
			parentObj.CPSRNegative = true;
			parentObj.CPSRZero = false;
		}
		else {
			parentObj.CPSRNegative = false;
			parentObj.CPSRZero = true;
		}
		parentObj.checkCarryReset();
		return value;
	},
	////0x01:
	//EOR S=0
	function (parentObj, operand1, operand2) {
		return parentObj.targetRegisterCleanse32(operand1 ^ operand2);
	},
	//EOR S=1
	function (parentObj, operand1, operand2) {
		var value = operand1 ^ operand2;
		if (value > 0) {
			parentObj.CPSRNegative = parentObj.CPSRZero = false;
		}
		else if (value < 0) {
			parentObj.CPSRNegative = true;
			parentObj.CPSRZero = false;
		}
		else {
			parentObj.CPSRNegative = false;
			parentObj.CPSRZero = true;
		}
		parentObj.checkCarryReset();
		return parentObj.targetRegisterCleanse32(value);
	},
	////0x02:
	//SUB S=0
	function (parentObj, operand1, operand2) {
		return parentObj.targetRegisterCleanse32Safe(operand1 - operand2);
	},
	//SUB S=1
	function (parentObj, operand1, operand2) {
		var value = operand1 - operand2;
		var value_safe = value & -1;
		if (value != value_safe) {
			parentObj.CPSROverflow = true;
			parentObj.CPSRCarry = ((value >>> 0) != (value_safe >>> 0));
		}
		else {
			parentObj.CPSRCarry = parentObj.CPSROverflow = false;
		}
		if (value_safe > 0) {
			parentObj.CPSRNegative = parentObj.CPSRZero = false;
		}
		else if (value_safe < 0) {
			parentObj.CPSRNegative = true;
			parentObj.CPSRZero = false;
		}
		else {
			parentObj.CPSRNegative = false;
			parentObj.CPSRZero = true;
		}
		return parentObj.targetRegisterCleanse32(value_safe);
	},
	////0x03:
	//RSB S=0
	function (parentObj, operand1, operand2) {
		return parentObj.targetRegisterCleanse32Safe(operand2 - operand1);
	},
	//RSB S=1
	function (parentObj, operand1, operand2) {
		var value = operand2 - operand1;
		var value_safe = value & -1;
		if (value != value_safe) {
			parentObj.CPSROverflow = true;
			parentObj.CPSRCarry = ((value >>> 0) != (value_safe >>> 0));
		}
		else {
			parentObj.CPSRCarry = parentObj.CPSROverflow = false;
		}
		if (value_safe > 0) {
			parentObj.CPSRNegative = parentObj.CPSRZero = false;
		}
		else if (value_safe < 0) {
			parentObj.CPSRNegative = true;
			parentObj.CPSRZero = false;
		}
		else {
			parentObj.CPSRNegative = false;
			parentObj.CPSRZero = true;
		}
		return parentObj.targetRegisterCleanse32(value_safe);
	},
	////0x04:
	//ADD S=0
	function (parentObj, operand1, operand2) {
		return parentObj.targetRegisterCleanse32Safe(operand1 + operand2);
	},
	//ADD S=1
	function (parentObj, operand1, operand2) {
		var value = operand1 + operand2;
		var value_safe = value & -1;
		if (value != value_safe) {
			parentObj.CPSROverflow = true;
			parentObj.CPSRCarry = ((value >>> 0) != (value_safe >>> 0));
		}
		else {
			parentObj.CPSRCarry = parentObj.CPSROverflow = false;
		}
		if (value_safe > 0) {
			parentObj.CPSRNegative = parentObj.CPSRZero = false;
		}
		else if (value_safe < 0) {
			parentObj.CPSRNegative = true;
			parentObj.CPSRZero = false;
		}
		else {
			parentObj.CPSRNegative = false;
			parentObj.CPSRZero = true;
		}
		return parentObj.targetRegisterCleanse32(value_safe);
	}
	////0x05:
	//ADC S=0
	function (parentObj, operand1, operand2) {
		return parentObj.targetRegisterCleanse32Safe(operand1 + operand2 + ((parentObj.CPSRCarry) ? 1 : 0));
	},
	//ADC S=1
	function (parentObj, operand1, operand2) {
		var value = operand1 + operand2 + ((parentObj.CPSRCarry) ? 1 : 0);
		var value_safe = value & -1;
		if (value != value_safe) {
			parentObj.CPSROverflow = true;
			parentObj.CPSRCarry = ((value >>> 0) != (value_safe >>> 0));
		}
		else {
			parentObj.CPSRCarry = parentObj.CPSROverflow = false;
		}
		if (value_safe > 0) {
			parentObj.CPSRNegative = parentObj.CPSRZero = false;
		}
		else if (value_safe < 0) {
			parentObj.CPSRNegative = true;
			parentObj.CPSRZero = false;
		}
		else {
			parentObj.CPSRNegative = false;
			parentObj.CPSRZero = true;
		}
		return parentObj.targetRegisterCleanse32(value_safe);
	},
	////0x06:
	//SBC S=0
	function (parentObj, operand1, operand2) {
		return parentObj.targetRegisterCleanse32Safe(operand1 - operand2 - ((parentObj.CPSRCarry) ? 0 : 1));
	},
	//SBC S=1
	function (parentObj, operand1, operand2) {
		var value = operand1 - operand2 - (parentObj.CPSRCarry) ? 0 : 1);
		var value_safe = value & -1;
		if (value != value_safe) {
			parentObj.CPSROverflow = true;
			parentObj.CPSRCarry = ((value >>> 0) != (value_safe >>> 0));
		}
		else {
			parentObj.CPSRCarry = parentObj.CPSROverflow = false;
		}
		if (value_safe > 0) {
			parentObj.CPSRNegative = parentObj.CPSRZero = false;
		}
		else if (value_safe < 0) {
			parentObj.CPSRNegative = true;
			parentObj.CPSRZero = false;
		}
		else {
			parentObj.CPSRNegative = false;
			parentObj.CPSRZero = true;
		}
		return parentObj.targetRegisterCleanse32(value_safe);
	},
	////0x07:
	//RSC S=0
	function (parentObj, operand1, operand2) {
		return parentObj.targetRegisterCleanse32Safe(operand2 - operand1 - ((parentObj.CPSRCarry) ? 0 : 1));
	},
	//RSC S=1
	function (parentObj, operand1, operand2) {
		var value = operand2 - operand1 - (parentObj.CPSRCarry) ? 0 : 1);
		var value_safe = value & -1;
		if (value != value_safe) {
			parentObj.CPSROverflow = true;
			parentObj.CPSRCarry = ((value >>> 0) != (value_safe >>> 0));
		}
		else {
			parentObj.CPSRCarry = parentObj.CPSROverflow = false;
		}
		if (value_safe > 0) {
			parentObj.CPSRNegative = parentObj.CPSRZero = false;
		}
		else if (value_safe < 0) {
			parentObj.CPSRNegative = true;
			parentObj.CPSRZero = false;
		}
		else {
			parentObj.CPSRNegative = false;
			parentObj.CPSRZero = true;
		}
		return parentObj.targetRegisterCleanse32(value_safe);
	},
	////0x08:
	//TST S=0
	function (parentObj, operand1, operand2) {
		//LOL, is this a useless instruction?!?
		return operand1;
	},
	//TST S=1
	function (parentObj, operand1, operand2) {
		var value = operand1 & operand2;
		if (value > 0) {
			parentObj.CPSRNegative = parentObj.CPSRZero = false;
		}
		else if (value < 0) {
			parentObj.CPSRNegative = true;
			parentObj.CPSRZero = false;
		}
		else {
			parentObj.CPSRNegative = false;
			parentObj.CPSRZero = true;
		}
		parentObj.checkCarryReset();
		return operand1;
	},
	////0x09:
	//TEQ S=0
	function (parentObj, operand1, operand2) {
		//LOL, is this a useless instruction?!?
		return operand1;
	},
	//TEQ S=1
	function (parentObj, operand1, operand2) {
		var value = operand1 ^ operand2;
		if (value > 0) {
			parentObj.CPSRNegative = parentObj.CPSRZero = false;
		}
		else if (value < 0) {
			parentObj.CPSRNegative = true;
			parentObj.CPSRZero = false;
		}
		else {
			parentObj.CPSRNegative = false;
			parentObj.CPSRZero = true;
		}
		parentObj.checkCarryReset();
		return operand1;
	},
	////0x0A:
	//CMP S=0
	function (parentObj, operand1, operand2) {
		//LOL, is this a useless instruction?!?
		return operand1;
	},
	//CMP S=1
	function (parentObj, operand1, operand2) {
		var value = operand1 - operand2;
		var value_safe = value & -1;
		if (value != value_safe) {
			parentObj.CPSROverflow = true;
			parentObj.CPSRCarry = ((value >>> 0) != (value_safe >>> 0));
		}
		else {
			parentObj.CPSRCarry = parentObj.CPSROverflow = false;
		}
		if (value_safe > 0) {
			parentObj.CPSRNegative = parentObj.CPSRZero = false;
		}
		else if (value_safe < 0) {
			parentObj.CPSRNegative = true;
			parentObj.CPSRZero = false;
		}
		else {
			parentObj.CPSRNegative = false;
			parentObj.CPSRZero = true;
		}
		return operand1;
	},
	////0x0B:
	//CMN S=0
	function (parentObj, operand1, operand2) {
		//LOL, is this a useless instruction?!?
		return operand1;
	},
	//CMN S=1
	function (parentObj, operand1, operand2) {
		var value = operand1 + operand2;
		var value_safe = value & -1;
		if (value != value_safe) {
			parentObj.CPSROverflow = true;
			parentObj.CPSRCarry = ((value >>> 0) != (value_safe >>> 0));
		}
		else {
			parentObj.CPSRCarry = parentObj.CPSROverflow = false;
		}
		if (value_safe > 0) {
			parentObj.CPSRNegative = parentObj.CPSRZero = false;
		}
		else if (value_safe < 0) {
			parentObj.CPSRNegative = true;
			parentObj.CPSRZero = false;
		}
		else {
			parentObj.CPSRNegative = false;
			parentObj.CPSRZero = true;
		}
		return operand1;
	},
	////0x0C:
	//ORR S=0
	function (parentObj, operand1, operand2) {
		return parentObj.targetRegisterCleanse32(operand1 | operand2);
	},
	//ORR S=1
	function (parentObj, operand1, operand2) {
		var value = operand1 | operand2;
		if (value > 0) {
			parentObj.CPSRNegative = parentObj.CPSRZero = false;
		}
		else if (value < 0) {
			parentObj.CPSRNegative = true;
			parentObj.CPSRZero = false;
		}
		else {
			parentObj.CPSRNegative = false;
			parentObj.CPSRZero = true;
		}
		parentObj.checkCarryReset();
		return parentObj.targetRegisterCleanse32(value);
	},
	////0x0D:
	//MOV S=0
	function (parentObj, operand1, operand2) {
		return parentObj.targetRegisterCleanse32(operand2);
	},
	//MOV S=1
	function (parentObj, operand1, operand2) {
		if (operand2 > 0) {
			parentObj.CPSRNegative = parentObj.CPSRZero = false;
		}
		else if (operand2 < 0) {
			parentObj.CPSRNegative = true;
			parentObj.CPSRZero = false;
		}
		else {
			parentObj.CPSRNegative = false;
			parentObj.CPSRZero = true;
		}
		parentObj.checkCarryReset();
		return parentObj.targetRegisterCleanse32andMOVSPSR(operand2);
	},
	////0x0E:
	//BIC S=0
	function (parentObj, operand1, operand2) {
		return (operand1 & (~operand2));
	},
	//BIC S=1
	function (parentObj, operand1, operand2) {
		var value = (operand1 & (~operand2));
		if (value > 0) {
			parentObj.CPSRNegative = parentObj.CPSRZero = false;
		}
		else if (value < 0) {
			parentObj.CPSRNegative = true;
			parentObj.CPSRZero = false;
		}
		else {
			parentObj.CPSRNegative = false;
			parentObj.CPSRZero = true;
		}
		return value;
	},
	////0x0F:
	//MVN S=0
	function (parentObj, operand1, operand2) {
		return parentObj.targetRegisterCleanse32(~operand2);
	},
	//MVN S=1
	function (parentObj, operand1, operand2) {
		var value = ~operand2;
		if (value > 0) {
			parentObj.CPSRNegative = parentObj.CPSRZero = false;
		}
		else if (value < 0) {
			parentObj.CPSRNegative = true;
			parentObj.CPSRZero = false;
		}
		else {
			parentObj.CPSRNegative = false;
			parentObj.CPSRZero = true;
		}
		parentObj.checkCarryReset();
		return parentObj.targetRegisterCleanse32andMOVSPSR(value);
	}
];
ARM7TDMI.prototype.executeTHUMB = function () {
	
}