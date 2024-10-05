import { ContextMenu } from './context_menu.mjs';
import { TaskbarButton } from './taskbar.mjs';
import { Reactor, ReactorEvent } from '../events.mjs';
import { InternalFault, IllegalStateFault } from '../faults.mjs';
import { App } from '../app.mjs';
import Util from '../util.mjs';
import Arrays from '../utils/arrays.mjs';

export enum CloseBehavior {
	NOTHING,
	HIDE_WINDOW,
	DISPOSE_WINDOW,
	EXIT_APP
}

export enum InitialPosition {
	DEFAULT, CENTER
}

export default class Window {
	app: App;
	children: Window[];
	icon: string;
	maximized: boolean;
	minimized: boolean;
	posX: number;
	posY: number;
	restoreBounds: number[];
	events: Reactor;
	optionsCtxMenu: ContextMenu;
	zIndex: number;
	$window: $Element;
	private owner: Window;
	private closeBehavior: CloseBehavior;
	private initialPosition: InitialPosition;
	private visible: boolean;
	private title: string;
	private decorated: boolean;
	private width: number;
	private height: number;
	private minWidth: number;
	private minHeight: number;
	private destroyed: boolean;
	private firstShow: boolean;
	private taskButton: TaskbarButton;
	private $windowHeader: $Element;
	private $windowButton: $Element;
	private $windowTitle: $Element;
	
	constructor(app: App) {
		if (!app) throw new InternalFault("Windows must have valid owner apps.");

		this.app = app;

		this.owner = null;
		this.children = [];
		this.icon = '';

		// If the owner app has no main window yet, this will be its main window
		if (app.mainWindow === undefined) app.mainWindow = this;

		this.visible = false;
		this.maximized = false;
		this.title = 'Window';
		
		this.firstShow = true;
		this.posX  = 8, this.posY = 8;
		this.width = 0, this.height = 0;
		this.minWidth = 130;
		this.minHeight = 30;
		this.restoreBounds = [8, 8, 600, 400];

		this.events = new Reactor();
		this.events.register('closing', 'closed', 'backnav', 'resize', 'closereq');

		this.closeBehavior = CloseBehavior.DISPOSE_WINDOW;
		this.initialPosition = InitialPosition.DEFAULT;

		if (app.icon && app.mainWindow == this) {
			this.icon = app.icon;	
		}

		this.$window = null;
	}

	_dispose() {
		if (this.destroyed) return;	
		this.destroyed = true;

		// If this is the app main window, save its state
		if (this.app.mainWindow == this) {
			this.saveState();
		}	

		for (let child of this.children) {
			Client.desktop.destroyWindow(child);
		}

		// Optimization: Nullify all sources of media this window contained.
		// This cancels the fetch of any resources this window could make
		this.$window.find("img").attr("src", "");
		this.$window.find("source").attr("src", "");
		this.$window.find("video").attr("src", "");
		this.$window.remove();
		this.$window = null;

		// Remove taskbar button
		if (!this.taskButton) return;
		this.taskButton.removeWindow(this);
		this.taskButton = null;
	}

