import Window from "./window.mjs";

export class WindowPresentation {
	public readonly window: Window;
	private zIndex: number;
	private $window: $Element;
	$windowTitle: $Element;

	constructor(window: Window) {
		this.window = window;

		let $win = window.$window;
		this.$window = $win;
		this.$windowTitle = $win.find('.window-title');
	}

	setTitle(title: string) {
		this.$windowTitle.text(title);
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