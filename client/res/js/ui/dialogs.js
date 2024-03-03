class Dialogs {
	static showOptions(app, title, msg, options, settings = {}) {
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
		
		let html = strReplaceAll(msg.toString(), '\n', '<br>');
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
		win.setSize(360, 220);
		win.pack();
		win.bringToFront();
		win.bringToCenter();
		win.setVisible(true);

		return [win, deferred.promise];
	}

	static showError(app, title, msg) {
		let [win, prom] = Dialogs.showOptions(app, title, msg, ["OK"], {
			icon: 'error'
		});
		return [win, prom];
	}
}
