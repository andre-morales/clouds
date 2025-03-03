import { ClientClass } from "../client_core.mjs";
import { UIErrorDisplay } from "../ui/controls/error_display.mjs";
import { Dialog } from "../ui/dialogs.mjs";

export function showError(title: string, desc: string, err: Error) {
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

export default { showError };