import Window from "./window.mjs";

export class WindowPresentation {
	public readonly window: Window;
	private zIndex: number;
	private $window: $Element;

	constructor(window: Window) {
		this.window = window;
		this.$window = window.$window;
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