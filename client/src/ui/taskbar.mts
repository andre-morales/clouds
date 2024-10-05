import { ContextMenu } from './context_menu.mjs';
import Window from './window.mjs';
import App from '../app.mjs';
import Arrays from '../utils/arrays.mjs';

export class Taskbar {
	DEFAULT_TASKBAR_ICON: string;
	buttons: any[];
	noGrouping: boolean;
	$windowList: $Element;
	$bar: $Element;
	$tasks: $Element;
	$appsMenu: $Element;

	constructor() {
		this.buttons = [];
		this.DEFAULT_TASKBAR_ICON = '/res/img/icons/windows64.png';
		this.$windowList = $('#taskbar-window-list');
		this.$bar = $('.taskbar');
		this.$tasks = $('.taskbar .tasks');
		this.$appsMenu = this.$bar.find('#taskbar-apps-menu');
		this.noGrouping = false;

		this.$bar.find('.fullscreen-btn').click(async () => {
			let body = $('body')[0];

			let Fullscreen = (await import('./fullscreen.mjs')).default;
			if (Fullscreen.element == body) {
				Fullscreen.leave();
			} else Fullscreen.on(body);
		});

		$(document).on('mousedown', (ev) => {
			let et = ev.target as HTMLElement;
					
			// If the menu *is not* and *does not contain*
			// the clicked element.
			if (this.$windowList[0] != et && this.$windowList.has(et).length === 0) {
				this.closeWindowList();
			}

			if (this.$appsMenu[0] != et && this.$appsMenu.has(et).length === 0) {
				this.closeAppsMenu();
			}
		});
	}

	setupAppsMenu() {
		let $appsList = this.$appsMenu.find('ul');
		for (let [appId, appDef] of Client.appManager.getAppEntries()) {
			// Create the icon element. If the image fails to load, set the default icon
			let icon = appDef.icons[0].url;
			let $icon = $(`<img src='${icon}'/>`);
			$icon.on('error', () => {
				$icon.attr('src', Client.appManager.getDefaultAppIcon().url);
			})

			// Create the app element
			let $appItem = $(`<li><span>${appDef.displayName}</span></li>`);
			$appItem.prepend($icon);

			$appItem.click(() => {
				Client.runApp(appDef.id);
				this.closeAppsMenu();
			});

			$appsList.append($appItem);
		}

		this.$bar.find('.apps-btn').click((ev) => {
			this.$appsMenu.css('display', 'block');
		});

		this.$appsMenu.find('.logout-btn').click(() => {
			Client.logout();
		});
	}

	addWindow(win: Window): TaskbarButton {
		// If grouping is enabled for the taskbar and the app try to find a taskbar button with
		// the same app id
		if (!this.noGrouping && !win.app.noWindowGrouping) {
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

	closeAppsMenu() {
		this.$appsMenu.css('display', 'none');
	}

	closeWindowList() {
		this.$windowList.css('display', 'none');
		this.$windowList.empty();
	}
}

export class TaskbarButton {
	app: App;
	windows: Window[];
	single: boolean;
	icon: string;
	taskButton: any;
	$button: any;
	$text: any;
	$count: any;

	constructor(app: App) {
		this.app = app;
		this.windows = [];
		this.single = false;
		this.icon = Client.desktop.taskbar.DEFAULT_TASKBAR_ICON;
		this.$button = null;

		Client.desktop.taskbar.buttons.push(this);
	}

	addWindow(win: Window) {
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

	removeWindow(win: Window) {
		Arrays.erase(this.windows, win);

		// If all windows were closed
		if (this.windows.length == 0) {
			Arrays.erase(Client.desktop.taskbar.buttons, this.taskButton);

			this.$button.remove();
			this.$button = null;
			return;
		}

		// If there's a single window left
		if (this.windows.length == 1) {
			this.single = true;
			this.setText(this.windows[0].getTitle());
		}

		this.updateCount();
	}

	createButton(firstWindow: Window) {
		if (firstWindow.icon) this.icon = firstWindow.icon;

		// Create taskbar button
		this.$button = $(`<div class='task-button'><span class='count'>2</span></div>`);
		let $icon = $(`<img src='${this.icon}'/>`);
		this.$button.append($icon);
		this.$button.append(`<span class='text'>${firstWindow.getTitle()}</span>`);

		// If taskbar icon fails to load, set a default one
		$icon.on('error', () => {
			let src = $icon.attr('src');
			if (src != Client.desktop.taskbar.DEFAULT_TASKBAR_ICON) {
				$icon.attr('src', Client.desktop.taskbar.DEFAULT_TASKBAR_ICON);
			}
		});

		this.$text = this.$button.find('.text');
		this.$count = this.$button.find('.count');

		this.$button.click(() => {
			if (this.single) {
				let win = this.windows[0];
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
				let win = this.windows[0];
				return win.optionsCtxMenu;
			} else {
				return ContextMenu.fromDefinition([
					['-Close all', () => this.closeAll()]
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
			let icon = (w.icon) ? w.icon : this.icon;
			let $item = $(`<li><img src='${icon}'/>${w.getTitle()}</li>`);
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

	setText(text: string) {
		this.$text.text(text);
	}

	updateCount() {
		let count = this.windows.length;
		this.$count.text((count >= 2) ? count : '');
	}
}

export default { Taskbar }