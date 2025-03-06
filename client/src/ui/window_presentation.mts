import { ClientClass } from "../client_core.mjs";
import Window from "./window.mjs";

export enum RenderingMode {
	/** Uses left/top positioning. May trigger layouts shifts and repaints, but saves the most memory. */
	ABSOLUTE,
	
	/** Uses transform: translate(x, y). May trigger repaint but avoids layout shifts. This option
	 * also conserves memory very well. */
	TRANSLATE,
	
	/** Uses transform: translate(x, y) with will-change hint. This will hint the browser to create
	 a separate stacking and painting layer for every window. This will use more memory, but is best
	 for performance. */
	TRANSLATE_HINTED,
	
	/** Uses transform: translate3d(x, y, 0) with will-change hint. Similar to TRANSLATE_HINTED, but
	 * will force the browser to use separate layers on platforms that ignore the hint. */
	TRANSLATE_HINTED_FORCED	  
}

export class WindowPresentation {
	public readonly window: Window;
	private zIndex: number;
	private $window: $Element;
	private renderingMode: RenderingMode;
	$windowTitle: $Element;

	constructor(window: Window) {
		this.window = window;
		this.renderingMode = RenderingMode.ABSOLUTE;

		let renderingMode = ClientClass.get().config.preferences.window_rendering_mode;
		let renderingModes = {
			'absolute': RenderingMode.ABSOLUTE,
			'translate': RenderingMode.TRANSLATE,
			'translate_hinted': RenderingMode.TRANSLATE_HINTED,
			'translate_hinted_forced': RenderingMode.TRANSLATE_HINTED_FORCED
		}

		let mode = renderingModes[renderingMode];
		if (mode)
			this.renderingMode = mode;

		let $win = window.$window;
		this.$window = $win;
		this.$windowTitle = $win.find('.window-title');
		this.setRenderingMode(this.renderingMode);
	}

	setRenderingMode(mode: RenderingMode) {
		this.renderingMode = mode;
		let hint = [RenderingMode.TRANSLATE_HINTED, RenderingMode.TRANSLATE_HINTED_FORCED].includes(mode);
		this.$window.css('will-change', hint ? 'transform' : '');
	}

	setTitle(title: string) {
		this.$windowTitle.text(title);
	}

	setPosition(x: number, y: number) {
		// Don't allow window on fractional pixel (reduces blurring)
		x = Math.trunc(x);
		y = Math.trunc(y);

		if (this.renderingMode == RenderingMode.ABSOLUTE) {
			// Transform positioning trough left/top. This will probably cause layout shifts and repaints.
			this.$window[0].style.left = `${x}px`;
			this.$window[0].style.top = `${y}px`;
		} else if (this.renderingMode == RenderingMode.TRANSLATE_HINTED_FORCED) {
			// Position using 3d translation. This will force the browser to use separate layers on
			// platforms that ignore the hint.
			this.$window[0].style.transform = `translate3d(${x}px, ${y}px, 0)`;	
		} else {
			// Position using gpu translation. This might still cause repaints on unrelated elements.
			// However, when paired with will-change, this behaves the best on most platforms.
			this.$window[0].style.transform = `translate(${x}px, ${y}px)`;
		}
	}

	setSize(width: number, height: number) {
		let style = this.$window[0].style;
		style.width = width + "px";
		style.height = height + "px";
	}

	setZ(z: number) {
		if (z == this.zIndex) return;

		this.zIndex = z;
		this.$window.css('z-index', z);
	}
}