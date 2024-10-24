import { IllegalStateFault } from "../faults.mjs";
import Arrays from "../utils/arrays.mjs";
import Desktop from "./desktop.mjs";
import Window, { DisplayState } from "./window.mjs";

interface MotionConfiguration {
	down: [HTMLElement, (ev: MouseEvent | TouchEvent, x: number, y: number) => void];
	move: [HTMLElement, (ev: MouseEvent | TouchEvent, x: number, y: number) => void];
	up:   [HTMLElement, (ev: MouseEvent | TouchEvent, x: number, y: number) => void];
}

export class WindowManager {
	private desktop: Desktop;
	private windows: Window[];
	private $desktop: $Element;
	private resizingWindow: Window;

	constructor(desktop: Desktop) {
		this.desktop = desktop;
		this.windows = [];
		this.$desktop = desktop.$desktop;
		this.initResizeHandlers();
	}

	public addWindow(win: Window) {
		this.windows.push(win);
		win.on('init', () => {
			this.hookDragHandlers(win);	
		});
	}

	public removeWindow(win: Window): boolean {
		return Arrays.erase(this.windows, win) >= 0;
	}

	public getWindows(): readonly Window[] {
		return this.windows;
	}

	/**
	 * Bring a window to the front of the display.
	 */
	public bringToFront(win: Window): void {
		let index = this.windows.indexOf(win);
		if (index < 0) throw new IllegalStateFault("Can't bring a non-existent window to front.");

		this.windows.push(this.windows.splice(index, 1)[0]);
		this.restack();
	}

