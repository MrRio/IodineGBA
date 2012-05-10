function GameBoyAdvanceDMA(IOCore) {
	this.IOCore = IOCore;
	this.emulatorCore = IOCore.emulatorCore;
	this.initialize();
}
GameBoyAdvanceDMA.prototype.initialize = function () {
	this.enabled = [false, false, false, false];
	this.pending = [false, false, false, false];
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
	this.FIFOADMARequesting = false;	//If true, trigger FIFO A DMA when DMA control bits enabled for it.
	this.FIFOBDMARequesting = false;	//If true, trigger FIFO B DMA when DMA control bits enabled for it.
}
GameBoyAdvanceDMA.prototype.process = function () {
	//Solve for the highest priority DMA to process:
	for (var dmaPriority = 0; dmaPriority < 4; ++dmaPriority) {
		if (this.enabled[dmaPriority] && this.pending[dmaPriority]) {
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
		if (this.soundDMA(dmaChannel)(
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
			this.enabled[dmaChannel] = false;
		}
		//DMA period has ended:
		this.pending[dmaChannel] = false;
		//Check to see if we should flag for IRQ:
		if (control[0]) {
			this.IOCore.cpu.setIF(dmaChannel << 8);
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
		if (!this.soundDMA(dmaChannel)) {
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
		if (!this.soundDMA(dmaChannel)) {
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