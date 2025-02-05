import TaskbarM, { Taskbar } from './taskbar.mjs'
import Window from './window.mjs';
import Fullscreen from './fullscreen.mjs';
import { ContextMenu } from './controls/context_menu/ctx_menu.mjs';
import App, { ExitMode } from '../app.mjs';
import { Reactor } from '../events.mjs';
import { ClientClass } from '../client_core.mjs';
import Arrays from '../../../common/arrays.mjs';
import { WindowManager } from './window_manager.mjs';
import ContextMenuDesktopController from './controls/context_menu/desktop_controller.mjs';

export class Desktop {
	dwm: App;
	events: Reactor;
	taskbar: Taskbar;
	focusedWindow: Window;
	private ctxMenuController: ContextMenuDesktopController;
	private dragRectState: any;
	private windowManager: WindowManager;
	private windowsWidth: number;
	private windowsHeight: number;
	private screenWidth: number;
	private screenHeight: number;
	$desktop: $Element;
	$windows: $Element;

	constructor() {
		this.dwm = new App({
			id: 'dwm',
			noWindowGrouping: true
		});
		this.events = new Reactor();
		this.events.register("window-created", "window-destroyed");
		this.$desktop = $('#desktop');
		this.$windows = $('.windows');
		this.windowManager = new WindowManager(this);
		this.taskbar = new TaskbarM.Taskbar();
		
		this.focusedWindow = null;
		this.dragRectState = {};

		this.ctxMenuController = new ContextMenuDesktopController(this);
		let menu = ContextMenu.fromDefinition([
			["-System Settings", () => {
				Client.runApp('configs');
			}],
			["-Console", () => {
				Client.runApp('console');
			}],
			["-About", () => {
				Client.runApp('about');
			}],
			['|'],
			["-Logout", () => {
				Client.logout();
			}],			
		]);

		this.addCtxMenuOn(this.$desktop.find('.back-plane'), () => menu);
		
		$(window).on('resize', () => {
			this._queryBounds();
			for (let w of this.windowManager.getWindows()) {
				if (w.maximized) {
					w.getPresentation().setSize(this.windowsWidth, this.windowsHeight);
					w.dispatch('resize');
				}
			}
		});	
		
		this.#initPrefBindings();

		// Ready fullscreen system
		Fullscreen.init();
		this._queryBounds();	
	}

	/**
	 * Watch changes to important preferences keys.
	 */
	#initPrefBindings() {
		let pref = ClientClass.get().config.preferencesMgr;

		pref.observeProperty("background", () => {
			this.#reloadBackground();
		});

