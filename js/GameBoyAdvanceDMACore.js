function GameBoyAdvanceDMA(IOCore) {
	this.IOCore = IOCore;
	this.emulatorCore = IOCore.emulatorCore;
	this.initialize();
}
GameBoyAdvanceDMA.prototype.DMA_TYPE = {
	IMMEDIATE:		0x1,
	V_BLANK:		0x2,
	H_BLANK:		0x4,
	FIFO_A:			0x8,
	FIFO_B:			0x10,
	DISPLAY_SYNC:	0x20
}
GameBoyAdvanceDMA.prototype.initialize = function () {
	this.enabled = [0, 0, 0, 0];
	this.pending = this.DMA_TYPE.FIFO_A | this.DMA_TYPE.FIFO_B;
	this.source = [0, 0, 0, 0];
	this.sourceSource = [0, 0, 0, 0];
	this.destination = [0, 0, 0, 0];
	this.destinationSource = [0, 0, 0, 0];
	this.wordCount = [0, 0, 0, 0];
	this.wordCountSource = [0, 0, 0, 0];
	this.control = [
		[false, 0, false, false, 0, 0],
		[false, 0, false, false, 0, 0],
		[false, 0, false, false, 0, 0],
		[false, 0, false, false, 0, 0]
	];
}
GameBoyAdvanceDMA.prototype.writeDMA0Source = function (byteNumber, data) {
	this.sourceSource[0] &= ~(0xFF << (byteNumber << 3));
	this.sourceSource[0] |= data << (byteNumber << 3);
	this.source[0] = this.sourceSource[0];
}
GameBoyAdvanceDMA.prototype.writeDMA0Destination = function (byteNumber, data) {
	this.destinationSource[0] &= ~(0xFF << (byteNumber << 3));
	this.destinationSource[0] |= data << (byteNumber << 3);
	this.destination[0] = this.destinationSource[0];
}
GameBoyAdvanceDMA.prototype.writeDMA0WordCount0 = function (data) {
	this.wordCountSource[0] &= 0x3F00;
	this.wordCountSource[0] |= data;
	this.wordCount[0] = this.wordCountSource[0];
}
GameBoyAdvanceDMA.prototype.writeDMA0WordCount1 = function (data) {
	this.wordCountSource[0] &= 0xFF;
	this.wordCountSource[0] |= data << 8;
	this.wordCount[0] = this.wordCountSource[0];
}
GameBoyAdvanceDMA.prototype.writeDMA0Control0 = function (data) {
	this.control[0][5] = (data >> 5) & 0x3;
	this.control[0][4] &= 0x2;
	this.control[0][4] |= (data >> 7) & 0x1;
}
GameBoyAdvanceDMA.prototype.writeDMA1Source = function (byteNumber, data) {
	this.sourceSource[1] &= ~(0xFF << (byteNumber << 3));
	this.sourceSource[1] |= data << (byteNumber << 3);
	this.source[1] = this.sourceSource[1];
}
GameBoyAdvanceDMA.prototype.writeDMA1Destination = function (byteNumber, data) {
	this.destinationSource[1] &= ~(0xFF << (byteNumber << 3));
	this.destinationSource[1] |= data << (byteNumber << 3);
	this.destination[1] = this.destinationSource[1];
}
GameBoyAdvanceDMA.prototype.writeDMA1WordCount0 = function (data) {
	this.wordCountSource[1] &= 0x3F00;
	this.wordCountSource[1] |= data;
	this.wordCount[1] = this.wordCountSource[1];
}
GameBoyAdvanceDMA.prototype.writeDMA1WordCount1 = function (data) {
	this.wordCountSource[1] &= 0xFF;
	this.wordCountSource[1] |= data << 8;
	this.wordCount[1] = this.wordCountSource[1];
}
GameBoyAdvanceDMA.prototype.writeDMA1Control0 = function (data) {
	this.control[1][5] = (data >> 5) & 0x3;
	this.control[1][4] &= 0x2;
	this.control[1][4] |= (data >> 7) & 0x1;
}
GameBoyAdvanceDMA.prototype.writeDMA2Source = function (byteNumber, data) {
	this.sourceSource[2] &= ~(0xFF << (byteNumber << 3));
	this.sourceSource[2] |= data << (byteNumber << 3);
	this.source[2] = this.sourceSource[2];
}
GameBoyAdvanceDMA.prototype.writeDMA2Destination = function (byteNumber, data) {
	this.destinationSource[2] &= ~(0xFF << (byteNumber << 3));
	this.destinationSource[2] |= data << (byteNumber << 3);
	this.destination[2] = this.destinationSource[2];
}
GameBoyAdvanceDMA.prototype.writeDMA2WordCount0 = function (data) {
	this.wordCountSource[2] &= 0x3F00;
	this.wordCountSource[2] |= data;
	this.wordCount[2] = this.wordCountSource[2];
}
GameBoyAdvanceDMA.prototype.writeDMA2WordCount1 = function (data) {
	this.wordCountSource[2] &= 0xFF;
	this.wordCountSource[2] |= data << 8;
	this.wordCount[2] = this.wordCountSource[2];
}
GameBoyAdvanceDMA.prototype.writeDMA2Control0 = function (data) {
	this.control[2][5] = (data >> 5) & 0x3;
	this.control[2][4] &= 0x2;
	this.control[2][4] |= (data >> 7) & 0x1;
}
GameBoyAdvanceDMA.prototype.writeDMA3Source = function (byteNumber, data) {
	this.sourceSource[3] &= ~(0xFF << (byteNumber << 3));
	this.sourceSource[3] |= data << (byteNumber << 3);
	this.source[3] = this.sourceSource[3];
}
GameBoyAdvanceDMA.prototype.writeDMA3Destination = function (byteNumber, data) {
	this.destinationSource[3] &= ~(0xFF << (byteNumber << 3));
	this.destinationSource[3] |= data << (byteNumber << 3);
	this.destination[3] = this.destinationSource[3];
}
GameBoyAdvanceDMA.prototype.writeDMA3WordCount0 = function (data) {
	this.wordCountSource[3] &= 0x3F00;
	this.wordCountSource[3] |= data;
	this.wordCount[3] = this.wordCountSource[3];
}
GameBoyAdvanceDMA.prototype.writeDMA3WordCount1 = function (data) {
	this.wordCountSource[3] &= 0xFF;
	this.wordCountSource[3] |= data << 8;
	this.wordCount[3] = this.wordCountSource[3];
}
GameBoyAdvanceDMA.prototype.writeDMA3Control0 = function (data) {
	this.control[3][5] = (data >> 5) & 0x3;
	this.control[3][4] &= 0x2;
	this.control[3][4] |= (data >> 7) & 0x1;
}
GameBoyAdvanceDMA.prototype.soundFIFOARequest = function () {
	this.requestDMA(this.DMA_TYPE.FIFO_A);
}
GameBoyAdvanceDMA.prototype.soundFIFOBRequest = function () {
	this.requestDMA(this.DMA_TYPE.FIFO_B);
}
GameBoyAdvanceDMA.prototype.requestDMA = function (DMAType) {
	this.pending |= DMAType;
	this.IOCore.systemStatus |= 0x1;
}
GameBoyAdvanceDMA.prototype.process = function () {
	//Solve for the highest priority DMA to process:
	for (var dmaPriority = 0; dmaPriority < 4; ++dmaPriority) {
		this.currentMatch = this.enabled[dmaPriority] & this.pending;
		if (this.currentMatch != 0) {
			this.handleDMACopy(dmaPriority);
			return false;
		}
	}
	//If no DMA was processed, then the DMA period has ended:
	return true;
}
GameBoyAdvanceDMA.prototype.handleDMACopy = function (dmaChannel) {
	//Get the addesses:
	var source = this.source[dmaChannel];
	var destination = this.destination[dmaChannel];
	//Make sure we have access to the source and destination buses:
	if (this.addressFree(source) && this.addressFree(destination)) {
		//Load in the control register:
		var control = this.control[dmaChannel];
		//Transfer Data:
		if (this.isSoundDMA()) {
			//32-bit FIFO Transfer:
			destination = 0x40000A0 | ((dmaChannel - 1) << 2);
			this.IOCore.memoryWrite32(destination, this.IOCore.memoryRead32(source));
			this.decrementWordCount(control, dmaChannel, source, destination, 4);
		}
		else if (control[2]) {
			//32-bit Transfer:
			this.IOCore.memoryWrite32(destination, this.IOCore.memoryRead32(source));
			this.decrementWordCount(control, dmaChannel, source, destination, 4);
		}
		else {
			//16-bit Transfer:
			this.IOCore.memoryWrite16(destination, this.IOCore.memoryRead16(source));
			this.decrementWordCount(control, dmaChannel, source, destination, 2);
		}
	}
}
GameBoyAdvanceDMA.prototype.decrementWordCount = function (control, dmaChannel, source, destination, transferred) {
	var wordCount = (this.wordCount[dmaChannel] - 1) & 0x3FFF;
	if (wordCount == 0) {
		if (!control[3]) {
			//Disable the enable bit:
			this.enabled[dmaChannel] = 0;
		}
		//DMA period has ended:
		this.pending -= this.currentMatch;
		//Check to see if we should flag for IRQ:
		if (control[0]) {
			this.IOCore.irq.requestIRQ(dmaChannel << 8);
		}
		//Update source address:
		switch (control[4]) {
			case 0:	//Increment
				this.source[dmaChannel] = (source + transferred) & -1;
				break;
			case 1:	//Decrement
				this.source[dmaChannel] = (source - transferred) & -1;
				break;
			case 3:	//Reload
				//Prohibited code, should not get here:
				this.source[dmaChannel] = this.sourceSource[dmaChannel];
		}
		//FIFO DMA cannot update destination register:
		if (!this.isSoundDMA()) {
			//Update destination address:
			switch (control[5]) {
				case 0:	//Increment
					this.destination[dmaChannel] = (destination + transferred) & -1;
					break;
				case 1:	//Decrement
					this.destination[dmaChannel] = (destination - transferred) & -1;
					break;
				case 3:	//Reload
					this.destination[dmaChannel] = this.destinationSource[dmaChannel];
			}
		}
	}
	else {
		//Save the new word count:
		this.wordCount[dmaChannel] = wordCount;
		//Update source address:
		switch (control[4]) {
			case 0:	//Increment
			case 3:	//Prohibited code...
				this.source[dmaChannel] = (source + transferred) & -1;
				break;
			case 1:
				this.source[dmaChannel] = (source - transferred) & -1;
		}
		//FIFO DMA cannot update destination register:
		if (!this.isSoundDMA()) {
			//Update destination address:
			switch (control[5]) {
				case 0:	//Increment
				case 3:	//Increment
					this.destination[dmaChannel] = (destination + transferred) & -1;
					break;
				case 1:	//Decrement
					this.destination[dmaChannel] = (destination - transferred) & -1;
			}
		}
	}
}
GameBoyAdvanceDMA.prototype.isSoundDMA = function () {
	return (this.currentMatch == this.DMA_TYPE.FIFO_A || this.currentMatch == this.DMA_TYPE.FIFO_B);
}