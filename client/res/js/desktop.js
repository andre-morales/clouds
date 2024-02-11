class Desktop {
	constructor() {
		this.windows = [];
		this.dwm = new App("dwm");
		this.configs = [];
		this.iconifiedWindows = new Map();
		this.iconifiedGroups = {};
		this.$desktop = $('.desktop');
		this.$windows = $('.windows');
		this.$taskBar = $('.taskbar');
		this.$tasks = $('.taskbar .tasks');
		this.$contextMenu = $('.context-menu');
		this.focusedWindow = null;
		this.mouseX = 0;
		this.mouseY = 0;
		this.contextMenuOpen = false;

		this._configsProm = fetch("/fs/q/usr/desktop.json").then(res => res.json());

		this.$taskBar.find('.fullscreen-btn').click(() => {
			let body = $('body')[0];
			if (Fullscreen.element == body) {
				Fullscreen.leave();
			} else Fullscreen.on(body);
		});

		this.$taskBar.find('.apps-btn').click((ev) => {
			let items = Object.keys(Client.registeredApps)
				.map((id) => CtxItem(Client.registeredApps[id].name, () => Client.runApp(id)));
			
			let menu = CtxMenu(items);
			this.openCtxMenuAt(menu, ev.clientX, ev.clientY);
		});

		let menu = CtxMenu([
			CtxItem("System Settings", () => {
				Client.runApp('configs');
			})
		]);
		this.addCtxMenuOn(this.$desktop.find('.backplane'), () => menu);

		this._installWindowResizeHandlers();

		$(document).on('mousemove', (ev) => {
			this.mouseX = ev.clientX;
			this.mouseY = ev.clientY;
		});

		$(document).on('mousedown', (ev) => {
			let $cmenu = this.$contextMenu;
			let el = ev.target;

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
					w.setSize(this.windowsWidth, this.windowsHeight);
				}
			}
		});	
		
		// Ready fullscreen system
		Fullscreen.init();
		this._queryBounds();	


	}

	async start() {
		this.configs = await this._configsProm;

		let bg = this.configs.background;
		if (bg) this.setBackground(bg);
		else this.setBackground('/res/img/background.png');
	}

	async saveConfigs() {
		let data = JSON.stringify(this.configs);
		
		await fetch('/fs/ud/usr/desktop.json', {
			method: 'POST',
			body: data,
			headers: {
				'Content-Type': 'text/plain'
			}
		});
	}

	createWindow(app) {
		let win = new Window(this, app);
		this.windows.push(win);

		//this.iconifiedGroups[app.id];

		win.init();
		return win;
	}

	bringWindowToFront(win) {
		this.windows.push(this.windows.splice(this.windows.indexOf(win), 1)[0]);
		this._restack();
	}

	getDesktopSize() {
		return [this.screenWidth, this.screenHeight];
	}

	backButton() {
		if (this.focusedWindow) {
			this.focusedWindow.fire('backnav');
		}
	}

	getDefaultWindowBounds() {
		let rect = this.$desktop[0].getBoundingClientRect();

		if (rect.width < 720) {
			return [10, 10, 300, 600];
		} else {
			return [32, 32, 640, 600];
		}
	}

	setBackground(url, save) {
		this.$desktop.css('background-image', 'url("' + url + '")');
		if (save) {
			this.configs.background = url;
			this.saveConfigs();
		}
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
		$(element).on('contextmenu', (ev) => {
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
		for (let id in Client.registeredApps) {
			let def = Client.registeredApps[id];

			if (def.flags.includes('disabled')) continue;
			if (!def.flags.includes('desk')) continue;

			let img = def.icon;
			let name = def.name;
			let $icon = $(`<div class='app-icon'> <img src='${img}'> <label>${name}</label> </div>`);
			$icon.click(() => {
				Client.runApp(id);
			});
			$apps.append($icon);
		}
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
				win.$window.css('z-index', newZ);
			}
		}
	}

	_installWindowResizeHandlers() {
		let resWin = null;
		let startB;
		let startMX, startMY;
		let dragDir;

		let dragStart = (mx, my, ev) => {
			for(let win of this.windows.slice().reverse()) {
				dragDir = this._getResizeDirection(win, mx, my);

				if (dragDir) {
					if (win.maximized) return;

					resWin = win;
					startMX = mx,       startMY = my;
					startB = win.getBoundsA();
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
			let dx = mx - startMX;
			let dy = my - startMY;

			let wx = startB[0], wy = startB[1];
			let ww = startB[2], wh = startB[3];

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
			resWin.setBounds(wx, wy, ww, wh);
		};

		this.$desktop[0].addEventListener("mousedown", (ev) => {
			let mx = ev.pageX, my = ev.pageY;
			dragStart(mx, my, ev);
		}, true);
		this.$desktop[0].addEventListener("touchstart", (ev) => {
			let mx = ev.changedTouches[0].pageX;
			let my = ev.changedTouches[0].pageY;
			dragStart(mx, my, ev);
		}, true);

		this.$desktop.on("mousemove", (ev) => {
			let mx = ev.pageX, my = ev.pageY;	
			dragMove(mx, my);
		});
		this.$desktop.on("touchmove", (e) => {
			let mx = e.changedTouches[0].pageX;
			let my = e.changedTouches[0].pageY;
			dragMove(mx, my);
		});
		this.$desktop.on("mouseup", () => {
			resWin = null;
		});
		this.$desktop.on("touchend", () => {
			resWin = null;
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

class Fullscreen {
	static stack = [];
	static element = null;
	static fullscreenCallbacks = [];
	static $style = null;

	// Call before utilizing any of the fullscreen utilities. Sets up a callback for fullscreen state changes and
	// prepares custom styling for any fullscreen elements.
	static init() {
		let fscrHandler = () => {
			// If the browser went fullscreen
			if(document.fullscreenElement) {
				// Notify those who are waiting for
				// the browser to finish going fullscreen
				this.fullscreenCallbacks.forEach(fn => fn());
				this.fullscreenCallbacks = [];
				return;
			}
			
			// Whenever the user exits browser fullscreen,
			// update our custom fullscreen state as well
			this._clearClasses();
			this._clearStyle();
			this.stack = [];
			this.element = null;			
		}
		
		// Locates the empty <style> in the head of the page. This tag will be used for applying --reversible--
		// style changes to the fullscreened element itself and all of its ancestors.
		this.$style = $("#fullscreen-style");
		
		// Install the listener
		document.addEventListener('fullscreenchange', fscrHandler);
	}

	// Applies fullscreen on any html element. Fullscreen calls can be stacked, and will be unwound upon calling
	// rewind().
	static on(el) {
		this.element = el;
		this.stack.push(el);			
		
		// Wait for the browser to go fullscreen if it wasn't already
		// and then apply the styles and classes.
		this._domEnterFscr(() => {
			this._clearClasses();
			this._clearStyle();

			this._applyStyle(el);
			this._applyClasses(el);
		});
	}

	// Leave fullscreen from any elements entirely.
	static leave() {
		this.stack = [];
		this.element = null;

		this._clearClasses();
		this._clearStyle();
		this._domExitFscr();
	}

	// Fullscreen the element that was previously fullscreened. If none were, leaves fullscreen state.
	static rewind() {
		let pop = this.stack.pop();
		let len = this.stack.length;
		if (len == 0) {
			this._domExitFscr();
			this.element = null;
		}

		let last = this.stack[len - 1];
		this.element = last;
		if(last) {
			this._clearClasses();
			this._clearStyle();
			this._applyStyle(last);
			this._applyClasses(last);
		}
	}
	
	// Apply custom fullscreen classes to the element and its ancestors.
	static _applyClasses(elem) {
		this._clearClasses();

		let $el = $(elem);
		$el.addClass('fullscreened');
		$el.parents().each((i, el) => {
			$(el).addClass('fscr-parent');
		});
	}

	// Removes all custom classes from fullscreen elements and its ancestors.
	static _clearClasses() {
		// Get fullscreened element
		let $el = $('.fullscreened');
		if ($el.length == 0) return;

		// Remove classes
		$el.removeClass('fullscreened');
		$('.fscr-parent').removeClass('fscr-parent')
	}

	// Applies custom styling to the fullscreened element and its parents by inserting a rule in the fullscreen
	// <style> tag.
	static _applyStyle(elem) {
		this._clearStyle();
		
		let sheet = this.$style[0].sheet;
		setTimeout(() => {
			let rect = elem.getBoundingClientRect();
			sheet.insertRule(`.fullscreened { transform: translate(${-rect.x}px, ${-rect.y}px); width: ${window.innerWidth}px; height: ${window.innerHeight}px; } `);
		}, 50);
	}

	// Removes all custom styling from the elements by clearing the fullscreen <style> tag.
	static _clearStyle() {
		let sheet = this.$style[0].sheet;
		while (sheet.cssRules.length > 0) {
			sheet.deleteRule(0);
		}
	}

	// Requests fullscreen state on the body element of the page, calling the given callback once the transition
	// is finished. If the browser was already on fullscreen state, calls callback immediately.
	static _domEnterFscr(callback) {
		// If the browser already is in fullscreen, just run the callback immediately
		if (document.fullscreenElement) {
			if (callback) callback();
			return;
		}
		
		// Otherwise, schedule the callback and request DOM fullscreen on the whole document
		if (callback) this.fullscreenCallbacks.push(callback);
		document.body.requestFullscreen().then(() => {
			console.log("fullscr promise");
		});
	}
	
	// Leaves browser fullscreen state
	static _domExitFscr() {
		if (document.fullscreenElement) document.exitFullscreen();
	}
}

class CtxMenuClass {
	constructor(entr, label) {
		this.entries = (entr) ? entr : [];
		this.label = label;
	}

	buildIn($menu, $rootMenu, screenWidth, screenHeight) {
		for (let entry of this.entries) {
			if (entry === '-') {
				$menu.append($('<hr>'));
				continue;
			}

			let $item;
			let label = entry.label;
			let action = entry.action;

			if (entry instanceof CtxCheckClass) {
				$item = $(`<i class='check'>${label}</i>`)
				if (entry.checked) $item.addClass('checked');

				$item.on('click', () => {
					entry.checked = !entry.checked;
					//$item.toggleClass('checked', entry.checked);
					if (action) action.apply(entry, [entry.checked]);
					$rootMenu.removeClass('visible');
				});
			} else if (entry instanceof CtxMenuClass) {
				$item = $(`<i class='menu'>${label}</i>`);
				let $sub = $('<div class="context-menu">');
				entry.buildIn($sub, $rootMenu);

				$item.append($sub);

				$item.on('click', () => {
					$sub.addClass('visible');
					let rectP = $menu[0].getBoundingClientRect();
					let rectI = $item[0].getBoundingClientRect();

					let x = rectI.width;
					let y = rectI.y - rectP.y;

					let mwidth = $sub[0].offsetWidth;
					let mheight = $sub[0].offsetHeight;

					if (rectP.x + x + mwidth > screenWidth) x -= mwidth;
					if (x < 0) x = 0;

					if (rectP.y + y + mheight > screenHeight) y -= mheight;
					if (y < 0) y = 0;

					$sub.css('left', x);
					$sub.css('top', y);
				});
			} else {
				$item = $(`<i>${label}</i>`)
				$item.on('click', () => {
					if (action) action();
					$rootMenu.removeClass('visible');
				});
			}

			$menu.append($item);
		}
	}
}

class CtxItemClass {
	constructor(label, action) {
		this.label = label;
		this.action = action;
	}
}

class CtxCheckClass extends CtxItemClass {
	constructor(label, action, checked) {
		super(label, action);
		this.checked = Boolean(checked);
	}
}

function CtxMenu() {
	return new CtxMenuClass(...arguments);
}

function CtxItem() {
	return new CtxItemClass(...arguments);
}

function CtxCheck() {
	return new CtxCheckClass(...arguments);
}