	init() {
		if (this.$window) throw new IllegalStateFault('Double initialization of window object.');

		// Instantiation
		let $win = $(Util.cloneTemplate('window')).find('.window');
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
					threshold: 20
				}],
			]
		});
		hammer.on('swipeleft', () => {
			this.dispatch('backnav');
		});

		this.$window.on("mousedown", () => this.focus());
		this.$window.on("touchstart", () => this.focus());
		this.$window.on("focusin", () => this.focus());

		$win.find('.close-btn').click(() => {
			let closingEv = new ReactorEvent();
			this.dispatch('closing', closingEv);
		});

		this.events.default('closing', (ev) => {
			if (ev && ev.canceled) return;
	
			switch (this.closeBehavior) {
			case CloseBehavior.EXIT_APP:
				this.app.exit();
				break;
			case CloseBehavior.DISPOSE_WINDOW:
				Client.desktop.destroyWindow(this);
				break;
			case CloseBehavior.HIDE_WINDOW:
				this.setVisible(false);
				break;
			}
		});

		$win.find('.minimize-btn').click(() => this.minimize());
		$win.find('.maxrestore-btn').click(() => {
			if (this.maximized) this.restore();
			else this.setMaximized(true)
		});
		$win.find('.options-btn').click((ev: MouseEvent) => {
			Client.desktop.openCtxMenuAt(this.optionsCtxMenu, ev.clientX, ev.clientY);
		});
		Client.desktop.addCtxMenuOn(this.$windowHeader, () => this.optionsCtxMenu)
		this.$windowTitle.dblclick(() => this.setMaximized(!this.maximized));
		this.initDragListeners();

		// Styling
		if (this.icon) this.setIcon(this.icon);
		this.setDecorated(true);
		
		this.initPosition();
	}

	// Determine initial window position
	initPosition() {
		if (this.app.mainWindow === this) {
			this.restoreState();
		}
		
		// Reposition the window so that it doesn't stay directly on top of any other window
		Client.desktop.realignWindow(this);

		// Apply position and size on CSS
		this.setStyledSize(this.width, this.height);
		
		this.bringToFront();
	}

	async doFirstShowSetup() {
		this.firstShow = false;
		this.taskButton = Client.desktop.taskbar.addWindow(this);

		// If no width or height has been set, pack by default
		if (!this.width || !this.height) {
			await this.pack();
		}

		// If dimensions are still way too small, set them to a default reasonable amount
		if (this.width < 128 || this.height < 128) {
			let size = Client.desktop.getDefaultWindowSize();
			this.setSize(size[0], size[1]);
		}

		if (this.initialPosition == InitialPosition.CENTER) {
			this.bringToCenter();
		}
	}

	initDragListeners() {
		let dragging = false;
		let startX, startY;
		let startMX, startMY;

		let dragStart = (mx, my) => {
			dragging = true;

			startMX = mx,        startMY = my;
			startX  = this.posX, startY  = this.posY;
			Client.desktop.setPointerEvents(false);
		};

		let dragMove = (mx, my) => {
			if (!dragging) return;

			let dx = mx - startMX;
			let dy = my - startMY;

			if (this.maximized) {
				if (dy > 8) {
					let wb = this.restoreBounds;
					let nx = mx - wb[2] * startMX / this.width;
					let ny = my - wb[3] * startMY / this.height;
					
					this.restoreBounds[0] = nx;
					this.restoreBounds[1] = ny;
					this.restore();

					startX  = nx, startY  = ny;
					startMX = mx, startMY = my;
				}
				return;
			}

			if (Client.config.preferences.show_dragged_window_contents) {
				this.setPosition(startX + dx, startY + dy);
			} else {
				Client.desktop.setDragRectangle(startX + dx, startY + dy, this.width, this.height);
			}
		};

		let dragEnd = (mx: number, my: number) => {
			if (!dragging) return;

			dragging = false;
			this.setPosition(startX + mx - startMX, startY + my - startMY);
			Client.desktop.setPointerEvents(true);
			Client.desktop.setDragRectangle(null);
		};

		let $doc = $(document);
		let $wh = this.$windowHeader;

		let $title = this.$windowTitle;
		$title.on("mousedown", (e: MouseEvent) => {
			dragStart(e.pageX, e.pageY);
		});
		$title.on("touchstart", (e: TouchEvent) => {
			let mx = e.changedTouches[0].pageX;
			let my = e.changedTouches[0].pageY;
			dragStart(mx, my);
		});
		
		$doc.on("mousemove", (e: MouseEvent) => {
			dragMove(e.pageX, e.pageY);
		});
		$doc.on("touchmove", (e: TouchEvent) => {
			let mx = e.changedTouches[0].pageX;
			let my = e.changedTouches[0].pageY;
			dragMove(mx, my);
		});

		$doc.on("mouseup", (ev: MouseEvent) => {
			dragEnd(ev.pageX, ev.pageY);
		});
		$doc.on("touchend", (ev: TouchEvent) => {
			let mx = ev.changedTouches[0].pageX;
			let my = ev.changedTouches[0].pageY;
			dragEnd(mx, my);
		});
	}

	makeOptionsCtxMenu(): ContextMenu {
		return ContextMenu.fromDefinition([
			['-Fullscreen', () => this.goFullscreen()],
			['-Maximize', () => this.setMaximized(true)],
			['-Minimize', () => this.minimize()],
			['-Restore', () => this.restore()],
			['-Refit', () => this.refit()],
			['|'],
			['-Close', () => this.dispatch('closing', new ReactorEvent())]
		]);
	}

	setOwner(window: Window) {
		if (this.owner) {
			Arrays.erase(this.owner.children, this);
		}
		
		if (window) window.children.push(this);
		this.owner = window;
	}

	// Requests this window to close. This invokes the closing event on the window.
	close() {
		this.events.dispatch('closing', new ReactorEvent());
	}

	/**
	* Queries the window for the size it would be, had its contents been layed out naturally.
	* @returns A tuple of width/height dimensions.
	 */
	async getPackedDimensions(): Promise<[number, number]> {
		// Remove any hard with/height properties
		this.$window.css('width', '');
		this.$window.css('height', '');

		// If the window isn't visible, insert it into the layout but don't display its contents.
		if (!this.visible) {
			this.$window.css('visibility', 'hidden');
			this.$window.css('display', 'flex');
		}

		// Wait an engine cycle to update the layout
		await Util.sleep(0);

		// Get computed dimensions and compensate 2px for borders		
		let pw = this.$window.width() + 2;
		let ph = this.$window.height() + 2;

		// If the window is invisible, restore its old status
		if (!this.visible) {
			this.$window.css('display', '');
			this.$window.css('visibility', '');
		}

		return [pw, ph];
	}

	/** Resizes this window to fit its content naturally */
	async pack() {
		let [packWidth, packHeight] = await this.getPackedDimensions();
		
		// Do not let the window get bigger than the desktop area
		let [dtWidth, dtHeight] = Client.desktop.getWindowingArea();
		let finalWidth = Math.min(packWidth, dtWidth);
		let finalHeight = Math.min(packHeight, dtHeight);

		this.setSize(finalWidth, finalHeight);
	}

	saveState() {
		let state;
		if (this.maximized) {
			state = [this.maximized, this.restoreBounds];
		} else {
			state = [this.maximized, this.getBounds()];
		}

		let regName = 'app.' + this.app.classId + '.winstate';
		localStorage.setItem(regName, JSON.stringify(state));
	}

	restoreState() {
		let regName = 'app.' + this.app.classId + '.winstate';
		let item = localStorage.getItem(regName);
		if (!item) return false;

		let state = JSON.parse(item);
		if (!state) return false;

		this.setBounds(state[1]);
		this.setMaximized(state[0]);
		return true;
	}

	setCloseBehavior(action: CloseBehavior) {
		this.closeBehavior = action;
	}

	setInitialPosition(position) {
		this.initialPosition = position;
	}

	setTitle(title: string) {
		this.title = title;
		this.$windowTitle.text(title);
		if (this.taskButton && this.taskButton.single) this.taskButton.setText(title);
	}

	getTitle(): string {
		return this.title;
	}

	setPosition(x, y) {
		if (!isFinite(x) || !isFinite(y)) return;
		if (y < 0) y = 0;

		// If the window is maximized, these changes will be applied to
		// the restoreBounds of the window
		if (this.maximized) {
			this.restoreBounds[0] = x;
			this.restoreBounds[1] = y;
			return;
		}

		this.posX = x;
		this.posY = y;

		this.setStyledPosition(x, y);
	}

	setStyledPosition(x, y) {
		if (!this.$window) return;

		// Don't allow window on fractional pixel (reduces blurring)
		x = Math.trunc(x);
		y = Math.trunc(y);

		this.$window[0].style.transform = `translate(${x}px, ${y}px)`;
	}

	setSize(w: number, h: number) {
		if (!isFinite(w) || !isFinite(h)) return;

		if (w < this.minWidth) w = this.minWidth;
		if (h < this.minHeight) h = this.minHeight;

		// If the window is maximized, these changes will be applied to
		// the restoreBounds of the window
		if (this.maximized) {
			this.restoreBounds[2] = w;
			this.restoreBounds[3] = h;
			return;
		}

		this.width = w;
		this.height = h;

		this.setStyledSize(w, h);
		this.dispatch('resize');
	}

	setStyledSize(w, h) {
		if (!this.$window) return;

		this.$window[0].style.width = w + "px";
		this.$window[0].style.height = h + "px";
	}

	setBounds(x: number[] | number, y?: number, w?: number, h?: number) {
		if (Array.isArray(x)) {
			this.setPosition(x[0], x[1]);
			this.setSize(x[2], x[3]);	
		} else {
			this.setPosition(x, y);
			this.setSize(w, h);
		}
	}

	getBounds() {
		return [this.posX, this.posY, this.width, this.height];
	}

	async setVisible(visible: boolean) {
		if (visible) {
			if (this.firstShow) {
				await this.doFirstShowSetup();
			}

			this.$window.addClass('visible');			
		} else {
			this.$window.removeClass('visible');
		}

		this.visible = visible;
	}

	setIcon(icon: string) {
		this.icon = icon;
		this.$window.find('.options-btn').css('background-image', `url('${icon}')`);
		if (this.taskButton) {
			this.taskButton.$button.find("img").src = icon;
		}
	}

	setDecorated(decorated: boolean) {
		this.decorated = decorated;
		if (decorated) {
			this.$window.addClass('decorated');
		} else {
			this.$window.removeClass('decorated');
		}
	}

	setPointerEvents(val: boolean) {
		this.$window.css('pointer-events', (val) ? '' : 'none');
	}

	isPointInside(x: number, y: number) {
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

	goFullscreen() {
		if (this.minimized) this.restore();

		import('./fullscreen.mjs').then(M => {
			M.default.on(this.$window.find('.window-body')[0]);
		});
	}

	setMaximized(max: boolean) {
		if (this.maximized == max) return;

		if (max) {
			this.restoreBounds = this.getBounds();

			let rect = Client.desktop.getWindowingArea();
			this.setPosition(0, 0);
			this.setSize(rect[0], rect[1]);
			this.maximized = true;

			this.$window.addClass('maximized');
		} else {
			this.maximized = false;
			this.setBounds(this.restoreBounds);

			this.$window.removeClass('maximized');
		}
	}

	restore() {
		if (this.minimized) {
			this.setVisible(true);
			this.minimized = false;
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
	
	refit() {
		if (this.maximized) return;

		let [scrWidth, scrHeight] = Client.desktop.getWindowingArea();

		let width = this.width;
		let height = this.height;
		let x = this.posX;
		let y = this.posY;

		if (width > scrWidth) {
			width = scrWidth - 32;
		}
		if (height > scrHeight) {
			height = scrHeight - 32;
		}

		if (x < 0 || x + width > scrWidth) {
			x = (scrWidth - width) / 2;
		}
		if (y < 0 || y + height > scrHeight) {
			y = (scrHeight - height) / 2;
		}

		this.setBounds(x, y, width, height);
	}

	async setContentToUrl(url: string) {
		let fRes = await fetch(url);
		this.$window.find('.window-body').html(await fRes.text());
	}

	on(evClass: string, callback: unknown) {
		this.events.on(evClass, callback);
	}

	off(evClass: string, callback: unknown) {
		this.events.off(evClass, callback);
	}

	dispatch(evClass: string, args?: any) {
		this.events.dispatch(evClass, args);
	}
}
