class Taskbar {
	constructor() {
		this.buttons = [];
		this.$windowList = $('#taskbar-window-list');
		this.$bar = $('.taskbar');
		this.$tasks = $('.taskbar .tasks');
		this.noGrouping = false;

		$(document).on('mousedown', (ev) => {
			let $wlist = this.$windowList;
			let el = ev.target;

			// If the menu *is not* and *does not contain*
			// the clicked element.
			if ($wlist[0] != el && $wlist.has(el).length === 0) {
				this.closeWindowList();
			}
		});
	}

	addWindow(win) {
		// If grouping is enabled, try to find a taskbar button with the same app id
		if (!this.noGrouping) {
			for (let tb of this.buttons) {
				if (tb.app.classId == win.app.classId) {
					tb.addWindow(win);
					return tb;
				} 
			}
		}

		// If no taskbar button was found, create one
		let button = new TaskbarButton(win.app);
		button.addWindow(win);
		return button;
	}

	closeWindowList() {
		this.$windowList.css('display', 'none');
		this.$windowList.empty();
	}
}

class TaskbarButton {
	constructor(app) {
		this.app = app;
		this.windows = [];
		this.single = false;
		this.$button = null;

		Client.desktop.taskbar.buttons.push(this);
	}

	addWindow(win) {
		this.windows.push(win);

		// If this is the first window of this button, create it
		if (this.windows.length == 1) {
			this.single = true;
			this.createButton(win);
		} else {
			this.single = false;
			let text = this.app.displayName;
			// If the app has no display name defined, use its ID with the first letter capitalized.
			if (!text) {
				text = this.app.classId.charAt(0).toUpperCase() + this.app.classId.slice(1);
			}
			this.setText(text);
		}
		this.updateCount();
	}

	removeWindow(win) {
		arrErase(this.windows, win);

		// If all windows were closed
		if (this.windows.length == 0) {
			arrErase(Client.desktop.taskbar.buttons, this.taskButton);

			this.$button.remove();
			this.$button = null;
			return;
		}

		// If there's a single window left
		if (this.windows.length == 1) {
			this.single = true;
			this.setText(win.title);
		}

		this.updateCount();
	}

	createButton(win) {
		let icon = win.icon;
		if (!icon) icon = '/res/img/icons/windows64.png';

		// Create taskbar button
		this.$button = $(`<div class='task-button'><span class='count'>2</span><img src='${icon}'/><span class='text'>${win.title}</span></div>`);
		this.$text = this.$button.find('.text');
		this.$count = this.$button.find('.count');

		this.$button.click(() => {
			if (this.single) {
				if (win.minimized) {
					win.restore();
				}
				
				win.bringToFront();
				win.focus();
			} else {
				this.openWindowList();
			}
		});			
		
		Client.desktop.addCtxMenuOn(this.$button, () => {
			if (this.single) {
				return win.optionsCtxMenu;
			} else {
				return CtxMenu([
					CtxItem('Close all', () => this.closeAll())
				]);	
			}
		});

		Client.desktop.taskbar.$tasks.append(this.$button);
	}

	openWindowList() {
		let offset = this.$button.offset();
		let x = offset.left;
		let y = offset.top;

		let $list = Client.desktop.taskbar.$windowList;

		for (let w of this.windows) {
			let $item = $(`<li><img src='${w.icon}'/>${w.title}</li>`);
			Client.desktop.addCtxMenuOn($item, () => w.optionsCtxMenu);
			$item.click(() => {
				if (w.minimized) {
					w.restore();
				}
				
				w.bringToFront();
				w.focus();
				Client.desktop.taskbar.closeWindowList();
			});
			$list.append($item);
		}

		$list.css('left', `${x}px`);
		$list.css('bottom', `${Client.desktop.screenHeight - y}px`);
		$list.css('display', 'block');
	}

	closeAll() {
		for (let w of this.windows) {
			setTimeout(() => {
				w.close();
			});
		}
	}

	setText(text) {
		this.$text.text(text);
	}

	updateCount() {
		let count = this.windows.length;
		this.$count.text((count >= 2) ? count : '');
	}
}