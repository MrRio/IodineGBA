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
	this.SIODATA8 = 0xFFFF;
	this.JOYBUS_RECV0 = 0xFF;
	this.JOYBUS_RECV1 = 0xFF;
	this.JOYBUS_RECV2 = 0xFF;
	this.JOYBUS_RECV3 = 0xFF;
	this.JOYBUS_SEND0 = 0xFF;
	this.JOYBUS_SEND1 = 0xFF;
	this.JOYBUS_SEND2 = 0xFF;
	this.JOYBUS_SEND3 = 0xFF;
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
GameBoyAdvanceSerial.prototype.writeSIODATA8_0 = function (data) {
	this.SIODATA8 &= 0xFF00;
	this.SIODATA8 |= data;
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
GameBoyAdvanceSerial.prototype.writeJOYBUS_RECV0 = function (data) {
	this.JOYBUS_RECV0 = data;
}
GameBoyAdvanceSerial.prototype.readJOYBUS_RECV0 = function () {
	return this.JOYBUS_RECV0;
}
GameBoyAdvanceSerial.prototype.writeJOYBUS_RECV1 = function (data) {
	this.JOYBUS_RECV1 = data;
}
GameBoyAdvanceSerial.prototype.readJOYBUS_RECV1 = function () {
	return this.JOYBUS_RECV1;
}
GameBoyAdvanceSerial.prototype.writeJOYBUS_RECV2 = function (data) {
	this.JOYBUS_RECV2 = data;
}
GameBoyAdvanceSerial.prototype.readJOYBUS_RECV2 = function () {
	return this.JOYBUS_RECV2;
}
GameBoyAdvanceSerial.prototype.writeJOYBUS_RECV3 = function (data) {
	this.JOYBUS_RECV3 = data;
}
GameBoyAdvanceSerial.prototype.readJOYBUS_RECV3 = function () {
	return this.JOYBUS_RECV3;
}
GameBoyAdvanceSerial.prototype.writeJOYBUS_SEND0 = function (data) {
	this.JOYBUS_SEND0 = data;
}
GameBoyAdvanceSerial.prototype.readJOYBUS_SEND0 = function () {
	return this.JOYBUS_SEND0;
}
GameBoyAdvanceSerial.prototype.writeJOYBUS_SEND1 = function (data) {
	this.JOYBUS_SEND1 = data;
}
GameBoyAdvanceSerial.prototype.readJOYBUS_SEND1 = function () {
	return this.JOYBUS_SEND1;
}
GameBoyAdvanceSerial.prototype.writeJOYBUS_SEND2 = function (data) {
	this.JOYBUS_SEND2 = data;
}
GameBoyAdvanceSerial.prototype.readJOYBUS_SEND2 = function () {
	return this.JOYBUS_SEND2;
}
GameBoyAdvanceSerial.prototype.writeJOYBUS_SEND3 = function (data) {
	this.JOYBUS_SEND3 = data;
}
GameBoyAdvanceSerial.prototype.readJOYBUS_SEND0 = function () {
	return this.JOYBUS_SEND3;
}