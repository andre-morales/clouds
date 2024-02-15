class Window {
	constructor(app) {
		if (!app) throw new InternalFault("Windows must have valid owner apps.");

		this.app = app;

		this.owner = null;
		this.children = [];
		
		this.visible = false;
		this.maximized = false;
		this.title = 'Window';
		this.icon = '';

		this.posX  = 8,   this.posY = 8;
		this.width = 600, this.height = 400;
		this.minWidth = 116;
		this.minHeight = 28;
		this.restoredBounds = [8, 8, 600, 400];

		this.events = new Reactor();
		this.events.register('closing', 'closed', 'backnav', 'resize', 'closereq');

		// None | Close | Exit
		this._defaultCloseAction = 'close';

		this.$window = null;
	}

	_dispose() {
		if (!this.$window) return;	
		
		// Optimization: Set src to null on every image this window contained,
		// this reinforces interruption of image fetches on the browser
		this.$window.find("img").attr("src", "");
		this.$window.find("source").attr("src", "");
		this.$window.find("video").attr("src", "");
		this.$window.remove();
		this.$window = null;
	}

	init() {
		if (this.$window) return;

		// Instantiation
		let $win = $(cloneTemplate('window')).find('.window');
		Client.desktop.$windows.append($win);
		this.optionsCtxMenu = this.makeOptionsCtxMenu();

		// Queries
		this.$window = $win;
		this.$windowHeader = $win.find('.window-head');
		this.$windowTitle = $win.find('.window-title');

		// Behavior
		let hammer = new Hammer.Manager(this.$window.find('.window-body')[0], {
			recognizers: [
				[Hammer.Swipe, {
					direction: Hammer.DIRECTION_LEFT,
					velocity: 0.4,
					treshold: 20
				}],
			]
		});
		hammer.on('swipeleft', () => {
			this.dispatch('backnav');
		});

		this.$window.on("mousedown", () => this.focus() );
		this.$window.on("touchstart", () => this.focus() );

		$win.find('.close-btn').click(() => {
			let closingev = new ReactorEvent();
			this.dispatch('closing', closingev);

			let event = new ReactorEvent();
			this.dispatch('closereq', event);
		});

		this.events.default('closing', (ev) => {
			if (ev && ev.canceled) return;
	
			switch (this._defaultCloseAction) {
			case 'exit':
				this.app.exit();
				break;
			case 'close':
				Client.desktop.destroyWindow(this);
				break;
			}
		});

		$win.find('.minimize-btn').click(() => this.minimize());
		$win.find('.maxrestore-btn').click(() => {
			if (this.maximized) this.restore();
			else this.setMaximized(true)
		});
		$win.find('.options-btn').click((ev) => {
			Client.desktop.openCtxMenuAt(this.optionsCtxMenu, ev.clientX, ev.clientY);
		});
		Client.desktop.addCtxMenuOn(this.$windowHeader, () => this.optionsCtxMenu)
		this.$windowTitle.parent().dblclick(() => this.setMaximized(!this.maximized));
		this.setupDragListeners();

		// Styling
		this.setBoundsA(Client.desktop.getDefaultWindowBounds());
		this.setDecorated(true);
		this.bringToFront();
	}

	// Requests this window to close. This invokes the closing event on the window.
	close() {
		this.events.dispatch('closing', new ReactorEvent());
	}

	setOwner(window) {
		if (this.owner) {
			arrErase(this.owner.children, this);
		}
		
		if (window) window.children.push(this);
		this.owner = window;
	}

	makeOptionsCtxMenu() {
		return CtxMenu([
			CtxItem('Fullscreen', () => this.makeFullscreen()),
			CtxItem('Maximize', () => this.setMaximized(true)),
			CtxItem('Minimize', () => this.minimize()),
			CtxItem('Restore', () => this.restore()),
			'-',
			CtxItem('Close', () => this.dispatch('closing'))
		]);
	}

	setupDragListeners() {
		let dragging = false;
		let startX, startY;
		let startMX, startMY;

		let dragStart = (mx, my) => {
			dragging = true;

			startMX = mx,        startMY = my;
			startX  = this.posX, startY  = this.posY;
		};

		let dragMove = (mx, my) => {
			if (!dragging) return;

			let dx = mx - startMX;
			let dy = my - startMY;

			if (this.maximized) {
				if (dy > 8) {
					let wb = this.restoredBounds;
					let nx = mx - wb[2] * startMX / this.width;
					let ny = my - wb[3] * startMY / this.height;
					
					this.restoredBounds[0] = nx;
					this.restoredBounds[1] = ny;
					this.restore();

					startX  = nx, startY  = ny;
					startMX = mx, startMY = my;
				}
				return;
			}

			this.setPosition(startX + dx, startY + dy);
		};

		let dragEnd = () => { dragging = false; };

		let $doc = $(document);
		let $wh = this.$windowHeader;

		let $titlebox = this.$window.find(".window-title-box");
		$titlebox.on("mousedown", (e) => {
			dragStart(e.pageX, e.pageY);
		});
		$titlebox.on("touchstart", (e) => {
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

	setDefaultCloseAction(action) {
		this._defaultCloseAction = action;
	}

	setTitle(title) {
		this.title = title;
		this.$windowTitle.text(title);
		if (this.$taskbarBtn) this.$taskbarBtn.find("span").text(title);
	}

	setPosition(x, y) {
		if (!isFinite(x) || !isFinite(y)) return;

		if (y < 0) y = 0;
		this.posX = x;
		this.posY = y;

		if (!this.$window) return;


	//	this.$window[0].style.left = `${x}px`;
	//	this.$window[0].style.top = `${y}px`;

		this.$window[0].style.transform = `translate(${x}px, ${y}px)`;
	}

	setSize(w, h) {
		if (!isFinite(w) || !isFinite(h)) return;

		if (w < this.minWidth) w = this.minWidth;
		if (h < this.minHeight) h = this.minHeight;

		if (this.width == w && this.height == h) return;

		this.width = w;
		this.height = h;

		if (this.$window) {
			this.$window[0].style.width = this.width + "px";
			this.$window[0].style.height = this.height + "px";

			this.dispatch('resize');
		}
	}

	setHeight(h) {
		this.setSize(this.width, h);
	}

	setBounds(x, y, w, h) {
		this.setPosition(x, y);
		this.setSize(w, h);
	}

	setBoundsA(arr) {
		this.setPosition(arr[0], arr[1]);
		this.setSize(arr[2], arr[3]);
	}

	setVisible(visible) {
		this.visible = visible;
		if (visible) {
			this.$window.addClass('visible');
			
			if (!this.$taskbarBtn) this.createTaskbarButton();
		} else {
			this.$window.removeClass('visible');
		}
	}

	setIcon(icon) {
		this.icon = icon;
		this.$window.find('.options-btn').css('background-image', `url('${icon}')`);
		if (this.$taskbarBtn) {
			this.$taskbarBtn.find("img").src = icon;
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

	unfocus() {
		if (Client.desktop.focusedWindow != this) return;

		Client.desktop.focusedWindow = null;
		if (this.$window) this.$window.removeClass('focused');
	}

	focus() {
		if (Client.desktop.focusedWindow) {
			Client.desktop.focusedWindow.unfocus();		
		}

		Client.desktop.focusedWindow = this;
		this.$window.addClass('focused');

		this.bringToFront();
	}

	bringToFront() {
		Client.desktop.bringWindowToFront(this);
	}

	bringToCenter() {
		let rect = Client.desktop.$desktop[0].getBoundingClientRect();
		let x = (rect.width  - this.width) / 2;
		let y = (rect.height - this.height) / 2;
		this.setPosition(x, y);
	}

	setMaximized(max) {
		if (this.maximized == max) return;
		this.maximized = max;

		if (max) {
			this.restoredBounds = this.getBoundsA();

			let rect = Client.desktop.$windows[0].getBoundingClientRect();
			this.setPosition(0, 0);
			this.setSize(rect.width, rect.height);

			this.$window.addClass('maximized');
			
		} else {
			this.setBoundsA(this.restoredBounds);
			this.$window.removeClass('maximized');
		}
	}

	restore() {
		if (this.minimized) {
			let $task = Client.desktop.iconifiedWindows.get(this);

			this.setVisible(true);
			this.minimized = false;
			//this.destroyTaskbarButton();
			return;
		}

		if (this.maximized) {
			this.setMaximized(false);
		}
	}

	minimize() {
		if (this.minimized) return;

		let icon = this.icon;
		let title = this.title;

		this.minimized = true;
		this.setVisible(false);
	}
	
	createTaskbarButton() {
		let icon = this.icon;
		if (!icon) icon = '/res/img/apps/window64.png';
		
		let $task = $(`<div><img src=${icon}><span>${this.title}</span></div>`);
		Client.desktop.addCtxMenuOn($task, () => this.optionsCtxMenu);
		$task.click(() => {
			if (this.minimized) {
				this.restore();
			}
			
			this.bringToFront();
			this.focus();
		});			
		
		this.$taskbarBtn = $task;
		Client.desktop.iconifiedWindows.set(this, $task);
		Client.desktop.$tasks.append($task);
	}

	destroyTaskbarButton() {
		if (!this.$taskbarBtn) return;
		
		this.$taskbarBtn.remove();
		delete Client.desktop.iconifiedWindows[this];
		this.$taskbarBtn = null;
	}

	makeFullscreen() {
		if (this.minimized) this.restore();

		Fullscreen.on(this.$window.find('.window-body')[0]);
	}

	async setContentToUrl(url) {
		let fres = await fetch(url);
		this.$window.find('.window-body').html(await fres.text());
	}

	on(evclass, callback) {
		this.events.on(evclass, callback);
	}

	off(evclass, callback) {
		this.events.off(evclass, callback);
	}

	dispatch(evclass, args) {
		this.events.dispatch(evclass, args);
	}
}