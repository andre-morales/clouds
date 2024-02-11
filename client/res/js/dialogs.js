
class Dialogs {
	static showError(title, msg) {
		if (!title) title = 'Error';

		let win = WebSys.desktop.createWindow();
		win.$window.addClass('error-dialog');
		win.setTitle(title);
		let $body = win.$window.find('.window-body');
		$body.append($('<img src="/res/img/icons/error.png">'))

		let html = msg.toString().replaceAll('\n', '<br>');

		$body.append($('<span>' + html + '</span>'))
		win.on('closereq', () => win.close());
		win.setSize(380, 200);
		win.bringToCenter();
		win.bringToFront();
		win.setVisible(true);
		return win;
	}

	static showOptions(title, msg, options) {
		let deferred = new Deferred();

		let win = WebSys.desktop.createWindow();
		win.$window.addClass('dialog');
		win.setTitle(title);
		let $body = win.$window.find('.window-body');
		$body.append($('<img src="/res/img/icons/error.png">'))

		let html = msg.toString().replaceAll('\n', '<br>');

		$body.append($('<span>' + html + '</span>'));
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
		win.on('closereq', () => {
			deferred.resolve(-1);
			win.close();
		});
		win.setSize(380, 200);
		win.bringToCenter();
		win.bringToFront();
		win.setVisible(true);
		return [win, deferred.promise];
	}
}
