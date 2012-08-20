var logged = [];
var current_unit = null;
var display_amount = 1000;
var debugging_enabled = true;
var debugging_memoryRead = true;
var debugging_memoryWrite = true;
var debugging_pipeline = true;
var debugging_branch = true;
var debugging_register = true;
var debugging_exception = true;
var debugging_mode = true;
function update_log_start() {
	var length = Math.min(logged.length, display_amount);
	var log_handle = document.getElementById("debug_log");
	while (log_handle.hasChildNodes()) {
		log_handle.removeChild(log_handle.lastChild);
	}
	for (var to = 0; to < length; ++to) {
		var unit = logged[to];
		var unit_handle = document.createElement("div");
		unit_handle.setAttribute("class", unit[0]);
		unit_handle.appendChild(document.createTextNode(unit[0]));
		var sub_unit = unit[1];
		var unit2 = sub_unit[1];
		var sub_length = unit2.length;
		var unit2_handle = document.createElement("div");
		unit2_handle.setAttribute("class", "debug_opcode");
		unit2_handle.appendChild(document.createTextNode(sub_unit[0]));
		for (var sub_index = 0; sub_index < sub_length; ++sub_index) {
			if (debug_check_log_approval(unit2[sub_index][0])) {
				var sub_handle = document.createElement("div");
				sub_handle.setAttribute("class", unit2[sub_index][0]);
				sub_handle.appendChild(document.createTextNode(unit2[sub_index][1]));
				unit2_handle.appendChild(sub_handle);
			}
		}
		unit_handle.appendChild(unit2_handle);
		log_handle.appendChild(unit_handle);
	}
}
function update_log_end() {
	var length = logged.length;
	var log_handle = document.getElementById("debug_log");
	while (log_handle.hasChildNodes()) {
		log_handle.removeChild(log_handle.lastChild);
	}
	for (var to = Math.max(length - display_amount, 0); to < length; ++to) {
		var unit = logged[to];
		var unit_handle = document.createElement("div");
		unit_handle.setAttribute("class", unit[0]);
		unit_handle.appendChild(document.createTextNode(unit[0]));
		var sub_unit = unit[1];
		var unit2 = sub_unit[1];
		var sub_length = unit2.length;
		var unit2_handle = document.createElement("div");
		unit2_handle.setAttribute("class", "debug_opcode");
		unit2_handle.appendChild(document.createTextNode(sub_unit[0]));
		for (var sub_index = 0; sub_index < sub_length; ++sub_index) {
			var sub_handle = document.createElement("div");
			sub_handle.setAttribute("class", unit2[sub_index][0]);
			sub_handle.appendChild(document.createTextNode(unit2[sub_index][1]));
			unit2_handle.appendChild(sub_handle);
		}
		unit_handle.appendChild(unit2_handle);
		log_handle.appendChild(unit_handle);
	}
}
function debug_check_log_approval(name) {
	switch (name) {
		case "memoryRead":
			return debugging_memoryRead;
		case "memoryWrite":
			return debugging_memoryWrite;
		case "register":
			return debugging_register;
		case "exception":
			return debugging_exception;
		case "pipeline":
		case "not_taken":
		case "branch":
			return debugging_pipeline;
		case "mode":
			return debugging_mode;
		case "high_reg":
			return true;
		default:
			return false;
	}
}
function debug_start_unit(unitName) {
	current_unit = [unitName, ["Unknown", []]];
}
function debug_memoryRead(address, data, type) {
	current_unit[1][1].push(["memoryRead", "read data " + outputCleanse(data) + " (" + type + ")@" + outputCleanse(address)]);
}
function debug_memoryWrite(address, data, type) {
	current_unit[1][1].push(["memoryWrite", "wrote data " + outputCleanse(data) + " (" + type + ")@" + outputCleanse(address)]);
}
function debug_opcode(opcode) {
	current_unit[1][0] = opcode;
}
function debug_pipeline() {
	current_unit[1][1].push(["pipeline", "Pipeline Flush"]);
}
function debug_branch(address) {
	current_unit[1][1].push(["pipeline", "Branch To: " + outputCleanse(address)]);
}
function debug_register(register, data) {
	var type = "register";
	switch (register) {
		case 15:
			register = "PC= ";
			type = "high_reg";
			break;
		case 14:
			register = "LR= ";
			type = "high_reg";
			break;
		case 13:
			register = "SP= ";
			type = "high_reg";
			break;
		default:
			register = "r[" + outputCleanse(register) + "]= ";
	}
	current_unit[1][1].push([type, register + outputCleanse(data)]);
}
function debug_mregister(register, data) {
	var type = "register";
	register = "(USER) r[" + outputCleanse(register) + "]= ";
	current_unit[1][1].push([type, register + outputCleanse(data)]);
}
function debug_exception(newMode) {
	current_unit[1][1].push(["exception", "Exception into mode " + outputCleanse(newMode)]);
}
function debug_branch_not_taken() {
	current_unit[1][1].push(["not_taken", "THUMB branch not taken."]);
}
function debug_spsr(spsr) {
	current_unit[1][1].push(["mode", "CPSR->SPSR spill: " + spsr]);
}
function debug_mode(newMode) {
	current_unit[1][1].push(["mode", "Entering mode " + outputCleanse(newMode)]);
}
function debug_end_unit() {
	if (debugging_enabled) {
		logged.push(current_unit);
	}
}
function outputCleanse(data) {
	return (data >>> 0).toString(16);
}