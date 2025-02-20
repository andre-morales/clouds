import { ClientClass } from "../client_core.mjs";
import { UIErrorDisplay } from "../ui/controls/error_display.mjs";
import { Dialog } from "../ui/dialogs.mjs";

export async function showError(title: string, desc: string, err: Error) {
	let dialog = new Dialog(ClientClass.get().desktop.dwm);
	dialog.setIcon('error');
	dialog.setTitle(title);
	dialog.setMessageHTML(desc);
	let $errorDisplay = $('<ui-error-display>');
	let errorDisplay = $errorDisplay[0] as UIErrorDisplay;
	dialog.$message.css('width', '100%');
	dialog.$message.append($errorDisplay);

	errorDisplay.setError(err);

	dialog.show();
}

export function initGraphicErrorHandlers() {
	window.addEventListener('error', (ev) => {
		showError("Error", "Unhandled error", ev.error);
	/*	let msg = `[Error] Unhandled error "${ev.message}"\n    at: ${ev.filename}:${ev.lineno}\n  says: ${ev.error}\n stack: `;
		if (ev.error && ev.error.stack) {
			msg += ev.error.stack;
		} else {
			msg += 'unavailable';
		}
		let stack = '';
		if (ev.error && ev.error.stack) {
			stack = `\n${ev.error.stack}`;
		}

		Client.showErrorDialog("Error", `Unhandled error:\n${ev.message}${stack}`);*/
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