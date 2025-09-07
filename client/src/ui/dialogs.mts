import App from '../app.mjs';
import Deferred from '/@comm/deferred.mjs';
import Window, { InitialPosition } from './window.mjs';

type DialogTuple = [Promise<number>, Dialog];

interface DialogOptions {
	icon?: string;
}

export function showOptions(app: App, title: string, msg: string, options: string[], settings: DialogOptions = {}): DialogTuple {
	let dialog = new Dialog(app);
	dialog.setIcon(settings.icon ?? 'info');
	dialog.setTitle(title);
	dialog.setMessageHTML(msg ?? "");
	dialog.setOptions(options);
	dialog.show();
	return [dialog.whenClosed, dialog];
}

export function showError(app: App, title: string, msg: string): Dialog {
	let [prom, win] = showOptions(app, title, msg, ["OK"], {
		icon: 'error'
	});
	return win;
}

export function showMessage(app: App, title: string, msg: string): Dialog {
	let [prom, win] = showOptions(app, title, msg, ["OK"], {
		icon: 'info'
	});
	return win;
}

export class Dialog {
	public readonly window: Window;
	public readonly whenClosed: Promise<number>;
	public readonly $icon: $Element;
	public readonly $message: $Element;
	public readonly $options: $Element;
	private readonly closeDeferred: Deferred;

	constructor(app: App) {
		this.window = Client.desktop.createWindow(app);
		this.window.$window.addClass('dialog');
		
		// Resolve the promise when the window is finally closed, or when an option has been clicked
		this.closeDeferred = new Deferred();
		this.whenClosed = this.closeDeferred.promise;
		this.window.on('closed', () => {
			this.closeDeferred.resolve(-1);
		});

		let $body = this.window.$window.find('.window-body');
		
		// Create message box
		let $msg = $("<div class='message'>");
		this.$icon = $(`<i class='dialog-icon info-icon'>`);
		$msg.append(this.$icon);
		
		this.$message = $('<span class="dialog-text"></span>');
		$msg.append(this.$message);
		$body.append($msg);

		// Create a button for each option
		this.$options = $('<div class="options"></div>');
		$body.append(this.$options);
		this.setOptions(['OK']);

		this.window.bringToFront();
		this.window.setInitialPosition(InitialPosition.CENTER);
	}

	setTitle(title: string) {
		this.window.setTitle(title);
	}

	setIcon(icon: string) {
		this.$icon.addClass(`${icon}-icon`);
	}

	setMessageHTML(msg: string) {
		this.$message[0].innerHTML = msg;
	}

	setOptions(options: string[]) {
		this.$options.empty();

		for (let i = 0; i < options.length; i++) {
			let $btn = $(`<button class="button">${options[i]}</button>`);
			$btn.click(() => {
				this.closeDeferred.resolve(i);
				this.window.close();
			});
			this.$options.append($btn);
		}
	}

	async show(): Promise<void> {
		await this.window.setVisible(true);
	}
}

export default { Dialog, showOptions, showError, showMessage };