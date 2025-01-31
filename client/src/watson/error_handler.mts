import { ClientClass } from "../client_core.mjs";
import { Dialog } from "../ui/dialogs.mjs";
import * as ErrorFormatter from "../utils/errors/error_formatter.mjs";
import Strings from "../utils/strings.mjs";

export async function showError(title: string, desc: string, err: Error) {
	let stack;
	
	try {
		let output = await ErrorFormatter.formatAsHTML(err);
		stack = `<div style='border: inset 1px black; font-family: monospace;'>${output}</div>`;
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

}

export default { showError, initGraphicErrorHandlers };