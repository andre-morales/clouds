import { ContextMenu } from './controls/context_menu/ctx_menu.mjs';
import { TaskbarButton } from './taskbar.mjs';
import { EventCallback, Reactor, ReactorEvent } from '../events.mjs';
import { InternalFault, IllegalStateFault } from '../faults.mjs';
import { App } from '../app.mjs';
import Browser from '../utils/browser.mjs';
import Utils from '../utils/utils.mjs';
import Arrays from '../../../common/arrays.mjs';
import { WindowPresentation } from './window_presentation.mjs';

enum LiveState {
	NIL, INIT, READY, DYING, DEAD
}

export enum CloseBehavior {
	NOTHING,
	HIDE_WINDOW,
	DISPOSE_WINDOW,
	EXIT_APP
}

export enum InitialPosition {
	DEFAULT, CENTER
}

export enum DisplayState {
	HIDDEN, MINIMIZED, NORMAL, MAXIMIZED
}

export default class Window {
	public readonly app: App;
	children: Window[];
	maximized: boolean;
	minimized: boolean;
	optionsCtxMenu: ContextMenu;
	private liveState: LiveState;
	private presentation: WindowPresentation;
	private events: Reactor;
	private owner: Window;
	private closeBehavior: CloseBehavior;
	private initialPosition: InitialPosition;
	private visible: boolean;
	private title: string;
	private decorated: boolean;
	private posX: number;
	private posY: number;
	private width: number;
	private height: number;
	private minWidth: number;
	private minHeight: number;
	private restoreBounds: number[];
	private firstShow: boolean;
	private taskButton: TaskbarButton;
	private icon: string;
	private $windowRoot: $Element;
	private $windowHeader: $Element;
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
		this.events.register('init', 'closing', 'closed', 'backnav', 'resize');

		this.closeBehavior = CloseBehavior.DISPOSE_WINDOW;
		this.initialPosition = InitialPosition.DEFAULT;

		if (app.icon && app.mainWindow == this) {
			this.icon = app.icon;	
		}

