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
	this.resetPipeline();
	this.compileInstructionMap();
}
THUMBInstructionSet.prototype.resetPipeline = function () {
	this.fetch = 0;
	this.decode = 0;
	this.execute = 0;
	this.pipelineInvalid = 0x3;
}
THUMBInstructionSet.prototype.executeIteration = function () {
	//Push the new fetch access:
	this.fetch = this.wait.CPUGetOpcode16(this.registers[15]);
	//Execute Instruction:
	this.executeTHUMB();
	//Update the pipelining state:
	this.execute = this.decode;
	this.decode = this.fetch;
}
THUMBInstructionSet.prototype.executeTHUMB = function () {
	if (this.pipelineInvalid == 0) {
		//No condition code:
		this.instructionMap[this.execute >> 10](this);
	}
	else {
		//Tick the pipeline invalidation:
		this.pipelineInvalid >>= 1;
	}
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
	//20
	this.generateLowMap3(this.MOVr0);
	//21
	this.generateLowMap3(this.MOVr1);
	//22
	this.generateLowMap3(this.MOVr2);
	//23
	this.generateLowMap3(this.MOVr3);
	//24
	this.generateLowMap3(this.MOVr4);
	//25
	this.generateLowMap3(this.MOVr5);
	//26
	this.generateLowMap3(this.MOVr6);
	//27
	this.generateLowMap3(this.MOVr7);
	//28
	this.generateLowMap3(this.CMPr0);
	//29
	this.generateLowMap3(this.CMPr1);
	//2A
	this.generateLowMap3(this.CMPr2);
	//2B
	this.generateLowMap3(this.CMPr3);
	//2C
	this.generateLowMap3(this.CMPr4);
	//2D
	this.generateLowMap3(this.CMPr5);
	//2E
	this.generateLowMap3(this.CMPr6);
	//2F
	this.generateLowMap3(this.CMPr7);
	//30
	this.generateLowMap3(this.ADDr0);
	//31
	this.generateLowMap3(this.ADDr1);
	//32
	this.generateLowMap3(this.ADDr2);
	//33
	this.generateLowMap3(this.ADDr3);
	//34
	this.generateLowMap3(this.ADDr4);
	//35
	this.generateLowMap3(this.ADDr5);
	//36
	this.generateLowMap3(this.ADDr6);
	//37
	this.generateLowMap3(this.ADDr7);
	//38
	this.generateLowMap3(this.SUBr0);
	//39
	this.generateLowMap3(this.SUBr1);
	//3A
	this.generateLowMap3(this.SUBr2);
	//3B
	this.generateLowMap3(this.SUBr3);
	//3C
	this.generateLowMap3(this.SUBr4);
	//3D
	this.generateLowMap3(this.SUBr5);
	//3E
	this.generateLowMap3(this.SUBr6);
	//3F
	this.generateLowMap3(this.SUBr7);
	//40
	this.generateLowMap4(this.AND, this.EOR, this.LSL, this.LSR);
	//41
	this.generateLowMap4(this.ASR, this.ADD, this.SUB, this.ROR);
	//42
	this.generateLowMap4(this.TST, this.NEG, this.CMP, this.CMN);
	//43
	this.generateLowMap4(this.ORR, this.MUL, this.BIC, this.MVN);
	//44
	this.generateLowMap3(this.ADDH);
	//45
	this.generateLowMap3(this.CMPH);
	//46
	this.generateLowMap3(this.MOVH);
	//47
	this.generateLowMap3(this.BX);
	//48
	this.generateLowMap3(this.LDRPCr0);
	//49
	this.generateLowMap3(this.LDRPCr1);
	//4A
	this.generateLowMap3(this.LDRPCr2);
	//4B
	this.generateLowMap3(this.LDRPCr3);
	//4C
	this.generateLowMap3(this.LDRPCr4);
	//4D
	this.generateLowMap3(this.LDRPCr5);
	//4E
	this.generateLowMap3(this.LDRPCr6);
	//4F
	this.generateLowMap3(this.LDRPCr7);
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
	//90
	this.generateLowMap3(this.STRSPr0);
	//91
	this.generateLowMap3(this.STRSPr1);
	//92
	this.generateLowMap3(this.STRSPr2);
	//93
	this.generateLowMap3(this.STRSPr3);
	//94
	this.generateLowMap3(this.STRSPr4);
	//95
	this.generateLowMap3(this.STRSPr5);
	//96
	this.generateLowMap3(this.STRSPr6);
	//97
	this.generateLowMap3(this.STRSPr7);
	//98
	this.generateLowMap3(this.LDRSPr0);
	//99
	this.generateLowMap3(this.LDRSPr1);
	//9A
	this.generateLowMap3(this.LDRSPr2);
	//9B
	this.generateLowMap3(this.LDRSPr3);
	//9C
	this.generateLowMap3(this.LDRSPr4);
	//9D
	this.generateLowMap3(this.LDRSPr5);
	//9E
	this.generateLowMap3(this.LDRSPr6);
	//9F
	this.generateLowMap3(this.LDRSPr7);
	//A0
	this.generateLowMap3(this.ADDPCr0);
	//A1
	this.generateLowMap3(this.ADDPCr1);
	//A2
	this.generateLowMap3(this.ADDPCr2);
	//A3
	this.generateLowMap3(this.ADDPCr3);
	//A4
	this.generateLowMap3(this.ADDPCr4);
	//A5
	this.generateLowMap3(this.ADDPCr5);
	//A6
	this.generateLowMap3(this.ADDPCr6);
	//A7
	this.generateLowMap3(this.ADDPCr7);
	//A8
	this.generateLowMap3(this.ADDSPr0);
	//A9
	this.generateLowMap3(this.ADDSPr1);
	//AA
	this.generateLowMap3(this.ADDSPr2);
	//AB
	this.generateLowMap3(this.ADDSPr3);
	//AC
	this.generateLowMap3(this.ADDSPr4);
	//AD
	this.generateLowMap3(this.ADDSPr5);
	//AE
	this.generateLowMap3(this.ADDSPr6);
	//AF
	this.generateLowMap3(this.ADDSPr7);
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
	//C0
	this.generateLowMap3(this.STMIAr0);
	//C1
	this.generateLowMap3(this.STMIAr1);
	//C2
	this.generateLowMap3(this.STMIAr2);
	//C3
	this.generateLowMap3(this.STMIAr3);
	//C4
	this.generateLowMap3(this.STMIAr4);
	//C5
	this.generateLowMap3(this.STMIAr5);
	//C6
	this.generateLowMap3(this.STMIAr6);
	//C7
	this.generateLowMap3(this.STMIAr7);
	//C8
	this.generateLowMap3(this.LDMIAr0);
	//C9
	this.generateLowMap3(this.LDMIAr1);
	//CA
	this.generateLowMap3(this.LDMIAr2);
	//CB
	this.generateLowMap3(this.LDMIAr3);
	//CC
	this.generateLowMap3(this.LDMIAr4);
	//CD
	this.generateLowMap3(this.LDMIAr5);
	//CE
	this.generateLowMap3(this.LDMIAr6);
	//CF
	this.generateLowMap3(this.LDMIAr7);
}