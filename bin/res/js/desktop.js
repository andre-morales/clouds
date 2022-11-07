class Desktop {
	constructor() {
		this.windows = [];
		this.iconifiedWindows = new Map();
		this.$desktop = $('.desktop');
		this.$windows = $('.windows');
		this.$tasks = $('.taskbar .tasks');
		this.$contextMenu = $('.context-menu');
		this.focusedWindow = null;
		this.mouseX = 0;
		this.mouseY = 0;
		this.contextMenuOpen = false;

		$('.taskbar .fullscreen-btn').click(() => {
			let body = $('body')[0];
			if (Fullscreen.element == body) {
				Fullscreen.leave();
			} else Fullscreen.on(body);
		});

		let menu = [
			["System Settings", () => {
				WebSys.runApp('configs');
			}]
		]
		this.addContextMenuOn(this.$desktop.find('.backplane'), menu);

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
		
		Fullscreen.init();
		this._queryBounds();	
	}

	start() {
		let bg = localStorage.getItem('bg');
		if (bg) this.setBackground(bg);
		else this.setBackground('/res/img/background.png');
	}

	createWindow() {
		let win = new Window(this);
		this.windows.push(win);
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
			localStorage.setItem('bg', url);
		}
	}

	addContextMenuOn(element, menu) {
		$(element).on('contextmenu', (ev) => {
			let mx = ev.clientX, my = ev.clientY;

			this.openContextMenuAt(menu, mx, my);
			ev.preventDefault();
			return false;
		});
	}

	addContextMenuFnOn(element, menuFn) {
		$(element).on('contextmenu', (ev) => {
			let mx = ev.clientX, my = ev.clientY;

			this.openContextMenuAt(menuFn(), mx, my);
			ev.preventDefault();
			return false;
		});
	}

	openContextMenuAt(menu, x, y) {
		this.contextMenuOpen = true;
		let $menu = this.$contextMenu;
		$menu.removeClass('.visible');
		$menu.empty();

		for (let obj of menu) {
			if (obj === '-') {
				$menu.append($('<hr>'));
			} else {
				let name = obj[0];
				let action = obj[1];
				let item = $(`<i>${name}</i>`)
				item.on('click', () => {
					action();
					$menu.removeClass('visible');
				});
				$menu.append(item);
			}
		}

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

	setCursor(cursor) {
		document.body.style.cursor = cursor;
	}

	setApps(apps) {
		let $apps = $('.backplane');
		for (let [label, def] of Object.entries(apps)) {
			let img = def.icon;
			let $icon = $(`<div class='app-icon'> <img src='${img}'> <label>${label}</label> </div>`);
			$icon.click(() => {
				WebSys.runApp(def.app);
			});
			$apps.append($icon);
		}
	}
	
	_queryBounds() {
		let bounds = this.$desktop[0].getBoundingClientRect();
		this.screenWidth = bounds.width;
		this.screenHeight = bounds.height;
		bounds = this.$windows[0].getBoundingClientRect();
		this.windowsWidth = bounds.width;
		this.windowsHeight = bounds.height;
	}

	/* Sets windows' z-index to match the windows array */
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

	static init() {
		let fscrHandler = () => {
			let el = document.fullscreenElement;
			if (!el) {
				this._exitFullscr();
				this.stack = [];
				this.element = null;
			}
		}

		document.addEventListener('fullscreenchange', fscrHandler);
	}

	static on(el) {
		this._fullscreenElem(el);
		document.documentElement.requestFullscreen();

		this.element = el;
		this.stack.push(el);
	}

	static leave() {
		this.stack = [];
		this.element = null;

		this._exitFullscr();
		this._domExit();
	}

	static rewind() {
		let pop = this.stack.pop();
		let len = this.stack.length;
		if (len == 0) {
			this._domExit();
			this.element = null;
		}

		let last = this.stack[len - 1];
		this.element = last;
		if(last) this._fullscreenElem(last);
	}

	static _exitFullscr() {
		let $felem = $('.fullscreened');
		if ($felem.length < 1) return;

		$felem[0].style.transform = "";
		//$felem[0].style.left = ""
		//$felem[0].style.top = ""

		$felem.removeClass('fullscreened');
		$('.fscr-parent').removeClass('fscr-parent')
	}

	static _domExit() {
		if (document.fullscreenElement) document.exitFullscreen();
	}

	static _fullscreenElem(el) {
		this._exitFullscr();

		let $el = $(el);
		$el.addClass('fullscreened');
		$el.parents().each((i, el) => {
			//if (el == document.documentElement) return;
			//if (el == document.body) return;

			$(el).addClass('fscr-parent');
		});
		
		let rect = el.getBoundingClientRect();
		$el[0].style.transform = `translate(${-rect.x}px, ${-rect.y}px)`;
		//$el[0].style.left = `${-rect.x}px`;
		//$el[0].style.top = `${-rect.y}px`
	}
}