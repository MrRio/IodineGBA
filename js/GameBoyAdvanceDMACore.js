function GameBoyAdvanceDMA(IOCore) {
	this.IOCore = IOCore;
	this.emulatorCore = IOCore.emulatorCore;
	this.initialize();
}
GameBoyAdvanceDMA.prototype.DMA_ENABLE_TYPE = [
	[			//DMA Channel 0 Mapping:
		0x1,
		0x2,
		0x4,
		0
	],
	[			//DMA Channel 1 Mapping:
		0x1,
		0x2,
		0x4,
		0x8
	],
	[			//DMA Channel 2 Mapping:
		0x1,
		0x2,
		0x4,
		0x10
	],
	[			//DMA Channel 3 Mapping:
		0x1,
		0x2,
		0x4,
		0x20
	],
];
GameBoyAdvanceDMA.prototype.DMA_REQUEST_TYPE = {
	PROHIBITED:		0,
	IMMEDIATE:		0x1,
	V_BLANK:		0x2,
	H_BLANK:		0x4,
	FIFO_A:			0x8,
	FIFO_B:			0x10,
	DISPLAY_SYNC:	0x20
}
GameBoyAdvanceDMA.prototype.initialize = function () {
	this.enabled = [0, 0, 0, 0];
	this.pending = this.DMA_REQUEST_TYPE.FIFO_A | this.DMA_REQUEST_TYPE.FIFO_B;
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
GameBoyAdvanceDMA.prototype.writeDMASource = function (dmaChannel, byteNumber, data) {
	this.sourceSource[dmaChannel] &= ~(0xFF << (byteNumber << 3));
	this.sourceSource[dmaChannel] |= data << (byteNumber << 3);
}
GameBoyAdvanceDMA.prototype.writeDMADestination = function (dmaChannel, byteNumber, data) {
	this.destinationSource[dmaChannel] &= ~(0xFF << (byteNumber << 3));
	this.destinationSource[dmaChannel] |= data << (byteNumber << 3);
}
GameBoyAdvanceDMA.prototype.writeDMAWordCount0 = function (dmaChannel, data) {
	this.wordCountSource[dmaChannel] &= 0x3F00;
	this.wordCountSource[dmaChannel] |= data;
}
GameBoyAdvanceDMA.prototype.writeDMAWordCount1 = function (dmaChannel, data) {
	this.wordCountSource[dmaChannel] &= 0xFF;
	this.wordCountSource[dmaChannel] |= data << 8;
}
GameBoyAdvanceDMA.prototype.writeDMAControl0 = function (dmaChannel, data) {
	var control = this.control[dmaChannel];
	control[5] = (data >> 5) & 0x3;
	control[4] &= 0x2;
	control[4] |= (data >> 7) & 0x1;
}
GameBoyAdvanceDMA.prototype.writeDMAControl1 = function (dmaChannel, data) {
	var control = this.control[dmaChannel];
	control[4] &= 0x1;
	control[4] |= (data & 0x1) << 1;
	control[3] = ((data & 0x2) == 0x2);
	control[2] = ((data & 0x4) == 0x4);
	control[1] = (data >> 4) & 0x3;
	control[0] = ((data & 0x40) == 0x40);
	if (data > 0x7F) {
		this.enabled[dmaChannel] = this.DMA_ENABLE_TYPE[dmaChannel][this.control[1]];
		this.enableDMAChannel(dmaChannel);
	}
	else {
		this.enabled[dmaChannel] = 0;
	}
}
GameBoyAdvanceDMA.prototype.enableDMAChannel = function (dmaChannel) {
	//Emulate the DMA preprocessing that occurs on DMA enabling:
	var control = this.control[dmaChannel];
	var source = this.sourceSource[dmaChannel];
	var destination = this.destinationSource[dmaChannel];
	var wordCount = this.wordCountSource[dmaChannel];
	switch (dmaChannel) {
		case 0:
		case 1:
			//Direct Sound DMA has some values hardwired:
			destination = 0x40000A0 | ((dmaChannel - 1) << 2);
			wordCount = 4;
			control[2] = true;
			control[5] = 2;
	}
	this.source[dmaChannel] = source;
	this.destination[dmaChannel] = destination;
	this.wordCount[dmaChannel] = wordCount;
}
GameBoyAdvanceDMA.prototype.soundFIFOARequest = function () {
	this.requestDMA(this.DMA_REQUEST_TYPE.FIFO_A);
}
GameBoyAdvanceDMA.prototype.soundFIFOBRequest = function () {
	this.requestDMA(this.DMA_REQUEST_TYPE.FIFO_B);
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
		if (control[2]) {
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
		else {
			//Reload word count for DMA repeat:
			wordCount = this.wordCountSource[dmaChannel];
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
	else {
		//Update source address:
		switch (control[4]) {
			case 0:	//Increment
			case 3:	//Prohibited code...
				this.source[dmaChannel] = (source + transferred) & -1;
				break;
			case 1:
				this.source[dmaChannel] = (source - transferred) & -1;
		}
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
	//Save the new word count:
	this.wordCount[dmaChannel] = wordCount;
}