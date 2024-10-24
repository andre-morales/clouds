import App from '../app.mjs';
import { Deferred } from '../events.mjs';
import Window, { InitialPosition } from './window.mjs';

type DialogTuple = [Promise<number>, Window];

interface DialogOptions {
	icon?: string;
}

export function showOptions(app: App, title: string, msg: string, options: string[], settings: DialogOptions = {}): DialogTuple {
	if (!msg) msg = "";

	let deferred = new Deferred();

	let win = Client.desktop.createWindow(app);
	win.$window.addClass('dialog');
	win.setTitle(title);
	
	let $body = win.$window.find('.window-body');
	
	// Create message box
	let icon = (settings.icon) ? settings.icon : 'info';
	let $msg = $("<div class='message'>");
	$msg.append($(`<i class='dialog-icon ${icon}-icon'>`))
	
	let html = msg.toString().replaceAll('\n', '<br>');
	$msg.append($('<span class="dialog-text"><br/>' + html + '</span>'));
	$body.append($msg);

	// Create a button for each option
	let $options = $('<div class="options"></div>');
	for (let i = 0; i < options.length; i++) {
		let $btn = $(`<button class="button">${options[i]}</button>`);
		$btn.click(() => {
			deferred.resolve(i);
			win.close();
		});
		$options.append($btn);
	}
	$body.append($options);

	// Resolve the promise when the window is finally closed.
	win.on('closed', () => {
		deferred.resolve(-1);
	});

	win.bringToFront();
	win.setInitialPosition(InitialPosition.CENTER);
	win.setVisible(true);

	return [deferred.promise, win];
}

export function showError(app: App, title: string, msg: string): DialogTuple {
	let [prom, win] = showOptions(app, title, msg, ["OK"], {
		icon: 'error'
	});
	return [prom, win];
}

export function showMessage(app: App, title: string, msg: string): DialogTuple {
	let [prom, win] = showOptions(app, title, msg, ["OK"], {
		icon: 'info'
	});
	return [prom, win];
}

export default { showOptions, showError, showMessage };