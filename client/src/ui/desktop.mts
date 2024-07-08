import TaskbarM, { Taskbar } from './taskbar.mjs'
import Window from './window.mjs';
import Fullscreen from './fullscreen.mjs';
import { CtxMenuClass } from './context_menu.mjs';
import App from '../app.mjs';
import { Reactor } from '../events.mjs';
import { FileSystem } from '../bridges/filesystem.mjs';
import Util from '../util.mjs';
import { ClientClass } from '../client_core.mjs';

export class Desktop {
	windows: Window[];
	dwm: App;
	events: Reactor;
	iconifiedGroups: any;
	taskbar: Taskbar;
	focusedWindow: Window;
	mouseX: number;
	mouseY: number;
	contextMenuOpen: boolean;
	dragRectState: any;
	windowsWidth: number;
	windowsHeight: number;
	screenWidth: number;
	screenHeight: number;
	$desktop: $Element;
	$windows: $Element;
	$contextMenu: $Element;

	constructor() {
		this.windows = [];
		this.dwm = new App({
			id: 'dwm',
			noWindowGrouping: true
		});
		this.events = new Reactor();
		this.events.register("window-created", "window-destroyed");
		this.iconifiedGroups = {};
		this.$desktop = $('.desktop');
		this.$windows = $('.windows');
		this.taskbar = new TaskbarM.Taskbar();
		this.$contextMenu = $('.context-menu');
		this.focusedWindow = null;
		this.mouseX = 0;
		this.mouseY = 0;
		this.contextMenuOpen = false;
		this.dragRectState = {};

		let menu = CtxMenuClass.fromEntries([
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

		this.addCtxMenuOn(this.$desktop.find('.backplane'), () => menu);

		this._installWindowResizeHandlers();

		$(document).on('mousemove', (ev: MouseEvent) => {
			this.mouseX = ev.clientX;
			this.mouseY = ev.clientY;
		});

		$(document).on('mousedown', (ev) => {
			let $cmenu = this.$contextMenu;
			let el = ev.target as HTMLElement;

			// If the context menu *is not* and *does not contain*
			// the clicked element.
			if ($cmenu[0] != el && $cmenu.has(el).length === 0) {
				this.contextMenuOpen = false;
				$cmenu.removeClass('visible');
			}
		});

		$(window).on('resize', () => {
			this._queryBounds();
			for (let w of this.windows) {
				if (w.maximized) {
					w.setStyledSize(this.windowsWidth, this.windowsHeight);
					w.dispatch('resize');
				}
			}
		});	
		
		// Ready fullscreen system
		Fullscreen.init();
		this._queryBounds();	
	}

	/**
	 * Reload preferences.
	 */
	async reload() {
		let bg = ClientClass.get().config.preferences.background;
		if (bg) this.setBackground(bg);

		let useFilter = ClientClass.get().config.preferences.fullscreen_filter;
		if (useFilter === false) {
			document.documentElement.style.setProperty('--fullscreen-filter', 'var(--fullscreen-filter-off)');
		} else {
			document.documentElement.style.setProperty('--fullscreen-filter', 'var(--fullscreen-filter-on)');
		}
	}

	createWindow(app: App) {
		let win = new Window(app);
		this.windows.push(win);
		app.windows.push(win);
		win.init();

		this.events.dispatch('window-created');
		return win;
	}

	destroyWindow(win: Window) {
		// Remove window from windows list
		if (Util.arrErase(this.windows, win) < 0) return;

		// Dispatch closed event
		win.events.dispatch('closed');

		// Destroy all children windows
		for (let c of win.children) {
			Client.desktop.destroyWindow(c);
		}

		// Release window resources
		win._dispose();
		
		// Remove window from list
		Util.arrErase(win.app.windows, win);

		// If this was the main window, exit the owner app
		if (win.app.exitMode == 'last-win-closed') {
			setTimeout(() => win.app.exit());
		}

		this.events.dispatch('window-destroyed');
	}

	bringWindowToFront(win: Window) {
		this.windows.push(this.windows.splice(this.windows.indexOf(win), 1)[0]);
		this._restack();
	}

	getDesktopSize() {
		return [this.screenWidth, this.screenHeight];
	}

	backButton() {
		if (this.focusedWindow) {
			this.focusedWindow.dispatch('backnav');
		}
	}
	
	getWindowingArea() {
		let rect = this.$windows[0].getBoundingClientRect();
		return [rect.width, rect.height];
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

		let x = win.posX;
		let y = win.posY;

		for (let i = 0; i < this.windows.length; i++) {
			let w = this.windows[i];
			if (w === win) continue;
			if (Math.abs(w.posX - x) > 31 && Math.abs(w.posY - y) > 31) continue;

			x += 32;
			y += 32;
			i = -1;
		}

		win.setPosition(x, y);
	}

	setBackground(url: string) {
		this.$desktop.css('background-image', 'url("' + url + '")');
		Client.config.preferences.background = url;
	}

	openCtxMenuAt(menu, x, y) {
		this.contextMenuOpen = true;
		let $menu = this.$contextMenu;
		$menu.removeClass('.visible');
		$menu.empty();

		menu.buildIn($menu, this.$contextMenu, this.screenWidth, this.screenHeight);

		$menu.addClass('visible');
		let mwidth = $menu[0].offsetWidth;
		let mheight = $menu[0].offsetHeight;

		if (x + mwidth > this.screenWidth) x -= mwidth;
		if (x < 0) x = 0;

		if (y + mheight > this.screenHeight) y -= mheight;
		if (y < 0) y = 0;

		$menu.css('left', x);
		$menu.css('top', y);
	}

	addCtxMenuOn(element, menuFn) {
		$(element).on('contextmenu', (ev: MouseEvent) => {
			let mx = ev.clientX, my = ev.clientY;
	
			let menu = menuFn(ev);
			if (menu) {
				this.openCtxMenuAt(menu, mx, my);
				ev.preventDefault();
				return false;
			}
		});
	}

	setCursor(cursor) {
		document.body.style.cursor = cursor;
	}

	// Creates an app icon for each registered app and lays it out desktop backplane,
	// also configures their input behavior.
	setupApps() {
		let $apps = $('.backplane');
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
		let bounds = this.$desktop[0].getBoundingClientRect();
		this.screenWidth = bounds.width;
		this.screenHeight = bounds.height;
		bounds = this.$windows[0].getBoundingClientRect();
		this.windowsWidth = bounds.width;
		this.windowsHeight = bounds.height;
	}

	// Sets windows' z-index to match the windows array.
	_restack() {
		let index = 1;
		for (let win of this.windows) {
			let newZ = index++;
			if (win.zIndex != newZ) {
				win.zIndex = newZ;

				if (win.$window) {
					win.$window.css('z-index', newZ);
				}
			}
		}
	}

	_installWindowResizeHandlers() {
		let resWin = null;
		let startB;
		let startMX, startMY;
		let dragDir;
		let wx, wy, ww, wh;

		let dragStart = (mx, my, ev) => {
			for(let win of this.windows.slice().reverse()) {
				dragDir = this._getResizeDirection(win, mx, my);

				if (dragDir) {
					if (win.maximized) return;

					resWin = win;
					startMX = mx,       startMY = my;
					startB = win.getBounds();
					Client.desktop.setPointerEvents(false);
					ev.stopPropagation();
					return;
				} else {
					if (win.isPointInside(mx, my)) return;
				}
			};
		}

		let dragMove = (mx, my) => {
			if (resWin) {
				doResize(mx, my);
				return;
			}

			for(let win of this.windows.slice().reverse()) {
				let dir = this._getResizeDirection(win, mx, my);
				if (dir) {
					if (win.maximized) return;

					this.setCursor(this._getDirectionCursor(dir));
					return; 
				}

				if (win.isPointInside(mx, my)) break;
			}

			this.setCursor(null);
		};

		let doResize = (mx, my) => {
			if (!dragDir) return;

			let dx = mx - startMX;
			let dy = my - startMY;

			wx = startB[0], wy = startB[1];
			ww = startB[2], wh = startB[3];

			ww += dx * dragDir[0];
			wh += dy * dragDir[1];

			if (ww < resWin.minWidth) {
				dx -= resWin.minWidth - ww;
				ww = resWin.minWidth;
			}

			if (wh < resWin.minHeight) {
				dy -= resWin.minHeight - wh;
				wh = resWin.minHeight;
			}

			if (dragDir[0] < 0) { wx += dx; }
			if (dragDir[1] < 0) { wy += dy; }

			if (Client.config.preferences.show_dragged_window_contents) {
				resWin.setBounds(wx, wy, ww, wh);
			} else {
				this.setDragRectangle(wx, wy, ww, wh);
			}
		};

		let dragEnd = (mx, my) => {
			if (!resWin) return;
			doResize(mx, my);
			resWin.setBounds(wx, wy, ww, wh);
			this.setDragRectangle(null);
			Client.desktop.setPointerEvents(true);
			resWin = null;
		};

		this.$desktop[0].addEventListener("mousedown", (ev) => {
			let mx = ev.pageX, my = ev.pageY;
			dragStart(mx, my, ev);
		}, true);
		this.$desktop[0].addEventListener("touchstart", (ev) => {
			let { pageX, pageY } = ev.changedTouches[0];
			dragStart(pageX, pageY, ev);
		}, true);

		this.$desktop.on("mousemove", (ev: MouseEvent) => {
			let mx = ev.pageX, my = ev.pageY;	
			dragMove(mx, my);
		});
		this.$desktop.on("touchmove", (ev: TouchEvent) => {
			let { pageX, pageY } = ev.changedTouches[0];
			dragMove(pageX, pageY);
		});
		this.$desktop.on("mouseup", (ev: MouseEvent) => {
			let mx = ev.pageX, my = ev.pageY;	
			dragEnd(mx, my);
		});
		this.$desktop.on("touchend", (ev: TouchEvent) => {
			let { pageX, pageY } = ev.changedTouches[0];
			dragEnd(pageX, pageY);
		});
	}

	_getDirectionCursor(dir) {
		let h = dir[0], v = dir[1];
		if (h == 0) return "ns-resize";
		if (v == 0) return "ew-resize";
		if (h == v) return "nwse-resize";
		if (h != v) return "nesw-resize";
		return "initial";
	}

	_getResizeDirection(w, mx, my) {
		if (!w.visible || !w.decorated) return null;

		const im = 4;  // Inside margin
		const om = 8;  // Outside margin
		const abs = Math.abs;

		let dx = mx - w.posX,  dy = my - w.posY;
		let dw = dx - w.width, dh = dy - w.height;

		// If the mouse is outside the window + pixel border
		if (dx < -om || dw > om ||
			dy < -om || dh > om) return null;

		// Left or Right Edge
		let h = 0, v = 0;
		if (dx <=  im) h = -1;
		if (dw >= -im) h = 1;

		if (dy <=  im) v = -1;	 
		if (dh >= -im) v = 1;

		if (h == 0 && v == 0) return null;
		return [h, v]
	};
}

export default Desktop;