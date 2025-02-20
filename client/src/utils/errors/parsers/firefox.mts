import SourceLocation from "../source_location.mjs";
import { StackFrame } from "../stack_frame.mjs";

export default function parse(stack: string): StackFrame[] {
		let frames = [];
	
		// Parse every line into a stack entry
		for (let entry of stack.split('\n')) {
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
		let [fn, ref] = entry.split('@');

		let ind = ref.lastIndexOf(':');
		let column = ref.substring(ind + 1);

		let indx2 = ref.lastIndexOf(':', ind - 1)
		let line = ref.substring(indx2 + 1, ind);

		let file = ref.substring(0, indx2);

		location = new SourceLocation(entry, fn, file, Number(line), Number(column));
	} catch(err) {
		location = new SourceLocation(entry, undefined, undefined, undefined, undefined);
	}
	return new StackFrame(location);
}
