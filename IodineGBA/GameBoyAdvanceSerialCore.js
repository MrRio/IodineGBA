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
function GameBoyAdvanceSerial(IOCore) {
	this.IOCore = IOCore;
	this.initialize();
}
GameBoyAdvanceSerial.prototype.initialize = function () {
	this.SIODATA_A = 0xFFFF;
	this.SIODATA_B = 0xFFFF;
	this.SIODATA_C = 0xFFFF;
	this.SIODATA_D = 0xFFFF;
	this.SIOShiftClockExternal = true;
	this.SIOShiftClockDivider = 0x40;
	this.SIOCNT0_DATA = 0x0C;
	this.SIOTransferStarted = false;
	this.SIOMULT_PLAYER_NUMBER = 0;
	this.SIOCOMMERROR = false;
	this.SIOBaudRate = 0;
	this.SIOCNT_UART_CTS = false;
	this.SIOCNT_UART_MISC = 0;
	this.SIOCNT_UART_FIFO = 0;
	this.SIOCNT_IRQ = false;
	this.SIOCNT_MODE = 0;
	this.SIOCNT_UART_RECV_ENABLE = false;
	this.SIOCNT_UART_SEND_ENABLE = false;
	this.SIOCNT_UART_PARITY_ENABLE = false;
	this.SIOCNT_UART_FIFO_ENABLE = false;
	this.SIODATA8 = 0xFFFF;
	this.RCNTMode = 0;
	this.RCNTIRQ = false;
	this.RCNTDataBits = 0;
	this.RCNTDataBitFlow = 0;
	this.JOYBUS_IRQ = false;
	this.JOYBUS_CNTL_FLAGS = 0;
	this.JOYBUS_RECV0 = 0xFF;
	this.JOYBUS_RECV1 = 0xFF;
	this.JOYBUS_RECV2 = 0xFF;
	this.JOYBUS_RECV3 = 0xFF;
	this.JOYBUS_SEND0 = 0xFF;
	this.JOYBUS_SEND1 = 0xFF;
	this.JOYBUS_SEND2 = 0xFF;
	this.JOYBUS_SEND3 = 0xFF;
	this.JOYBUS_STAT = 0;
	this.shiftClocks = 0;
	this.serialBitsShifted = 0;
}
GameBoyAdvanceSerial.prototype.SIOMultiplayerBaudRate = [
	  9600,
	 38400,
	 57600,
	115200
];
GameBoyAdvanceSerial.prototype.addClocks = function (clocks) {
	if (this.RCNTMode < 2) {
		switch (this.SIOCNT_MODE) {
			case 0:
			case 1:
				if (this.SIOTransferStarted && !this.SIOShiftClockExternal) {
					this.shiftClocks += clocks;
					while (this.shiftClocks >= this.SIOShiftClockDivider) {
						this.shiftClocks -= this.SIOShiftClockDivider;
						this.clockSerial();
					}
				}
				break;
			case 2:
				if (this.SIOTransferStarted && this.SIOMULT_PLAYER_NUMBER == 0) {
					this.shiftClocks += clocks;
					while (this.shiftClocks >= this.SIOShiftClockDivider) {
						this.shiftClocks -= this.SIOShiftClockDivider;
						this.clockMultiplayer();
					}
				}
				break;
			case 3:
				if (this.SIOCNT_UART_SEND_ENABLE && !this.SIOCNT_UART_CTS) {
					this.shiftClocks += clocks;
					while (this.shiftClocks >= this.SIOShiftClockDivider) {
						this.shiftClocks -= this.SIOShiftClockDivider;
						this.clockUART();
					}
				}
		}
	}
}
GameBoyAdvanceSerial.prototype.clockSerial = function () {
	//Emulate as if no slaves connected:
	++this.serialBitsShifted;
	if (this.SIOCNT_MODE == 0) {
		//8-bit
		this.SIODATA8 = ((this.SIODATA8 << 1) | 1) & 0xFFFF;
		if (this.serialBitsShifted == 8) {
			this.SIOTransferStarted = false;
			this.serialBitsShifted = 0;
			if (this.SIOCNT_IRQ) {
				this.IOCore.irq.requestIRQ(0x80);
			}
		}
	}
	else {
		//32-bit
		this.SIODATA_D = ((this.SIODATA_D << 1) & 0xFE) | (this.SIODATA_C >> 7);
		this.SIODATA_C = ((this.SIODATA_C << 1) & 0xFE) | (this.SIODATA_B >> 7);
		this.SIODATA_B = ((this.SIODATA_B << 1) & 0xFE) | (this.SIODATA_A >> 7);
		this.SIODATA_A = ((this.SIODATA_A << 1) & 0xFE) | 1;
		if (this.serialBitsShifted == 32) {
			this.SIOTransferStarted = false;
			this.serialBitsShifted = 0;
			if (this.SIOCNT_IRQ) {
				this.IOCore.irq.requestIRQ(0x80);
			}
		}
	}
}
GameBoyAdvanceSerial.prototype.clockMultiplayer = function () {
	//Emulate as if no slaves connected:
	this.SIODATA_A = this.SIODATA8;
	this.SIODATA_B = 0xFFFF;
	this.SIODATA_C = 0xFFFF;
	this.SIODATA_D = 0xFFFF;
	this.SIOTransferStarted = false;
	this.SIOCOMMERROR = true;
	if (this.SIOCNT_IRQ) {
		this.IOCore.irq.requestIRQ(0x80);
	}
}
GameBoyAdvanceSerial.prototype.clockUART = function () {
	++this.serialBitsShifted;
	if (this.SIOCNT_UART_FIFO_ENABLE) {
		if (this.serialBitsShifted == 8) {
			this.serialBitsShifted = 0;
			this.SIOCNT_UART_FIFO = Math.max(this.SIOCNT_UART_FIFO - 1, 0);
			if (this.SIOCNT_UART_FIFO == 0 && this.SIOCNT_IRQ) {
				this.IOCore.irq.requestIRQ(0x80);
			}
		}
	}
	else {
		if (this.serialBitsShifted == 8) {
			this.serialBitsShifted = 0;
			if (this.SIOCNT_IRQ) {
				this.IOCore.irq.requestIRQ(0x80);
			}
		}
	}
}
GameBoyAdvanceSerial.prototype.writeSIODATA_A0 = function (data) {
	this.SIODATA_A &= 0xFF00;
	this.SIODATA_A |= data;
}
GameBoyAdvanceSerial.prototype.readSIODATA_A0 = function () {
	return this.SIODATA_A & 0xFF;
}
GameBoyAdvanceSerial.prototype.writeSIODATA_A1 = function (data) {
	this.SIODATA_A &= 0xFF;
	this.SIODATA_A |= data << 8;
}
GameBoyAdvanceSerial.prototype.readSIODATA_A1 = function () {
	return this.SIODATA_A >> 8;
}
GameBoyAdvanceSerial.prototype.writeSIODATA_B0 = function (data) {
	this.SIODATA_B &= 0xFF00;
	this.SIODATA_B |= data;
}
GameBoyAdvanceSerial.prototype.readSIODATA_B0 = function () {
	return this.SIODATA_B & 0xFF;
}
GameBoyAdvanceSerial.prototype.writeSIODATA_B1 = function (data) {
	this.SIODATA_B &= 0xFF;
	this.SIODATA_B |= data << 8;
}
GameBoyAdvanceSerial.prototype.readSIODATA_B1 = function () {
	return this.SIODATA_B >> 8;
}
GameBoyAdvanceSerial.prototype.writeSIODATA_C0 = function (data) {
	this.SIODATA_C &= 0xFF00;
	this.SIODATA_C |= data;
}
GameBoyAdvanceSerial.prototype.readSIODATA_C0 = function () {
	return this.SIODATA_C & 0xFF;
}
GameBoyAdvanceSerial.prototype.writeSIODATA_C1 = function (data) {
	this.SIODATA_C &= 0xFF;
	this.SIODATA_C |= data << 8;
}
GameBoyAdvanceSerial.prototype.readSIODATA_C1 = function () {
	return this.SIODATA_C >> 8;
}
GameBoyAdvanceSerial.prototype.writeSIODATA_D0 = function (data) {
	this.SIODATA_D &= 0xFF00;
	this.SIODATA_D |= data;
}
GameBoyAdvanceSerial.prototype.readSIODATA_D0 = function () {
	return this.SIODATA_D & 0xFF;
}
GameBoyAdvanceSerial.prototype.writeSIODATA_D1 = function (data) {
	this.SIODATA_D &= 0xFF;
	this.SIODATA_D |= data << 8;
}
GameBoyAdvanceSerial.prototype.readSIODATA_D1 = function () {
	return this.SIODATA_D >> 8;
}
GameBoyAdvanceSerial.prototype.writeSIOCNT0 = function (data) {
	if (this.RCNTMode < 0x2) {
		switch (this.SIOCNT_MODE) {
			//8-Bit:
			case 0:
			//32-Bit:
			case 1:
				this.SIOShiftClockExternal = ((data & 0x1) == 0x1);
				this.SIOShiftClockDivider = ((data & 0x2) == 0x2) ? 0x8 : 0x40;
				this.SIOCNT0_DATA = data & 0xB;
				if ((data & 0x80) == 0x80) {
					if (!this.SIOTransferStarted) {
						this.SIOTransferStarted = true;
						this.serialBitsShifted = 0;
						this.shiftClocks = 0;
					}
				}
				else {
					this.SIOTransferStarted = false;
				}
				break;
			//Multiplayer:
			case 2:
				this.SIOBaudRate = data & 0x3;
				this.SIOShiftClockDivider = this.SIOMultiplayerBaudRate[this.SIOBaudRate];
				this.SIOMULT_PLAYER_NUMBER = (data >> 4) & 0x3;
				this.SIOCOMMERROR = ((data & 0x40) == 0x40);
				if ((data & 0x80) == 0x80) {
					if (!this.SIOTransferStarted) {
						this.SIOTransferStarted = true;
						if (this.SIOMULT_PLAYER_NUMBER == 0) {
							this.SIODATA_A = 0xFFFF;
							this.SIODATA_B = 0xFFFF;
							this.SIODATA_C = 0xFFFF;
							this.SIODATA_D = 0xFFFF;
						}
						this.serialBitsShifted = 0;
						this.shiftClocks = 0;
					}
				}
				else {
					this.SIOTransferStarted = false;
				}
				break;
			//UART:
			case 3:
				this.SIOBaudRate = data & 0x3;
				this.SIOShiftClockDivider = this.SIOMultiplayerBaudRate[this.SIOBaudRate];
				this.SIOCNT_UART_MISC = (data & 0xCF) >> 2;
				this.SIOCNT_UART_CTS = ((data & 0x4) == 0x4);
		}
	}
}
GameBoyAdvanceSerial.prototype.readSIOCNT0 = function () {
	if (this.RCNTMode < 0x2) {
		switch (this.SIOCNT_MODE) {
			//8-Bit:
			case 0:
			//32-Bit:
			case 1:
				return ((this.SIOTransferStarted) ? 0x80 : 0) | 0x74 | this.SIOCNT0_DATA;
			//Multiplayer:
			case 2:
				return ((this.SIOTransferStarted) ? 0x80 : 0) | ((this.SIOCOMMERROR) ? 0x40 : 0) | (this.SIOMULT_PLAYER_NUMBER << 4) | this.SIOBaudRate;
			//UART:
			case 3:
				return (this.SIOCNT_UART_MISC << 2) | ((this.SIOCNT_UART_FIFO == 4) ? 0x10 : 0) | 0x20 | this.SIOBaudRate;
		}
	}
	return 0xFF;
}
GameBoyAdvanceSerial.prototype.writeSIOCNT1 = function (data) {
	this.SIOCNT_IRQ = ((data & 0x40) == 0x40);
	this.SIOCNT_MODE = (data >> 4) & 0x3;
	this.SIOCNT_UART_RECV_ENABLE = ((data & 0x8) == 0x8);
	this.SIOCNT_UART_SEND_ENABLE = ((data & 0x4) == 0x4);
	this.SIOCNT_UART_PARITY_ENABLE = ((data & 0x2) == 0x2);
	this.SIOCNT_UART_FIFO_ENABLE = ((data & 0x1) == 0x1);
}
GameBoyAdvanceSerial.prototype.readSIOCNT1 = function () {
	return (0x80 | (this.SIOCNT_IRQ ? 0x40 : 0) | (this.SIOCNT_MODE << 4) | ((this.SIOCNT_UART_RECV_ENABLE) ? 0x8 : 0) |
	((this.SIOCNT_UART_SEND_ENABLE) ? 0x4 : 0) | ((this.SIOCNT_UART_PARITY_ENABLE) ? 0x2 : 0) | ((this.SIOCNT_UART_FIFO_ENABLE) ? 0x2 : 0));
}
GameBoyAdvanceSerial.prototype.writeSIODATA8_0 = function (data) {
	this.SIODATA8 &= 0xFF00;
	this.SIODATA8 |= data;
	if (this.RCNTMode < 0x2 && this.SIOCNT_MODE == 3 && this.SIOCNT_UART_FIFO_ENABLE) {
		this.SIOCNT_UART_FIFO = Math.min(this.SIOCNT_UART_FIFO + 1, 4);
	}
}
GameBoyAdvanceSerial.prototype.readSIODATA8_0 = function () {
	return this.SIODATA8 & 0xFF;
}
GameBoyAdvanceSerial.prototype.writeSIODATA8_1 = function (data) {
	this.SIODATA8 &= 0xFF;
	this.SIODATA8 |= data << 8;
}
GameBoyAdvanceSerial.prototype.readSIODATA8_1 = function () {
	return this.SIODATA8 >> 8;
}
GameBoyAdvanceSerial.prototype.writeRCNT0 = function (data) {
	if (this.RCNTMode == 0x2) {
		//General Comm:
		var oldDataBits = this.RCNTDataBits;
		this.RCNTDataBits = data & 0xF;	//Device manually controls SI/SO/SC/SD here.
		this.RCNTDataBitFlow = data >> 4;
		if (this.RCNTIRQ && ((oldDataBits ^ this.RCNTDataBits) & oldDataBits & 0x4) == 0x4) {
			//SI fell low, trigger IRQ:
			this.IOCore.irq.requestIRQ(0x80);
		}
	}
}
GameBoyAdvanceSerial.prototype.readRCNT0 = function () {
	return (this.RCNTDataBitFlow << 4) | this.RCNTDataBits;
}
GameBoyAdvanceSerial.prototype.writeRCNT1 = function (data) {
	this.RCNTMode = data >> 6;
	this.RCNTIRQ = ((data & 0x1) == 0x1);
	if (this.RCNTMode != 0x2) {
		//Force SI/SO/SC/SD to low as we're never "hooked" up:
		this.RCNTDataBits = 0;
		this.RCNTDataBitFlow = 0;
	}
}
GameBoyAdvanceSerial.prototype.readRCNT1 = function () {
	return (this.RCNTMode << 6) | 0x3E | ((this.RCNTIRQ) ? 0x1 : 0);
}
GameBoyAdvanceSerial.prototype.writeJOYCNT = function (data) {
	this.JOYBUS_IRQ = ((data & 0x40) == 0x40);
	this.JOYBUS_CNTL_FLAGS = data & 0x7;
	if (this.JOYBUS_IRQ && this.JOYBUS_CNTL_FLAGS > 0) {
		//We forced a reset, so trigger IRQ:
		this.IOCore.irq.requestIRQ(0x80);
	}
}
GameBoyAdvanceSerial.prototype.readJOYCNT = function () {
	return 0xB8 | ((this.JOYBUS_IRQ) ? 0x40 : 0) | this.JOYBUS_CNTL_FLAGS;
}
GameBoyAdvanceSerial.prototype.writeJOYBUS_RECV0 = function (data) {
	this.JOYBUS_RECV0 = data;
}
GameBoyAdvanceSerial.prototype.readJOYBUS_RECV0 = function () {
	this.JOYBUS_STAT &= 0xF7;
	return this.JOYBUS_RECV0;
}
GameBoyAdvanceSerial.prototype.writeJOYBUS_RECV1 = function (data) {
	this.JOYBUS_RECV1 = data;
}
GameBoyAdvanceSerial.prototype.readJOYBUS_RECV1 = function () {
	this.JOYBUS_STAT &= 0xF7;
	return this.JOYBUS_RECV1;
}
GameBoyAdvanceSerial.prototype.writeJOYBUS_RECV2 = function (data) {
	this.JOYBUS_RECV2 = data;
}
GameBoyAdvanceSerial.prototype.readJOYBUS_RECV2 = function () {
	this.JOYBUS_STAT &= 0xF7;
	return this.JOYBUS_RECV2;
}
GameBoyAdvanceSerial.prototype.writeJOYBUS_RECV3 = function (data) {
	this.JOYBUS_RECV3 = data;
}
GameBoyAdvanceSerial.prototype.readJOYBUS_RECV3 = function () {
	this.JOYBUS_STAT &= 0xF7;
	return this.JOYBUS_RECV3;
}
GameBoyAdvanceSerial.prototype.writeJOYBUS_SEND0 = function (data) {
	this.JOYBUS_SEND0 = data;
	this.JOYBUS_STAT |= 0x2;
}
GameBoyAdvanceSerial.prototype.readJOYBUS_SEND0 = function () {
	return this.JOYBUS_SEND0;
}
GameBoyAdvanceSerial.prototype.writeJOYBUS_SEND1 = function (data) {
	this.JOYBUS_SEND1 = data;
	this.JOYBUS_STAT |= 0x2;
}
GameBoyAdvanceSerial.prototype.readJOYBUS_SEND1 = function () {
	return this.JOYBUS_SEND1;
}
GameBoyAdvanceSerial.prototype.writeJOYBUS_SEND2 = function (data) {
	this.JOYBUS_SEND2 = data;
	this.JOYBUS_STAT |= 0x2;
}
GameBoyAdvanceSerial.prototype.readJOYBUS_SEND2 = function () {
	return this.JOYBUS_SEND2;
}
GameBoyAdvanceSerial.prototype.writeJOYBUS_SEND3 = function (data) {
	this.JOYBUS_SEND3 = data;
	this.JOYBUS_STAT |= 0x2;
}
GameBoyAdvanceSerial.prototype.readJOYBUS_SEND3 = function () {
	return this.JOYBUS_SEND3;
}
GameBoyAdvanceSerial.prototype.writeJOYBUS_STAT = function (data) {
	this.JOYBUS_STAT = data;
}
GameBoyAdvanceSerial.prototype.readJOYBUS_STAT = function () {
	return 0xC5 | this.JOYBUS_STAT;
}
GameBoyAdvanceSerial.prototype.nextIRQEventTime = function (clocks) {
	if (this.SIOCNT_IRQ && this.RCNTMode < 2) {
		switch (this.SIOCNT_MODE) {
			case 0:
			case 1:
				if (this.SIOTransferStarted && !this.SIOShiftClockExternal) {
					return ((((this.SIOCNT_MODE == 1) ? 31 : 7) - this.serialBitsShifted) * this.SIOShiftClockDivider) + (this.SIOShiftClockDivider - this.shiftClocks);
				}
				else {
					return -1;
				}
			case 2:
				if (this.SIOTransferStarted && this.SIOMULT_PLAYER_NUMBER == 0) {
					return this.SIOShiftClockDivider - this.shiftClocks;
				}
				else {
					return -1;
				}
			case 3:
				if (this.SIOCNT_UART_SEND_ENABLE && !this.SIOCNT_UART_CTS) {
					return (Math.max(((this.SIOCNT_UART_FIFO_ENABLE) ? (this.SIOCNT_UART_FIFO * 8) : 8) - 1, 0) * this.SIOShiftClockDivider) + (this.SIOShiftClockDivider - this.shiftClocks);
				}
				else {
					return -1;
				}
		}
	}
	else {
		return -1;
	}
}