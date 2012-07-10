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
	this.SIODATA32_L = 0;
	this.SIODATA32_H = 0;
	this.SIODATA8 = 0;
}
GameBoyAdvanceSerial.prototype.writeSIODATA32_L0 = function (data) {
	this.SIODATA32_L &= 0xFF00;
	this.SIODATA32_L |= data;
}
GameBoyAdvanceSerial.prototype.readSIODATA32_L0 = function () {
	return this.SIODATA32_L & 0xFF;
}
GameBoyAdvanceSerial.prototype.writeSIODATA32_L1 = function (data) {
	this.SIODATA32_L &= 0xFF;
	this.SIODATA32_L |= data << 8;
}
GameBoyAdvanceSerial.prototype.readSIODATA32_L1 = function () {
	return this.SIODATA32_L >> 8;
}
GameBoyAdvanceSerial.prototype.writeSIODATA32_H0 = function (data) {
	this.SIODATA32_H &= 0xFF00;
	this.SIODATA32_H |= data;
}
GameBoyAdvanceSerial.prototype.readSIODATA32_H0 = function () {
	return this.SIODATA32_H & 0xFF;
}
GameBoyAdvanceSerial.prototype.writeSIODATA32_H1 = function (data) {
	this.SIODATA32_H &= 0xFF;
	this.SIODATA32_H |= data << 8;
}
GameBoyAdvanceSerial.prototype.readSIODATA32_H1 = function () {
	return this.SIODATA32_H >> 8;
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