import ErrorStack from "./error_stack.mjs";

async function formatAsHTML(err: Error) {
	let chain = getErrorChain(err);

	let output = '';
	for (let i = 0; i < chain.length; i++) {
		output += '> ';

		if (i > 0) {
			output += "Caused by: ";
		}

		let c = chain[i];
		output += `<b>${c.name}</b>: "${c.message}"`;
		output += await formatErrorStack(c);
		output += '<br/>';
	}

	return output;
}

async function formatErrorStack(err: Error) {
	let output = '<table>';

	let stack = new ErrorStack(err);
	await stack.mapAll();

	for (let entry of stack.stackEntries) {
		let loc = entry.getLocation();

		output += '<tr>';
		output += `<td>${loc.fnName}</td>`;
		output += `<td>${filename(loc.file)}:${loc.lineNo}</td>`;
		output += '</tr>';
	}

	output += '</table>';
	return output;
}

function filename(str: string) {
	let fileStr = new URL(str).pathname.split('/');
	let lastElement = fileStr.pop();
	if (lastElement.length == 0) {
		lastElement = (fileStr.pop() ?? '') + '/';
	}

	return lastElement;
}

function getErrorChain(err: Error) {
	let chain: Error[] = [];
	while (err) {
		chain.push(err);
		if (err.cause instanceof Error) {
			err = err.cause;
		} else break;
	}
	return chain;
}

export { formatAsHTML };