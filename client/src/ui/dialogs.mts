import App from '../app.mjs';
import Client from '../client_core.mjs';
import { Deferred } from '../events.mjs';

export function showOptions(app: App, title: string, msg: string, options: string[], settings: any = {}) {
	if (!msg) msg = "";

	let deferred = new Deferred();

	let win = Client.get().desktop.createWindow(app);
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

	let $options = $('<div class="options"></div>');
	$body.append($options);

	for (let i = 0; i < options.length; i++) {
		let $btn = $(`<button class="button">${options[i]}</button>`);
		$btn.click(() => {
			deferred.resolve(i);
			win.close();
		});
		$options.append($btn);
	}
	win.on('closed', () => {
		deferred.resolve(-1);
	});

	win.bringToFront();
	win.setInitialPosition('center');
	win.setVisible(true);

	return [win, deferred.promise];
}

export function showError(app: App, title: string, msg: string) {
	let [win, prom] = showOptions(app, title, msg, ["OK"], {
		icon: 'error'
	});
	return [win, prom];
}

export default { showOptions, showError };