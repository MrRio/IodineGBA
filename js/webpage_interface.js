var keyZones = [
	["right", [39]],
	["left", [37]],
	["up", [38]],
	["down", [40]],
	["a", [88, 74]],
	["b", [90, 81, 89]],
	["select", [16]],
	["start", [13]]
];
var emuSpeed = 1;
var emuVolume = 1;
var Iodine = null;
window.onload = function () {
	//Initialize Iodine:
	Iodine = new GameBoyAdvanceEmulator();
	Iodine.attachCanvas(document.getElementById("emulator_target"));
	//Hook the GUI controls.
	registerGUIEvents();
}
function registerGUIEvents() {
	addEvent("keydown", document, keyDown);
	addEvent("keyup", document, function (event) {
		switch (event.keyCode) {
			case 68:
				lowerVolume();
				break;
			case 82:
				raiseVolume();
				break;
			case 49:
				emuSpeed = Math.min(emuSpeed + 0.25, 4);
				Iodine.setSpeed(emuSpeed);
				break;
			case 50:
				emuSpeed = Math.max(emuSpeed - 0.25, 0.25);
				Iodine.setSpeed(emuSpeed);
				break;
			default:
				//Control keys / other
				keyUp(event);
		}
	});
	addEvent("change", document.getElementById("rom_load"), function () {
		if (typeof this.files != "undefined") {
			if (this.files.length >= 1) {
				//Gecko 1.9.2+ (Standard Method)
				var binaryHandle = new FileReader();
				binaryHandle.onloadend = function () {
					attachROM(this.result);
				}
				binaryHandle.readAsArrayBuffer(this.files[this.files.length - 1]);
			}
		}
	});
	addEvent("change", document.getElementById("bios_load"), function () {
		if (typeof this.files != "undefined") {
			if (this.files.length >= 1) {
				//Gecko 1.9.2+ (Standard Method)
				var binaryHandle = new FileReader();
				binaryHandle.onloadend = function () {
					attachBIOS(this.result);
				}
				binaryHandle.readAsArrayBuffer(this.files[this.files.length - 1]);
			}
		}
	});
	addEvent("click", document.getElementById("play"), function (event) {
		Iodine.play();
		this.style.display = "none";
		document.getElementById("pause").style.display = "inline";
		event.preventDefault();
	});
	addEvent("click", document.getElementById("pause"), function (event) {
		Iodine.pause();
		this.style.display = "none";
		document.getElementById("play").style.display = "inline";
		event.preventDefault();
	});
	addEvent("click", document.getElementById("restart"), function (event) {
		logged = [];
		Iodine.restart();
		event.preventDefault();
	});
	document.getElementById("sound").checked = false;
	addEvent("click", document.getElementById("sound"), function () {
		if (this.checked) {
			Iodine.enableAudio();
		}
		else {
			Iodine.disableAudio();
		}
	});
	document.getElementById("display_amount").value = "1000";
	addEvent("change", document.getElementById("display_amount"), function () {
		display_amount = this.value;
	});
	document.getElementById("record_enable").checked = true;
	addEvent("click", document.getElementById("record_enable"), function () {
		debugging_enabled = this.checked;
	});
	document.getElementById("record_memoryRead").checked = true;
	addEvent("click", document.getElementById("record_memoryRead"), function () {
		debugging_memoryRead = this.checked;
	});
	document.getElementById("record_memoryWrite").checked = true;
	addEvent("click", document.getElementById("record_memoryWrite"), function () {
		debugging_memoryWrite = this.checked;
	});
	document.getElementById("record_pipeline").checked = true;
	addEvent("click", document.getElementById("record_pipeline"), function () {
		debugging_pipeline = this.checked;
	});
	document.getElementById("record_register").checked = true;
	addEvent("click", document.getElementById("record_register"), function () {
		debugging_register = this.checked;
	});
	document.getElementById("record_exception").checked = true;
	addEvent("click", document.getElementById("record_exception"), function () {
		debugging_exception = this.checked;
	});
	document.getElementById("record_mode").checked = true;
	addEvent("click", document.getElementById("record_mode"), function () {
		debugging_mode = this.checked;
	});
	addEvent("click", document.getElementById("record_first"), function (event) {
		update_log_start();
		event.preventDefault();
	});
	addEvent("click", document.getElementById("record_end"), function (event) {
		update_log_end();
		event.preventDefault();
	});
}
function attachBIOS(BIOS) {
	Iodine.attachBIOS(new Uint8Array(BIOS));
}
function attachROM(ROM) {
	Iodine.attachROM(new Uint8Array(ROM));
}
function lowerVolume() {
	emuVolume = Math.max(emuVolume - 0.04, 0);
	Iodine.changeVolume(emuVolume);
}
function raiseVolume() {
	emuVolume = Math.min(emuVolume + 0.04, 1);
	Iodine.changeVolume(emuVolume);
}
function keyDown(event) {
	var keyCode = event.keyCode;
	var keyMapLength = keyZones.length;
	for (var keyMapIndex = 0; keyMapIndex < keyMapLength; ++keyMapIndex) {
		var keyCheck = keyZones[keyMapIndex];
		var keysMapped = keyCheck[1];
		var keysTotal = keysMapped.length;
		for (var index = 0; index < keysTotal; ++index) {
			if (keysMapped[index] == keyCode) {
				Iodine.keyDown(keyCheck[0]);
				try {
					event.preventDefault();
				}
				catch (error) { }
			}
		}
	}
}
function keyUp(event) {
	var keyCode = event.keyCode;
	var keyMapLength = keyZones.length;
	for (var keyMapIndex = 0; keyMapIndex < keyMapLength; ++keyMapIndex) {
		var keyCheck = keyZones[keyMapIndex];
		var keysMapped = keyCheck[1];
		var keysTotal = keysMapped.length;
		for (var index = 0; index < keysTotal; ++index) {
			if (keysMapped[index] == keyCode) {
				Iodine.keyDown(keyCheck[0]);
				try {
					event.preventDefault();
				}
				catch (error) { }
			}
		}
	}
}
//Wrapper for localStorage getItem, so that data can be retrieved in various types.
function findValue(key) {
	try {
		if (window.localStorage.getItem(key) != null) {
			return JSON.parse(window.localStorage.getItem(key));
		}
	}
	catch (error) {
		//An older Gecko 1.8.1/1.9.0 method of storage (Deprecated due to the obvious security hole):
		if (window.globalStorage[location.hostname].getItem(key) != null) {
			return JSON.parse(window.globalStorage[location.hostname].getItem(key));
		}
	}
	return null;
}
//Wrapper for localStorage setItem, so that data can be set in various types.
function setValue(key, value) {
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	}
	catch (error) {
		//An older Gecko 1.8.1/1.9.0 method of storage (Deprecated due to the obvious security hole):
		window.globalStorage[location.hostname].setItem(key, JSON.stringify(value));
	}
}
//Wrapper for localStorage removeItem, so that data can be set in various types.
function deleteValue(key) {
	try {
		window.localStorage.removeItem(key);
	}
	catch (error) {
		//An older Gecko 1.8.1/1.9.0 method of storage (Deprecated due to the obvious security hole):
		window.globalStorage[location.hostname].removeItem(key);
	}
}
//Some wrappers and extensions for non-DOM3 browsers:
function addEvent(sEvent, oElement, fListener) {
	try {	
		oElement.addEventListener(sEvent, fListener, false);
	}
	catch (error) {
		oElement.attachEvent("on" + sEvent, fListener);	//Pity for IE.
	}
}
function removeEvent(sEvent, oElement, fListener) {
	try {	
		oElement.removeEventListener(sEvent, fListener, false);
	}
	catch (error) {
		oElement.detachEvent("on" + sEvent, fListener);	//Pity for IE.
	}
}