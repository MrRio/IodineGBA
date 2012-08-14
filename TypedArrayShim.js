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
function getInt32Array(size_t) {
	try {
		return Int32Array(size_t);
	}
	catch (error) {
		return getArray(size_t);
	}
}
function getUint8Array(size_t) {
	try {
		return Uint8Array(size_t);
	}
	catch (error) {
		return getArray(size_t);
	}
}
function getInt16Array(size_t) {
	try {
		return Int16Array(size_t);
	}
	catch (error) {
		return getArray(size_t);
	}
}