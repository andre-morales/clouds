class Window {
	constructor(desktop) {
		this._desktop = desktop;
		this._ownerApp = null;
		this.$window = null;
		this.visible = false;
		this.maximized = false;
		this.title = 'Window';
		this.posX  = 8,   this.posY = 8;
		this.width = 600, this.height = 400;
		this.restoredBounds = [8, 8, 600, 400];
		this.onCloseRequest = () => { };
		this.backButton = () => {};
	}

	init() {
		if (this.$window) return;

		// Instantiation
		let win = $(cloneTemplate('window')).find('.window');
		this._desktop.$windows.append(win);

		// Queries
		this.$window = win;
		this.$windowHeader = win.find('.head');

		// Behavior
		let menu = this.makeOptionsMenu();
		this.optionsMenu = menu;
		win.find('.close-btn').click(() => this.onCloseRequest());
		win.find('.iconify-btn').click(() => this.minimize());
		win.find('.maximize-btn').click(() => {
			if (this.maximized) this.restore();
			else this.maximize()
		});
		win.find('.options-btn').click((ev) => {
			this._desktop.openContextMenuAt(menu, ev.clientX, ev.clientY);
		});
		this.setupDragListeners();

		// Styling
		this.setBoundsA(this._desktop.getDefaultWindowBounds());
		this.setPosition(this.posX, this.posY);
		this.setSize(this.width, this.height);
		this.setDecorated(true);
	}

	makeOptionsMenu() {
		return [
			['Fullscreen', () => this.makeFullscreen()],
			['Maximize', () => this.maximize()],
			['Minimize', () => this.minimize()],
			['Restore', () => this.restore()],
			'-',
			['Close', () => this.onCloseRequest()]
		];
	}

	setupDragListeners() {
		this.$window.on("mousedown", () => {
			if (!this._desktop.resizingWindow) this.focus();
		});
		
		let dragging = false;
		let startX, startY;
		let startMX, startMY;

		let dragStart = (mx, my) => {
			if (this.maximized) return;

			dragging = true;

			startMX = mx,        startMY = my;
			startX  = this.posX, startY  = this.posY;
		};

		let dragMove = (mx, my) => {
			if (!dragging) return;

			let px = startX + mx - startMX;
			let py = startY + my - startMY;
			this.setPosition(px, py);
		};

		let dragEnd = () => {
			dragging = false;
		};

		let $doc = $(document);
		let $wh = this.$windowHeader;

		$wh.on("mousedown", (e) => {
			dragStart(e.pageX, e.pageY);
		});
		$wh.on("touchstart", (e) => {
			let mx = e.changedTouches[0].pageX;
			let my = e.changedTouches[0].pageY;
			dragStart(mx, my);
		});

		
		$doc.on("mousemove", (e) => {
			dragMove(e.pageX, e.pageY);
		});
		$doc.on("touchmove", (e) => {
			let mx = e.changedTouches[0].pageX;
			let my = e.changedTouches[0].pageY;
			dragMove(mx, my);
		});

		$doc.on("mouseup", dragEnd);
		$doc.on("touchend", dragEnd);
	}

	dispose() {
		if (!this.$window) return;
		this.$window.remove();
		this.$window = null;
	}

	setTitle(title) {
		this.title = title;
		$(this.$window).find('.title').text(title);
	}

	setPosition(x, y) {
		if (y < 0) y = 0;
		this.posX = x;
		this.posY = y;

		if (this.$window) {
			this.$window[0].style.left = x + "px";
			this.$window[0].style.top = y + "px";
		}
	}

	setSize(w, h) {
		if (w < 100) w = 100;
		if (h < 24) h = 24;
		this.width = w;
		this.height = h;

		if (this.$window) {
			this.$window[0].style.width = this.width + "px";
			this.$window[0].style.height = this.height + "px";
		}
	}

	setHeight(h) {
		this.setSize(this.width, h);
	}

	setBoundsA(arr) {
		this.setPosition(arr[0], arr[1]);
		this.setSize(arr[2], arr[3]);
	}

	setVisible(visible) {
		this.visible = visible;
		if (visible) {
			this.$window.addClass('visible');
		} else {
			this.$window.removeClass('visible');
		}
	}

	setDecorated(decorated) {
		this.decorated = decorated;
		if (decorated) {
			this.$window.addClass('decorated');
		} else {
			this.$window.removeClass('decorated');
		}
	}

	getBoundsA() {
		return [this.posX, this.posY, this.width, this.height];
	}

	isPointInside(x, y) {
		return ((x >= this.posX)
			&& (x <= this.posX + this.width)
			&& (y >= this.posY)
			&& (y <= this.posY + this.height));
	}

	focus() {
		let fw = this._desktop.focusedWindow;
		if (fw && fw.$window) {
			fw.$window.removeClass('focused');
		}

		this._desktop.focusedWindow = this;
		this.$window.addClass('focused');

		this.bringToFront();
	}

	bringToFront() {
		this._desktop.bringWindowToFront(this);
	}

	bringToCenter() {
		let rect = this._desktop.$desktop[0].getBoundingClientRect();
		let x = (rect.width  - this.width) / 2;
		let y = (rect.height - this.height) / 2;
		this.setPosition(x, y);
	}

	maximize() {
		if (this.maximized) return;

		this.restoredBounds = this.getBoundsA();

		let rect = this._desktop.$desktop[0].getBoundingClientRect();
		this.setPosition(0, 0);
		this.setSize(rect.width, rect.height);

		this.maximized = true;
	}

	restore() {
		if (this.minimized) {
			let $task = this._desktop.iconifiedWindows.get(this);

			this.setVisible(true);
			this.minimized = false;
			$task.remove();
			
			delete this._desktop.iconifiedWindows[this];
			return;
		}

		if (this.maximized) {
			this.setBoundsA(this.restoredBounds);
			this.maximized = false;
		}
	}

	minimize() {
		if (this.minimized) return;

		let icon = this.icon;
		let title = this.title;
		if (!icon) icon = "/res/img/apps/window64.png";

		this.minimized = true;
		this.setVisible(false);

		let $task = $(`<div><img src=${icon}>${title}</div>`);
		$task.click(() => {
			this.restore();
		});	

		this._desktop.iconifiedWindows.set(this, $task);
		

		let menu = this.optionsMenu;

		this._desktop.addContextMenuOn($task, menu);
		this._desktop.$tasks.append($task);
	}

	close() {
		arrErase(this._desktop.windows, this);

		if (this.minimized) {
			this._desktop.iconifiedWindows.get(this).remove();
			this._desktop.iconifiedWindows.delete(this);
		}
		this.dispose();
	}

	makeFullscreen() {
		if (this.minimized) this.restore();

		this._desktop.makeElementFullscreen(this.$window.find('.body')[0]);
	}

	async setContentToUrl(url) {
		let fres = await fetch(url);
		this.$window.find('.body').html(await fres.text());
	}
}