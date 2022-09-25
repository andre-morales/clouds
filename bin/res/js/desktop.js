class Desktop {
	constructor(webSys) {
		this._sys = webSys;
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

		let bounds = this.$desktop[0].getBoundingClientRect();
		this.screenWidth = bounds.width;
		this.screenHeight = bounds.height;

		$('.taskbar .fullscreen-btn').click(() => {
			$('body')[0].requestFullscreen();
		});

		let menu = [
			["System Settings", () => {
				webSys.runApp('configs');
			}]
		]
		this.addContextMenuOn(this.$desktop, menu);

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
			let bounds = this.$desktop[0].getBoundingClientRect();
			this.screenWidth = bounds.width;
			this.screenHeight = bounds.height;

			for (let w of this.windows) {
				if (w.maximized) {
					w.setSize(this.screenWidth, this.screenHeight);
				}
			}
		});	

		let bg = getCookie('bg');
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
			this.focusedWindow.backButton();
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

	setBackground(url) {
		this.$desktop.css('background-image', 'url("' + url + '")');
	}

	addContextMenuOn(element, menu) {
		$(element).on('contextmenu', (ev) => {
			let mx = ev.clientX, my = ev.clientY;

			this.openContextMenuAt(menu, mx, my);
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

		if (y + mheight > this.screenHeight) y -= mheight;
		if (x + mwidth > this.screenWidth) x -= mwidth;

		$menu.css('left', x);
		$menu.css('top', y);
	}

	makeElementFullscreen(element) {
		element.requestFullscreen();
	}

	setCursor(cursor) {
		document.body.style.cursor = cursor;
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
				if (win.maximized) continue;

				dragDir = this._getResizeDirection(win, mx, my);

				if (dragDir) {
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
				if (win.maximized) continue;

				let dir = this._getResizeDirection(win, mx, my);
				if (dir) {
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

			let b = startB.slice();
			if (dragDir[0] < 0) { b[0] += dx; }
			if (dragDir[1] < 0) { b[1] += dy; }

			b[2] += dx * dragDir[0];
			b[3] += dy * dragDir[1];

			resWin.setBoundsA(b);
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

		let h = 0, v = 0;
		let m = 8;

		let dx = mx - w.posX,  dy = my - w.posY;
		let dw = dx - w.width, dh = dy - w.height;

		// If the mouse is outside the window + 8 pixel border
		if (dx < -8 || dw > 8 ||
			dy < -8 || dh > 8) return null;

		// Left or Right Edge
		if (dx <= 0) h = -1;	
		if (dw >= 0) h = 1;	 
		if (dy <= 0) v = -1;	 
		if (dh >= 0) v = 1;	 

		if (h == 0 && v == 0) return null;
		return [h, v]
	};
}