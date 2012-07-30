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
	this.generateLowMap2(this.MOVr0);
	//21
	this.generateLowMap2(this.MOVr1);
	//22
	this.generateLowMap2(this.MOVr2);
	//23
	this.generateLowMap2(this.MOVr3);
	//24
	this.generateLowMap2(this.MOVr4);
	//25
	this.generateLowMap2(this.MOVr5);
	//26
	this.generateLowMap2(this.MOVr6);
	//27
	this.generateLowMap2(this.MOVr7);
	//28
	this.generateLowMap2(this.CMPr0);
	//29
	this.generateLowMap2(this.CMPr1);
	//2A
	this.generateLowMap2(this.CMPr2);
	//2B
	this.generateLowMap2(this.CMPr3);
	//2C
	this.generateLowMap2(this.CMPr4);
	//2D
	this.generateLowMap2(this.CMPr5);
	//2E
	this.generateLowMap2(this.CMPr6);
	//2F
	this.generateLowMap2(this.CMPr7);
	//30
	this.generateLowMap2(this.ADDr0);
	//31
	this.generateLowMap2(this.ADDr1);
	//32
	this.generateLowMap2(this.ADDr2);
	//33
	this.generateLowMap2(this.ADDr3);
	//34
	this.generateLowMap2(this.ADDr4);
	//35
	this.generateLowMap2(this.ADDr5);
	//36
	this.generateLowMap2(this.ADDr6);
	//37
	this.generateLowMap2(this.ADDr7);
	//38
	this.generateLowMap2(this.SUBr0);
	//39
	this.generateLowMap2(this.SUBr1);
	//3A
	this.generateLowMap2(this.SUBr2);
	//3B
	this.generateLowMap2(this.SUBr3);
	//3C
	this.generateLowMap2(this.SUBr4);
	//3D
	this.generateLowMap2(this.SUBr5);
	//3E
	this.generateLowMap2(this.SUBr6);
	//3F
	this.generateLowMap2(this.SUBr7);
	//40
	this.generateLowMap3(this.AND, this.EOR, this.LSL, this.LSR);
	//41
	this.generateLowMap3(this.ASR, this.ADD, this.SUB, this.ROR);
	//42
	this.generateLowMap3(this.TST, this.NEG, this.CMP, this.CMN);
	//43
	this.generateLowMap3(this.ORR, this.MUL, this.BIC, this.MVN);
}