import { ClientClass } from "../client_core.mjs";
import { Dialog } from "../ui/dialogs.mjs";
import * as ErrorFormatter from "../utils/errors/error_formatter.mjs";
import Strings from "../utils/strings.mjs";

export async function showError(title: string, desc: string, err: Error) {
	let stack;
	
	try {
		let output = await ErrorFormatter.formatAsHTML(err);
		stack = `<div class='error-log'>${output}</div>`;
	} catch(err) {
		stack = Strings.escapeHTML(err.stack);
		console.log(err);				
	}

	let dialog = new Dialog(ClientClass.get().desktop.dwm);
	dialog.setIcon('error');
	dialog.setTitle(title);
	dialog.setMessageHTML(desc + stack);
	dialog.show();
}

export function initGraphicErrorHandlers() {
	window.addEventListener('error', (ev) => {
		let msg = `[Error] Unhandled error "${ev.message}"\n    at: ${ev.filename}:${ev.lineno}\n  says: ${ev.error}\n stack: `;
		if (ev.error && ev.error.stack) {
			msg += ev.error.stack;
		} else {
			msg += 'unavailable';
		}
		let stack = '';
		if (ev.error && ev.error.stack) {
			stack = `\n${ev.error.stack}`;
		}

		Client.showErrorDialog("Error", `Unhandled error:\n${ev.message}${stack}`);
	});

	window.addEventListener('unhandledrejection', async (ev) => {
		showError("Error", "Unhandled rejection", ev.reason);
		/*let stack: string = ev.reason.stack;
		try {
			let es = new ErrorStack(ev.reason);
			await es.mapAll();
			stack = es.toHTML();
		} catch(err) {
			console.log(err);				
		}
		
		Client.showErrorDialog("Error", `Unhandled rejection: ${ev.reason}\n${stack}`, ev.reason);*/
	});
}

export default { showError, initGraphicErrorHandlers };