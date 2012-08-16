var logged = [];
var current_unit = null;
var display_amount = 1000;
var debugging_enabled = true;
var debugging_memoryRead = true;
var debugging_memoryWrite = true;
var debugging_pipeline = true;
var debugging_branch = true;
var debugging_pc = true;
var debugging_sp = true;
var debugging_exception = true;
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
		var sub_length = sub_unit.length;
		for (var sub_index = 0; sub_index < sub_length; ++sub_index) {
			var sub_handle = document.createElement("div");
			sub_handle.setAttribute("class", sub_unit[sub_index][0]);
			sub_handle.appendChild(document.createTextNode(sub_unit[sub_index][1]));
			unit_handle.appendChild(sub_handle);
		}
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
		var sub_unit = unit[1];
		var sub_length = sub_unit.length;
		for (var sub_index = 0; sub_index < sub_length; ++sub_index) {
			var sub_handle = document.createElement("div");
			sub_handle.setAttribute("class", sub_unit[sub_index][0]);
			sub_handle.appendChild(document.createTextNode(sub_unit[sub_index][1]));
			unit_handle.appendChild(sub_handle);
		}
		log_handle.appendChild(unit_handle);
	}
}
function debug_start_unit(unitName) {
	current_unit = [unitName, []];
}
function debug_memoryRead(address, data, type) {
	if (debugging_enabled && debugging_memoryRead) {
		current_unit[1].push(["memoryRead", "read data " + data.toString(16) + " (" + type + ")@" + address.toString(16)]);
	}
}
function debug_memoryWrite(address, data, type) {
	if (debugging_enabled && debugging_memoryWrite) {
		current_unit[1].push(["memoryWrite", "wrote data " + data.toString(16) + " (" + type + ")@" + address.toString(16)]);
	}
}
function debug_branch(address) {
	if (debugging_enabled && debugging_branch) {
		current_unit[1].push(["branch", "branch to " + address.toString(16)]);
	}
}
function debug_pc(data) {
	if (debugging_enabled && debugging_pc) {
		current_unit[1].push(["register", "PC= " + data.toString(16)]);
	}
}
function debug_sp(data) {
	if (debugging_enabled && debugging_sp) {
		current_unit[1].push(["register", "SP= " + data.toString(16)]);
	}
}
function debug_pipeline() {
	if (debugging_enabled && debugging_pipeline) {
		current_unit[1].push(["pipeline", "Pipeline Flush"]);
	}
}
function debug_register(register, data) {
	if (debugging_enabled) {
		current_unit[1].push(["register", "r[" + register.toString(16) + "]= " + data.toString(16)]);
	}
}
function debug_exception(newMode) {
	if (debugging_enabled && debugging_exception) {
		current_unit[1].push(["exception", "Exception into mode " + newMode.toString(16)]);
	}
}
function debug_end_unit() {
	logged.push(current_unit);
}