	/**
	 * Sets windows' z-index to match the windows array.
	 **/ 
	private restack() {
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

	private hookDragHandlers(win: Window) {
		let dragging = false;
		let startX:  number, startY:  number;
		let startMX: number, startMY: number;

		const dragStart = (mx: number, my: number) => {
			dragging = true;

			startMX = mx,       startMY = my;
			[startX, startY] = win.getPosition();
			Client.desktop.setPointerEvents(false);
		};

		const dragMove = (mx: number, my: number) => {
			if (!dragging) return;

			const [, , winWidth, winHeight, ] = win.getBounds();

			let dx = mx - startMX;
			let dy = my - startMY;

			if (win.maximized) {
				if (dy > 8) {
					let wb = win.getRestoredBounds();
					let nx = mx - wb[2] * startMX / winWidth;
					let ny = my - wb[3] * startMY / winHeight
					win.restore();
					win.setPosition(nx, ny);

					startX  = nx, startY  = ny;
					startMX = mx, startMY = my;
				}
				return;
			}

			if (Client.config.preferences.show_dragged_window_contents) {
				win.setPosition(startX + dx, startY + dy);
			} else {
				Client.desktop.setDragRectangle(startX + dx, startY + dy, winWidth, winHeight);
			}
		};

		const dragEnd = (mx: number, my: number) => {
			if (!dragging) return;

			dragging = false;
			win.setPosition(startX + mx - startMX, startY + my - startMY);
			Client.desktop.setPointerEvents(true);
			Client.desktop.setDragRectangle(null);
		};

		// :: Hook down-move-up events for both mouse and touch
		const $doc = $(document);
		const $title = win.$window.find('.window-title');
		this.addMotionListeners({
			down: [$title[0], (_, mx, my) => dragStart(mx, my)],
			move: [$doc[0],   (_, mx, my) => dragMove(mx, my)],
			up:   [$doc[0],   (_, mx, my) => dragEnd(mx, my)]
		});
	}

	private initResizeHandlers() {
		let bounds: number[];
		let dragDirection: [number, number];
		let initialBounds: number[];
		let initialMX: number, initialMY: number;

		let dragStart = (mx: number, my: number, ev: Event) => {
			let [win, dir] = this.findWindowToResize(mx, my);
			if (!win) return;

			// This window will be resized. Save initial state.
			this.resizingWindow = win;
			initialMX = mx, initialMY = my;
			initialBounds = win.getBounds();
			dragDirection = dir;
			Client.desktop.setPointerEvents(false);
			ev.stopPropagation();
		}

		let dragMove = (mx: number, my: number) => {
			if (this.resizingWindow) {
				doResize(mx, my);
				return;
			}

			// Show drag cursor
			let [, dir] = this.findWindowToResize(mx, my);
			this.desktop.setCursor((dir) ? this.getDirectionCursor(dir) : null);
		};

		let doResize = (mx: number, my: number) => {
			if (!dragDirection) return;

			let [minWidth, minHeight] = this.resizingWindow.getMinSize();
			let dx = mx - initialMX;
			let dy = my - initialMY;

			let [wx, wy, ww, wh] = initialBounds;

			ww += dx * dragDirection[0];
			wh += dy * dragDirection[1];

			if (ww < minWidth) {
				dx -= minWidth - ww;
				ww = minWidth;
			}

			if (wh < minHeight) {
				dy -= minHeight - wh;
				wh = minHeight;
			}

			if (dragDirection[0] < 0) { wx += dx; }
			if (dragDirection[1] < 0) { wy += dy; }

			bounds = [wx, wy, ww, wh];

			if (Client.config.preferences.show_dragged_window_contents) {
				this.resizingWindow.setBounds(bounds);
			} else {
				this.desktop.setDragRectangle(wx, wy, ww, wh);
			}
		};

		let dragEnd = (mx: number, my: number) => {
			if (!this.resizingWindow) return;

			doResize(mx, my);
			this.resizingWindow.setBounds(bounds);
			this.resizingWindow = null;
			this.desktop.setDragRectangle(null);
			Client.desktop.setPointerEvents(true);
		};

		// :: Hook down-move-up events for both mouse and touch
		// This section uses HTMLElement instead of $Element because only addEventListener()
		// accepts specifying bubbling/capturing modes
		const $desk = this.$desktop[0];
		this.addMotionListeners({
			down: [$desk, (ev, mx, my) => dragStart(mx, my, ev)],
			move: [$desk, (_,  mx, my) => dragMove(mx, my)],
			up:   [$desk, (_,  mx, my) => dragEnd(mx, my)]
		});
	}

	private findWindowToResize(mx: number, my: number): [Window, [number, number]] | [] {
		for(let win of this.windows.slice().reverse()) {
			// See if the cursor is pointing at any of the resizing borders of the window
			let dragDir = this.getResizeDirection(win, mx, my);
			
			if (!dragDir) {
				// If the cursor landed right inside the window, stop looking further.
				if (win.isPointInside(mx, my)) return [];
				
				// Otherwise, keep looking for windows
				continue;
			}

			// Maximized windows can't be resized by their borders.
			if (win.maximized) return [];

			// This window will be the one resized.
			return [win, dragDir];
		}

		return [];
	}

	private addMotionListeners(mc: MotionConfiguration) {
		mc.down[0].addEventListener("mousedown", (ev) => {
			mc.down[1](ev, ev.pageX, ev.pageY);
		}, true);
		mc.down[0].addEventListener("touchstart", (ev) => {
			mc.down[1](ev, ev.changedTouches[0].pageX, ev.changedTouches[0].pageY);
		}, true);

		mc.move[0].addEventListener("mousemove", (ev) => {
			mc.move[1](ev, ev.pageX, ev.pageY);
		});
		mc.move[0].addEventListener("touchmove", (ev) => {
			mc.move[1](ev, ev.changedTouches[0].pageX, ev.changedTouches[0].pageY);
		});

		mc.up[0].addEventListener("mouseup", (ev) => {
			mc.up[1](ev, ev.pageX, ev.pageY);
		});
		mc.up[0].addEventListener("touchend", (ev) => {
			mc.up[1](ev, ev.changedTouches[0].pageX, ev.changedTouches[0].pageY);
		});
	}

	private getDirectionCursor(dir: [number, number]): string {
		let [h, v] = dir;
		if (h == 0) return "ns-resize";
		if (v == 0) return "ew-resize";
		if (h == v) return "nwse-resize";
		if (h != v) return "nesw-resize";
		return "initial";
	}

	private getResizeDirection(win: Window, mx: number, my: number): [number, number] {
		// Only valid restored decorated windows can be resized.
		if (!win
			|| win.getDisplayState() != DisplayState.NORMAL
			|| !win.isDecorated()) return null;

		const im = 4;  // Inside margin
		const om = 8;  // Outside margin

		// Calculate deltas 
		let [ wx, wy, ww, wh ] = win.getBounds();
		let dx = mx - wx, dy = my - wy;
		let dw = dx - ww, dh = dy - wh;

		// If the mouse is outside the window + outside border, leave.
		if (dx < -om || dw > om ||
			dy < -om || dh > om) return null;

		// Left or Right edge
		let h = 0, v = 0;
		if (dx <=  im) h = -1;
		if (dw >= -im) h = 1;
		
		// Up or Bottom edge
		if (dy <=  im) v = -1;	 
		if (dh >= -im) v = 1;

		if (h == 0 && v == 0) return null;
		return [h, v]
	};
}