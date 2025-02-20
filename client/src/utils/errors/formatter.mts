import Strings from "../strings.mjs";
import ErrorStack from "./stack.mjs";
import { ErrorStackList } from "./stack_analyzer.mjs";

export function formatRawAsHTML(err: Error): string {
	const errorToString = (err: Error) => {
		let result = `<b>${err.name}: "${err.message}"</b>\n`;
		result += '    ' + Strings.escapeHTML(err.stack).replaceAll('\n', '\n    ');
		return result;
	}

	let result = '';
	result += `&gt; `;
	
	while (true) {
		result += errorToString(err);

		if (!err.cause) break;
		err = err.cause as any;

		result += `\n&gt; Caused by `;
		if (!(err instanceof Error)) {
			result += `<b>"${err}"</b>\n`;
			break;
		}
	}
	
	return result;
}

function formatAsHTML(chain: ErrorStackList) {
	let output = '';
	for (let i = 0; i < chain.stacks.length; i++) {
		output += '> ';

		if (i > 0) {
			output += "Caused by: ";
		}

		let c = chain.stacks[i];
		output += `<b>${c.error.name}</b>: "${c.error.message}"`;
		output += formatErrorStack(c);
		output += '<br/>';
	}

	return output;
}

function formatErrorStack(stack: ErrorStack) {
	let output = '<table>';

	for (let entry of stack.frames) {
		let loc = entry.getLocation();

		if (!loc.isDummy) {
			output += '<tr>';
			output += `<td>${loc.functionName ?? '?'}</td>`;
			output += `<td>${Strings.escapeHTML(loc.getShortFilename() ?? '?')}:${loc.lineNo ?? '?'}</td>`;
			output += '</tr>';
		} else {
			output += '<tr>';
			output += `<td>${loc.description}</td>`;
			output += '</tr>';
		}
	}

	output += '</table>';
	return output;
}

export default { formatRawAsHTML, formatAsHTML };