		pref.observeProperty("fullscreen_filter", (value) => {
			if (value === false) {
				document.documentElement.style.setProperty('--fullscreen-filter', 'var(--fullscreen-filter-off)');
			} else {
				document.documentElement.style.setProperty('--fullscreen-filter', 'var(--fullscreen-filter-on)');
			}
		});
	}

	public createWindow(app: App): Window {
		let win = new Window(app);
		app.windows.push(win);
		this.windowManager.addWindow(win);
		win.init();
		this.events.dispatch('window-created');
		return win;
	}

	public destroyWindow(win: Window): void {
		if(!this.windowManager.removeWindow(win)) return;

		// Dispatch closed event
		win.dispatch('closed');

		// Destroy all children windows
		for (let c of win.children) {
			Client.desktop.destroyWindow(c);
		}

		// Release window resources
		win._dispose();
		
		// Remove window from app windows list
		Arrays.erase(win.app.windows, win);

		// If this was the main window, exit the owner app
		if (win.app.exitMode == ExitMode.LAST_WINDOW_CLOSED) {
			setTimeout(() => win.app.exit());
		}

		this.events.dispatch('window-destroyed');
	}

	bringWindowToFront(win: Window) {
		this.windowManager.bringToFront(win);
	}

	getDesktopSize() {
		return [this.screenWidth, this.screenHeight];
	}

	backButton() {
		if (this.focusedWindow) {
			this.focusedWindow.dispatch('backnav');
		}
	}
	
	getWindowingArea(): [width: number, height: number] {
		let rect: DOMRect = this.$windows[0].getBoundingClientRect();
		return [rect.width, rect.height];
	}

	getWindowManager() {
		return this.windowManager;
	}

	getDefaultWindowSize() {
		let rect = this.getWindowingArea();
		let w = (rect[0] * 0.9 < 512) ? rect[0] * 0.9 : 512;
		let h = (rect[1] * 0.9 < 768) ? rect[1] * 0.9 : 768;
		return [w, h];
	}

	// Repositions the window so that it doesn't stay directly on top of any other window
	realignWindow(win: Window) {
		if (win.maximized) return;

		let [wx, wy] = win.getPosition();
		let x = wx, y = wy;

		let windows = this.windowManager.getWindows();
		for (let i = 0; i < windows.length; i++) {
			let w = windows[i];
			if (w === win) continue;
			if (Math.abs(wx- x) > 31 && Math.abs(wy - y) > 31) continue;

			x += 32;
			y += 32;
			i = -1;
		}

		win.setPosition(x, y);
	}

	setBackground(url: string) {
		Client.config.preferences.background = url;
	}
	
	openCtxMenuAt(menu: ContextMenu, x: number, y: number) {
		this.ctxMenuController.openCtxMenuAt(menu, x, y);
	}

	addCtxMenuOn(element: HTMLElement | $Element, menuFn: (ev: MouseEvent) => ContextMenu) {
		this.ctxMenuController.addCtxMenuOn(element, menuFn);
	}

	setCursor(cursor: string) {
		document.body.style.cursor = cursor;
	}

	// Creates an app icon for each registered app and lays it out desktop back-plane,
	// also configures their input behavior.
	setupApps() {
		let $apps = $('.back-plane');
		for (let [id, def] of Client.appManager.getAppEntries()) {
			if (def.flags.includes('disabled')) continue;
			if (!def.flags.includes('desk')) continue;

			let img = def.icons[0].url;
			let name = def.displayName;
			let $icon = $(`<div class='app-icon'> <img src='${img}'/> <label>${name}</label> </div>`);
			$icon.click(async () => {
				let app = await Client.runApp(id);
				if (app && app.mainWindow) {
					app.mainWindow.focus();
					app.mainWindow.bringToFront();
				}
			});
			$apps.append($icon);
		}
	}

	setDragRectangle(x?: number, y?: number, width?: number, height?: number) {
		let style = $("#window-drag-rect")[0].style;
		let lastTime;

		window.requestAnimationFrame((time) => {
			if (lastTime == time) return;
			lastTime = time;

			if (x === undefined || x === null) {
				style.display = 'none';
				this.dragRectState.display = 'none';
				return;
			}

			if (this.dragRectState.display != 'block') {
				this.dragRectState.display = 'block';
				style.display = 'block';
			}

			if (this.dragRectState.width != width || this.dragRectState.height != height) {
				this.dragRectState.width = width;
				this.dragRectState.height = height;
				style.width = width + "px";
				style.height = height + "px";
			}

			style.transform = `translate(${x}px, ${y}px)`;
		});		
	}

	setPointerEvents(evs) {
		this.$desktop.find('.dt-area').css('pointer-events', (evs) ? '' : 'none');
	}

	// Updates desktop area to match client window area
	_queryBounds() {
		let screenBounds = this.$desktop[0].getBoundingClientRect();
		this.screenWidth = screenBounds.width;
		this.screenHeight = screenBounds.height;
		
		let dtBounds = this.$windows[0].getBoundingClientRect();
		this.windowsWidth = dtBounds.width;
		this.windowsHeight = dtBounds.height;
	}

	#reloadBackground() {
		let url = ClientClass.get().config.preferences.background;
		this.$desktop.css('background-image', 'url("' + url + '")');
	}
}

export default Desktop;