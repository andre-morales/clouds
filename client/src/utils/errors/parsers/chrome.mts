import Strings from "../../strings.mjs";
import SourceLocation from "../source_location.mjs";
import { StackFrame } from "../stack_frame.mjs";

export default function parse(stack: string): StackFrame[] {
	let frames = [];

	// Parse every line into a stack entry
	for (let entry of stack.split('\n').slice(1)) {
		let stackEntry = parseLine(entry);
		if (!stackEntry) break;

		frames.push(stackEntry);
	}
	return frames;
}


function parseLine(entry: string): StackFrame {
	if (entry.length == 0) return null;

	let location: SourceLocation;
	try {
		let at = entry.indexOf('at ');				
		let parenthesis = entry.indexOf('(');

		let functionName = null;
		let locationStr = null;
		if (parenthesis != -1) {
			let lastParenthesis = entry.lastIndexOf(')');

			functionName = entry.substring(at + 3, parenthesis - 1);
			locationStr = entry.substring(parenthesis + 1, lastParenthesis);
		} else {
			locationStr = entry.substring(at + 3);
		}

		// Parse location string, storing null if line or column aren't available
		let [file, line, column] = Strings.splitFromEnd(locationStr, ':', 3);
		let lineNo = line ? Number(line) : null;
		let columnNo = column ? Number(column) : null;

		location = new SourceLocation(entry, functionName, file, lineNo, columnNo);
	} catch(err) {
		location = new SourceLocation(entry, undefined, undefined, undefined, undefined);
	}

	return new StackFrame(location);
}