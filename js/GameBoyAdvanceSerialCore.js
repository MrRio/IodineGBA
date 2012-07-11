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
	this.SIODATA_A = 0;
	this.SIODATA_B = 0;
	this.SIODATA_C = 0;
	this.SIODATA_D = 0;
	this.SIODATA8 = 0;
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