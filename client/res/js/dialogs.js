class Dialogs {
	static showOptions(app, title, msg, options) {
		let deferred = new Deferred();

		let win = WebSys.desktop.createWindow(app);
		win.$window.addClass('dialog');
		win.setTitle(title);
		
		let $body = win.$window.find('.window-body');
		
		// Create message box		
		let $msg = $("<div class='message'>");
		$msg.append($('<i class="dialog-icon info-icon">'))
		
		let html = msg.toString().replaceAll('\n', '<br>');
		$msg.append($('<span><br/>' + html + '</span>'));
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
		win.setSize(400, 220);
		win.bringToCenter();
		win.bringToFront();
		win.setVisible(true);
		return [win, deferred.promise];
	}

	static showError(app, title, msg) {
		let [win, prom] = Dialogs.showOptions(app, title, msg, ["OK"]);
		win.$window.find('.dialog-icon')
			.removeClass('info-icon')
			.addClass('error-icon');
	}
}