		this.$windowRoot = null;
	}

	_dispose() {
		if (this.liveState != LiveState.READY) throw new IllegalStateFault("Can't dispose a window that isn't ready.");	
		this.liveState = LiveState.DYING;

		// If this is the app main window, save its state
		if (this.app.mainWindow == this) {
			this.saveState();
		}	

		for (let child of this.children) {
			Client.desktop.destroyWindow(child);
		}

		// Optimization: Nullify all sources of media this window contained.
		// This cancels the fetch of any resources this window could make
		this.$windowRoot.find("img").attr("src", "");
		this.$windowRoot.find("source").attr("src", "");
		this.$windowRoot.find("video").attr("src", "");
		this.$windowRoot.remove();
		this.$windowRoot = null;

		// Remove taskbar button
		if (!this.taskButton) return;
		this.taskButton.removeWindow(this);
		this.taskButton = null;
		this.liveState = LiveState.DEAD;
	}

	init(): void {
		if (this.$windowRoot) throw new IllegalStateFault('Double initialization of window object.');

		this.liveState = LiveState.INIT;

		// Instantiation
		let $win = $(Browser.cloneTemplate('window')).find('.window');
		Client.desktop.$windows.append($win);

		// Queries
		this.$windowRoot = $win;
		this.$windowHeader = $win.find('.window-head');
		this.$windowTitle = $win.find('.window-title');

		// Initialize presentation
		this.presentation = new WindowPresentation(this);

		// Behavior
		this.optionsCtxMenu = this.makeOptionsCtxMenu();
		let hammer = new Hammer.Manager(this.$windowRoot.find('.window-body')[0], {
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

		this.$windowRoot.on("mousedown", () => this.focus());
		this.$windowRoot.on("touchstart", () => this.focus());
		this.$windowRoot.on("focusin", () => this.focus());

		$win.find('.close-btn').click(() => {
			let closingEv = new ReactorEvent();
			this.dispatch('closing', closingEv);
		});

		this.events.default('closing', (ev) => {
			if (ev?.isDefaultPrevented()) return;
	
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

		// Styling
		if (this.icon) this.setIcon(this.icon);
		this.setDecorated(true);
		
		this.initPosition();
		this.events.dispatch('init');
		this.liveState = LiveState.READY;
	}

	// Determine initial window position
	private initPosition() {
		if (this.app.mainWindow === this) {
			this.restoreState();
		}
		
		// Reposition the window so that it doesn't stay directly on top of any other window
		Client.desktop.realignWindow(this);

		// Apply position and size on CSS
		this.presentation.setSize(this.width, this.height);
		
		this.bringToFront();
	}

	private async doFirstShowSetup() {
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

	private makeOptionsCtxMenu(): ContextMenu {
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

	get $window() {
		return this.$windowRoot;
	}

	public getPresentation() {
		return this.presentation;
	}

	public setOwner(window: Window) {
		if (this.owner) {
			Arrays.erase(this.owner.children, this);
		}
		
		if (window) window.children.push(this);
		this.owner = window;
	}

	// Requests this window to close. This invokes the closing event on the window.
	public close() {
		this.events.dispatch('closing', new ReactorEvent());
	}

	/**
	* Queries the window for the size it would be, had its contents been layed out naturally.
	* @returns A tuple of width/height dimensions.
	 */
	public async getPackedDimensions(): Promise<[number, number]> {
		// Remove any hard with/height properties
		this.$windowRoot.css('width', '');
		this.$windowRoot.css('height', '');

		// If the window isn't visible, insert it into the layout but don't display its contents.
		if (!this.visible) {
			this.$windowRoot.css('visibility', 'hidden');
			this.$windowRoot.css('display', 'flex');
		}

		// Wait an engine cycle to update the layout
		await Utils.sleep(0);

		// Get computed dimensions and compensate 2px for borders		
		let pw = this.$windowRoot.width() + 2;
		let ph = this.$windowRoot.height() + 2;

		// If the window is invisible, restore its old status
		if (!this.visible) {
			this.$windowRoot.css('display', '');
			this.$windowRoot.css('visibility', '');
		}

		return [pw, ph];
	}

	/** Resizes this window to fit its content naturally */
	public async pack() {
		let [packWidth, packHeight] = await this.getPackedDimensions();
		
		// Do not let the window get bigger than the desktop area
		let [dtWidth, dtHeight] = Client.desktop.getWindowingArea();
		let finalWidth = Math.min(packWidth, dtWidth);
		let finalHeight = Math.min(packHeight, dtHeight);

		this.setSize(finalWidth, finalHeight);
	}

	public saveState() {
		let state;
		if (this.maximized) {
			state = [this.maximized, this.restoreBounds];
		} else {
			state = [this.maximized, this.getBounds()];
		}

		let regName = 'app.' + this.app.classId + '.winstate';
		localStorage.setItem(regName, JSON.stringify(state));
	}

	public restoreState() {
		let regName = 'app.' + this.app.classId + '.winstate';
		let item = localStorage.getItem(regName);
		if (!item) return false;

		let state = JSON.parse(item);
		if (!state) return false;

		this.setBounds(state[1]);
		this.setMaximized(state[0]);
		return true;
	}

	public setCloseBehavior(action: CloseBehavior) {
		this.closeBehavior = action;
	}

	public setInitialPosition(position: InitialPosition) {
		this.initialPosition = position;
	}

	public setTitle(title: string) {
		this.title = title;
		this.$windowTitle.text(title);
		if (this.taskButton && this.taskButton.single) this.taskButton.setText(title);
	}

	public getTitle(): string {
		return this.title;
	}

	public setPosition(x: number, y: number) {
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

	private setStyledPosition(x: number, y: number) {
		if (!this.$windowRoot) return;

		// Don't allow window on fractional pixel (reduces blurring)
		x = Math.trunc(x);
		y = Math.trunc(y);

		this.$windowRoot[0].style.transform = `translate(${x}px, ${y}px)`;
	}

	public getPosition(): [number, number] {
		return [this.posX, this.posY];
	}

	public setSize(w: number, h: number) {
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

		this.presentation.setSize(w, h);
		this.dispatch('resize');
	}

	public getMinSize(): [number, number] {
		return [this.minWidth, this.minHeight]
	}

	public setBounds(x: number[] | number, y?: number, w?: number, h?: number) {
		if (Array.isArray(x)) {
			this.setPosition(x[0], x[1]);
			this.setSize(x[2], x[3]);	
		} else {
			this.setPosition(x, y);
			this.setSize(w, h);
		}
	}

	public getBounds() {
		return [this.posX, this.posY, this.width, this.height];
	}

	public getRestoredBounds() : readonly number[]{
		return this.restoreBounds;
	}

	public async setVisible(visible: boolean) {
		if (visible && this.firstShow) {
			await this.doFirstShowSetup();
		}
		this.visible = visible;
		this.$windowRoot.toggleClass('visible', visible)
	}

	public setIcon(icon: string) {
		this.icon = icon;
		this.$windowRoot.find('.options-btn').css('background-image', `url('${icon}')`);
		if (this.taskButton) {
			this.taskButton.$button.find("img").src = icon;
		}
	}

	public getIcon() {
		return this.icon;
	}

	public setDecorated(decorated: boolean) {
		this.decorated = decorated;
		this.$windowRoot.toggleClass('decorated', decorated);
	}

	public isDecorated() {
		return this.decorated;
	}

	public setPointerEvents(val: boolean) {
		this.$windowRoot.css('pointer-events', (val) ? '' : 'none');
	}

	public isPointInside(x: number, y: number) {
		return ((x >= this.posX)
			&& (x <= this.posX + this.width)
			&& (y >= this.posY)
			&& (y <= this.posY + this.height));
	}

	public getLocalCoordinates(ev: MouseEvent): [number, number] {
		let coords = this.$windowRoot.offset()
		let x = ev.clientX - coords.left;
		let y = ev.clientY - coords.top;
		return [x, y]
	}

	public unfocus() {
		if (Client.desktop.focusedWindow != this) return;

		Client.desktop.focusedWindow = null;
		if (this.$windowRoot) this.$windowRoot.removeClass('focused');
	}

	public focus() {
		if (Client.desktop.focusedWindow) {
			Client.desktop.focusedWindow.unfocus();		
		}

		Client.desktop.focusedWindow = this;
		this.$windowRoot.addClass('focused');

		this.bringToFront();
	}

	public bringToFront() {
		Client.desktop.bringWindowToFront(this);
	}

	public bringToCenter() {
		let rect = Client.desktop.$desktop[0].getBoundingClientRect();
		let x = (rect.width  - this.width) / 2;
		let y = (rect.height - this.height) / 2;
		this.setPosition(x, y);
	}

	public goFullscreen() {
		if (this.minimized) this.restore();

		import('./fullscreen.mjs').then(M => {
			M.default.on(this.$windowRoot.find('.window-body')[0]);
		});
	}

	public setMaximized(max: boolean) {
		if (this.maximized == max) return;

		if (max) {
			this.restoreBounds = this.getBounds();

			let rect = Client.desktop.getWindowingArea();
			this.setPosition(0, 0);
			this.setSize(rect[0], rect[1]);
			this.maximized = true;
		} else {
			this.maximized = false;
			this.setBounds(this.restoreBounds);
		}
		this.$windowRoot.toggleClass('maximized', max);
	}

	public restore() {
		if (this.minimized) {
			this.setVisible(true);
			this.minimized = false;
			return;
		}

		if (this.maximized) {
			this.setMaximized(false);
		}
	}

	public minimize() {
		if (this.minimized) return;

		this.minimized = true;
		this.setVisible(false);
	}

	/**
	 * Queries the current display form of the window. This state always refers to the exact current
	 * way the window is being presented.
	 */
	public getDisplayState() {
		if (!this.visible) return DisplayState.HIDDEN;
		if (this.minimized) return DisplayState.MINIMIZED;
		if (this.maximized) return DisplayState.MAXIMIZED;
		return DisplayState.NORMAL;
	}

	public refit() {
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

	public async setContentToUrl(url: string) {
		let fRes = await fetch(url);
		this.$windowRoot.find('.window-body').html(await fRes.text());
	}

	public on(evClass: string, callback: EventCallback) {
		this.events.on(evClass, callback);
	}

	public off(evClass: string, callback: EventCallback) {
		this.events.off(evClass, callback);
	}

	public dispatch(evClass: string, ev?: ReactorEvent) {
		this.events.dispatch(evClass, ev);
	}
}
