function ARM7TDMI() {
	this.compileARM32InstructionMap();
	this.compileTHUMBInstructionMap();
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
ARM7TDMI.prototype.compileARM32InstructionMap = function () {
	for (var index = 0; index < 0x1000; ++index) {
		if (index < 0x200) {
			switch (index & 0xF) {
				case 0x1:
				case 0x2:
				case 0x3:
				case 0x4:
				case 0x5:
				case 0x7:
				case 0x8:
				case 0xA:
				case 0xC:
				case 0xE:
					//Data Processing / PSR Transfers:
					switch (index >> 4) {
						case 0x20:
							this.ARM32OPCODE[index] = this.performANDRegister;
							break;
						case 0x21:
							this.ARM32OPCODE[index] = this.performANDSRegister;
							break;
					}
					break;
				case 9:
					switch (index >> 8) {
						case 0x00:
							//MUL
							this.ARM32OPCODE[index] = this.performMUL;
							break;
						case 0x01:
							//MULS
							this.ARM32OPCODE[index] = this.performMULS;
							break;
						case 0x02:
							//MLA
							this.ARM32OPCODE[index] = this.performMLA;
							break;
						case 0x03:
							//MLAS
							this.ARM32OPCODE[index] = this.performMLAS;
							break;
						case 0x08:
							//UMULL
							this.ARM32OPCODE[index] = this.performUMULL;
							break;
						case 0x09:
							//UMULLS
							this.ARM32OPCODE[index] = this.performUMULLS;
							break;
						case 0x0A:
							//UMLAL
							this.ARM32OPCODE[index] = this.performUMLAL;
							break;
						case 0x0B:
							//UMLALS
							this.ARM32OPCODE[index] = this.performUMLALS;
							break;
						case 0x0C:
							//UMULL
							this.ARM32OPCODE[index] = this.performMULL;
							break;
						case 0x0D:
							//MULLS
							this.ARM32OPCODE[index] = this.performMULLS;
							break;
						case 0x0E:
							//MLAL
							this.ARM32OPCODE[index] = this.performMLAL;
							break;
						case 0x0F:
							//MLALS
							this.ARM32OPCODE[index] = this.performMLALS;
							break;
						case 0x10:
							//SWP
							this.ARM32OPCODE[index] = this.performSWP;
							break;
						case 0x14:
							//SWPB
							this.ARM32OPCODE[index] = this.performSWPB;
							break;
						default:
							//Undefined
							this.ARM32OPCODE[index] = this.performUndefined;
					}
					break;
				default:
					//LDRH/STRH/LDRSB/LDRSH
			}
		}
		else if (index < 0x600) {
			switch (index >> 4) {
				case 0x20:
					this.ARM32OPCODE[index] = this.performANDImmediate;
					break;
				case 0x21:
					this.ARM32OPCODE[index] = this.performANDSImmediate;
					break;
				case 0x22:
					this.ARM32OPCODE[index] = this.performEORImmediate;
					break;
				case 0x23:
					this.ARM32OPCODE[index] = this.performEORSImmediate;
					break;
				case 0x24:
					this.ARM32OPCODE[index] = this.performSUBImmediate;
					break;
				case 0x25:
					this.ARM32OPCODE[index] = this.performSUBSImmediate;
					break;
				case 0x26:
					this.ARM32OPCODE[index] = this.performRSBImmediate;
					break;
				case 0x27:
					this.ARM32OPCODE[index] = this.performRSBSImmediate;
					break;
				case 0x28:
					this.ARM32OPCODE[index] = this.performADDImmediate;
					break;
				case 0x29:
					this.ARM32OPCODE[index] = this.performADDSImmediate;
					break;
				case 0x2A:
					this.ARM32OPCODE[index] = this.performADCImmediate;
					break;
				case 0x2B:
					this.ARM32OPCODE[index] = this.performADCSImmediate;
					break;
				case 0x2C:
					this.ARM32OPCODE[index] = this.performSBCImmediate;
					break;
				case 0x2D:
					this.ARM32OPCODE[index] = this.performSBCSImmediate;
					break;
				case 0x2E:
					this.ARM32OPCODE[index] = this.performRSCImmediate;
					break;
				case 0x2F:
					this.ARM32OPCODE[index] = this.performRSCSImmediate;
					break;
				case 0x30:
					this.ARM32OPCODE[index] = this.performUndefined;
					break;
				case 0x31:
					this.ARM32OPCODE[index] = this.performTSTSImmediate;
					break;
				case 0x32:
					this.ARM32OPCODE[index] = this.performMSRCImmediate;
					break;
				case 0x33:
					this.ARM32OPCODE[index] = this.performTEQSImmediate;
					break;
				case 0x34:
					this.ARM32OPCODE[index] = this.performUndefined;
					break;
				case 0x35:
					this.ARM32OPCODE[index] = this.performCMPSImmediate;
					break;
				case 0x36:
					this.ARM32OPCODE[index] = this.performMSRSImmediate;
					break;
				case 0x37:
					this.ARM32OPCODE[index] = this.performCMNSImmediate;
					break;
				case 0x38:
					this.ARM32OPCODE[index] = this.performORRSImmediate;
					break;
			}
		}
		else if (index < 0x800) {
			
		}
		else if (index < 0xA00) {
			
		}
		else if (index < 0xC00) {
			//Branch opcodes (0xA00 to 0xBFF)
			switch ((index - 0xA00) >> 7) {
				case 0:
					//B (Branch with positive offset):
					this.ARM32OPCODE[index] = this.performBranchNegative;
					break;
				case 1:
					//B (Branch with negative offset):
					this.ARM32OPCODE[index] = this.performBranchNegative;
					break;
				case 2:
					//BL (Branch with link with positive offset):
					this.ARM32OPCODE[index] = this.performBranchWithLinkPostive;
					break;
				case 3:
					//BL (Branch with link with negative offset):
					this.ARM32OPCODE[index] = this.performBranchWithLinkNegative;
			}	
		}
		else if (index < 0xF00) {
			
		}
		else {
			//SWI (Software Interrupt):
			this.ARM32OPCODE[index] = this.performSWI;
		}
	}
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
ARM7TDMI.prototype.performMUL = function (parentObj) {
	parentObj.SAVEMUL32(parentObj.MUL32());
}
ARM7TDMI.prototype.performMULS = function (parentObj) {
	parentObj.CALCMUL32(parentObj.MUL32());
}
ARM7TDMI.prototype.performMLA = function (parentObj) {
	parentObj.SAVEMUL32(parentObj.MLA32());
}
ARM7TDMI.prototype.performMLAS = function (parentObj) {
	parentObj.CALCMUL32(parentObj.MLA32());
}
ARM7TDMI.prototype.performMULL = function (parentObj) {
	parentObj.SAVEMUL64(parentObj.MULL64());
}
ARM7TDMI.prototype.performMULLS = function (parentObj) {
	parentObj.CALCMUL64(parentObj.MULL64());
}
ARM7TDMI.prototype.performMLAL = function (parentObj) {
	parentObj.SAVEMUL64(parentObj.MLAL64());
}
ARM7TDMI.prototype.performMLALS = function (parentObj) {
	parentObj.CALCMUL64(parentObj.MLAL64());
}
ARM7TDMI.prototype.performUMULL = function (parentObj) {
	parentObj.SAVEMUL64(parentObj.UMULL64());
}
ARM7TDMI.prototype.performUMULLS = function (parentObj) {
	parentObj.CALCMUL64(parentObj.UMULL64());
}
ARM7TDMI.prototype.performUMLAL = function (parentObj) {
	parentObj.SAVEMUL64(parentObj.UMLAL64());
}
ARM7TDMI.prototype.performUMLALS = function (parentObj) {
	parentObj.CALCMUL64(parentObj.UMLAL64());
}
ARM7TDMI.prototype.performSWP = function (parentObj) {
	var memory_address = parentObj.registers[(parentObj.instruction & 0xF0000) >> 16];
	var old_data = parentObj.request32(memory_address);
	parentObj.write32(memory_address, parentObj.registers[parentObj.instruction & 0xF]);
	parentObj.registers[(parentObj.instruction & 0xF000) >> 12] = old_data;
}
ARM7TDMI.prototype.performSWPB = function (parentObj) {
	var memory_address = parentObj.registers[(parentObj.instruction & 0xF0000) >> 16];
	var old_data = parentObj.request8(memory_address);
	parentObj.write8(memory_address, parentObj.registers[parentObj.instruction & 0xF]);
	parentObj.registers[(parentObj.instruction & 0xF000) >> 12] = old_data;
}
ARM7TDMI.prototype.performANDRegister = function (parentObj) {
	//AND Register
	parentObj.getDataProcessingDestination(parentObj.getDataProcessingOperand1() & parentObj.getDataProcessingOperand2Register());
};
ARM7TDMI.prototype.performANDImmediate = function (parentObj) {
	//AND Immediate
	parentObj.performBitwiseCPSRUpdate(parentObj.getDataProcessingOperand1() & parentObj.getDataProcessingOperand2Immediate());
};
ARM7TDMI.prototype.performANDSRegister = function (parentObj) {
	//ANDS Register
	parentObj.performBitwiseCPSRUpdate(parentObj.getDataProcessingOperand1() & parentObj.getDataProcessingOperand2Register());
	
};
ARM7TDMI.prototype.performANDSImmediate = function (parentObj) {
	//ANDS Immediate
	parentObj.performBitwiseCPSRUpdate(parentObj.getDataProcessingOperand1() & parentObj.getDataProcessingOperand2Immediate());
};
ARM7TDMI.prototype.performBranchPositive = function (parentObj) {
	//Branch (B)
	//Positive Offset:
	parentObj.registers[15] = (parentObj.registers[15] + ((parentObj.instruction & 0x7FFFFF) << 2) & -3;
	//Clear the pipeline:
	parentObj.decode = parentObj.fetch = null;
}
ARM7TDMI.prototype.performBranchNegative = function (parentObj) {
	//Branch (B)
	//Negative Offset:
	parentObj.registers[15] = (parentObj.registers[15] + ((parentObj.instruction & 0x7FFFFF) << 2) - 0x2000000) & -3;
	//Clear the pipeline:
	parentObj.decode = parentObj.fetch = null;
}
ARM7TDMI.prototype.performBranchWithLinkPositive = function (parentObj) {
	//Branch With Link (BL)
	parentObj.registers[14] = parentObj.registers[15] - 4;	//LR register keeps a copy of the fetch memory address.
	//Positive Offset:
	parentObj.registers[15] = (parentObj.registers[15] + ((parentObj.instruction & 0x7FFFFF) << 2) & -3;
	//Clear the pipeline:
	parentObj.decode = parentObj.fetch = null;
}
ARM7TDMI.prototype.performBranchWithLinkNegative = function (parentObj) {
	//Branch With Link (BL)
	parentObj.registers[14] = parentObj.registers[15] - 4;	//LR register keeps a copy of the fetch memory address.
	//Negative Offset:
	parentObj.registers[15] = (parentObj.registers[15] + ((parentObj.instruction & 0x7FFFFF) << 2) - 0x2000000) & -3;
	//Clear the pipeline:
	parentObj.decode = parentObj.fetch = null;
}
ARM7TDMI.prototype.performBitwiseCPSRUpdate = function (value) {
	//Do the flag updates:
	if (value > 0) {
		this.CPSRNegative = this.CPSRZero = false;
	}
	else if (value < 0) {
		this.CPSRNegative = true;
		parentObj.CPSRZero = false;
	}
	else {
		this.CPSRNegative = false;
		this.CPSRZero = true;
	}
	//Reset the carry on a bitwise op if the shift was != 0:
	if (this.shiftOffset > 0) {
		this.SPSRtoCPSR();
	}
	//Save the value to the target register:
	this.getDataProcessingDestination(value);
}
ARM7TDMI.prototype.performBranchAndExchange = function (parentObj) {	
	//Branch and Exchange (BX)
	parentObj.registers[15] = parentObj.registers[parentObj.instruction & 0xF];
	//Clear the pipeline:
	parentObj.decode = parentObj.fetch = null;
	if ((parentObj.registers[15] & 0x1) == 0x1) {
		//THUMB MODE:
		parentObj.registers[15] &= -2;
		parentObj.InARM = false;
	}
	else {
		//Stay in ARM mode:
		parentObj.registers[15] &= -3;
	}
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
ARM7TDMI.prototype.secondaryARMInstructionDispatch = function () {
			switch (this.instruction & 0x1F00000) {
				//MUL S=0
				case 0x0000000:
					switch (this.instruction & 0xF0) {
							this.SAVEMUL32(this.MUL32());
							break;
					}
					break;
				//MUL S=1
				case 0x0100000:
					this.CALCMUL32(this.MUL32());
					break;
				//MLA S=0
				case 0x0200000:
					this.SAVEMUL32(this.MLA32());
					break;
				//MLA S=1
				case 0x0300000:
					this.CALCMUL32(this.MLA32());
					break;
				//MULL S=0
				case 0x0800000:
					this.SAVEMUL64(this.MULL64());
					break;
				//MULL S=1
				case 0x0900000:
					this.CALCMUL64(this.MULL64());
					break;
				//MLAL S=0
				case 0x0A00000:
					this.SAVEMUL64(this.MLAL64());
					break;
				//MLAL S=1
				case 0x0B00000:
					this.CALCMUL64(this.MLAL64());
					break;
				//UMULL S=0
				case 0x0C00000:
					this.SAVEMUL64(this.UMULL64());
					break;
				//UMULL S=1
				case 0x0D00000:
					this.CALCMUL64(this.UMULL64());
					break;
				//UMLAL S=0
				case 0x0E00000:
					this.SAVEMUL64(this.UMLAL64());
					break;
				//UMLAL S=1
				case 0x0F00000:
					this.CALCMUL64(this.UMLAL64());
					break;
				case 0x1000000:
					if ((this.instruction & 0xF90) == 0x090) {
						if ((this.instruction & 0xFF0) == 0x090) {
							//SWP:
							this.SWPWord();
						}
						else {
							//LDRH/STRH/LDRSB/LDRSH:
							this.processComplexDataTransferByRegister();
						}
					}
					else {
						this.dataProcessingByRegister();
					}
					break;
				//BX, 
				case 0x1200000:
					//BX
					if ((this.instruction & 0xFFFF0) == 0xFFF10) {
						this.branchAndExchange();
					}
					else {
						this.dataProcessingByRegister();
					}
					break;
				case 0x1400000:
					if ((this.instruction & 0x90) == 0x90) {
						if ((this.instruction & 0xFF0) == 0x090) {
							//SWP:
							this.SWPByte();
						}
						else {
							//LDRH/STRH/LDRSB/LDRSH:
							this.processComplexDataTransferByImmediate();
						}
					}
					else {
						this.dataProcessingByRegister();
					}
					break;
				default:
					this.dataProcessingByRegister();
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
ARM7TDMI.prototype.MULL64 = function () {
	return this.registers[(this.instruction & 0xF00) >> 8] * this.registers[this.instruction & 0xF];
}
ARM7TDMI.prototype.MLAL64 = function () {
	return ((this.registers[(this.instruction & 0xF00) >> 8] * this.registers[this.instruction & 0xF]) + 
	(this.registers[(this.instruction & 0xF0000) >> 16] * 0x100000000) +
	this.registers[(this.instruction & 0xF000) >> 12]);
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