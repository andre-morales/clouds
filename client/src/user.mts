import { ClientClass } from "./client_core.mjs";
import { IllegalStateFault } from "./faults.mjs";
import { Dialog } from "./ui/dialogs.mjs";
import Browser from "./utils/browser.mjs";

export default class User {
	public static async getUsername(): Promise<string> {
		let username = await fetch('/auth/username').then(res => res.text());
		return username;
	}

	public static async logout(refresh = true) {
		Browser.setCookie('auth_key', '');
		await fetch("/auth/logout", { method: "POST" });

		if (refresh) User.restart();
	}

	public static restart() {
		window.location.href = "/";
	}

	public static async promptCreateProfile(): Promise<boolean> {
		const dwm = ClientClass.get().desktop?.dwm;
		if (!dwm) 
			throw new IllegalStateFault("This operation requires a desktop GUI.");

		let dialog = new Dialog(dwm);
		dialog.setTitle("User profile");
		dialog.setMessageHTML("This appears to be a new user profile.<br/><br/>Do you wish to initialize this new user?");
		dialog.setOptions(['No', 'Yes']);
		dialog.show();
		dialog.window.pack();
		
		let option = await dialog.whenClosed;
		if (option <= 0)
			return false;

		dialog = new Dialog(dwm);
		dialog.setTitle("User profile");
		dialog.setMessageHTML("You profile is being cloned.<br/><br/>The system will restart in a couple of moments...");
		dialog.show();
		dialog.window.pack();
		await this.createProfile();
		return true;
	}

	public static async createProfile() {
		await fetch('/auth/create_user', { method: 'POST' });
		this.restart();
	}

	public static async showRunDialog() {
		const dwm = ClientClass.get().desktop?.dwm;
		if (!dwm) 
			throw new IllegalStateFault("This operation requires a desktop GUI.");

		// Run() function pipes path value to client runner.
		let $input: $Element;
		const run = () => {
			let path = $input.val();
			ClientClass.get().runApp(path);
		};

		// Create run dialog
		let dialog = new Dialog(dwm);
		dialog.setTitle("Run");
		dialog.setMessageHTML("Type a path to a program.<br/><br/>");
		dialog.setOptions(['Cancel', 'Run']);

		// Create input element
		$input = $("<input type='text' class='field' style='width: 100%; margin: 1px'/>");
		$input.keydown((ev: KeyboardEvent) => {
			if (![ev.key, ev.code].includes("Enter"))
				return
			
			dialog.window.close();

			run();
		});
		dialog.$message.append($input);
		
		// Show dialog and focus on input element
		await dialog.show();
		$input[0].focus();

		// If the user presses Yes, run the program
		let option = await dialog.whenClosed;
		if (option <= 0) return;
		run();
	}
}