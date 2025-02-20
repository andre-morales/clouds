var staticInit = false;
var stylesheet: CSSStyleSheet;

enum SliderAxis {
	HORIZONTAL, VERTICAL
}

export class UISlider extends HTMLElement {
	#impl: UISliderController;

	constructor() {
		super();

		if (!staticInit) {
			doStaticInitialization();
		}

		this.#impl = new UISliderController(this);
	}

	private connectedCallback() {
		this.#impl.onConnect();
	}

	addUnderTrack() {
		let track = this.#impl.createTrack();
		track.root.prependTo(this.#impl.$container);
		return track;
	}

	addOverTrack() {
		let track = this.#impl.createTrack();
		track.root.insertBefore(this.#impl.$thumb);
		return track;
	}

	get trackContainer() {
		return this.#impl.$container;
	}

	get value() {
		return this.#impl.value;
	}

	set value(val) {
		if (isNaN(val)) val = 0;

		this.#impl.value = val;
		this.#impl.update();
	}
}

class UISliderController {
	slider: UISlider;
	axis: SliderAxis;
	reverse: boolean;
	min: number;
	max: number;
	value: number;

	anchorProp: string;
	sizeProp: string;

	shadow: ShadowRoot;
	$thumb: HTMLElement;
	$lower: HTMLElement;
	$container: HTMLElement;

	private getDimension: (e: any) => number;
	private getFrac: (v: number, rect: DOMRect) => number;

	constructor(slider: UISlider) {
		this.slider = slider;

		// Configure initial values
		this.value = Number(slider.getAttribute('value'));
		this.min = Number(slider.getAttribute('min'));
		this.max = Number(slider.getAttribute('max'));

		if (!this.min) this.min = 0;
		if (!this.max) this.max = 100;
		if (!this.value) this.value = 0;

		// Create shadow DOM
		this.shadow = slider.attachShadow({ mode: 'open' });
		this.initStyles();

		this.$container = document.createElement('div');
		this.$container.classList.add('root');
		this.shadow.append(this.$container);

		this.$lower = document.createElement('span');
		this.$lower.classList.add('track');
		this.$lower.classList.add('lower');
		this.$container.append(this.$lower);

		this.$thumb = document.createElement('span');
		this.$thumb.classList.add('thumb');
		this.$container.append(this.$thumb);

		// Configure slider direction
		let reverse = slider.hasAttribute('reverse');
		let axis = slider.hasAttribute('vertical') ? SliderAxis.VERTICAL : SliderAxis.HORIZONTAL;
		this.setDirection(axis, reverse);

		// Update thumb position when the thumb size changes as well
		new ResizeObserver(() => this.update()).observe(this.$thumb);
	}

	private initStyles() {
		attachStyles(this.shadow);
	}

	private setDirection(axis: SliderAxis, reverse: boolean) {
		this.axis = axis;
		this.reverse = reverse;

		const getDimensionX = (e) => e.pageX;
		const getDimensionY = (e) => e.pageY;

		const fracRectX  = (v, r) =>       (v - r.left) / r.width;
		const fracRectRX = (v, r) => 1.0 - (v - r.left) / r.width;
		const fracRectY  = (v, r) => 1.0 - (v - r.top) / r.height;
		const fracRectRY = (v, r) =>       (v - r.top) / r.height;

		if (axis == SliderAxis.VERTICAL) {
			this.sizeProp = 'height';
			this.anchorProp = reverse ? "top" : "bottom";

			this.getDimension = getDimensionY;
			this.getFrac = reverse ? fracRectRY : fracRectY;
			
			this.$container.classList.add('vertical');
		} else {
			this.sizeProp = 'width';
			this.anchorProp = reverse ? "right" : "left";

			this.getDimension = getDimensionX;
			this.getFrac = reverse ? fracRectRX : fracRectX;
			
			this.$container.classList.add('horizontal');
		}

		this.$lower.style[this.anchorProp] = 0;		
	}

	onConnect() {
		const valueChange = (coff: number) => {
			if (coff < 0) coff = 0;
			if (coff > 1) coff = 1;
			let val = this.min + (this.max - this.min) * coff;

			this.slider.value = val;
			$(this.slider).trigger('change');
		};

		const drag = (ev) => {
			let evObj = ev.changedTouches?.[0] ?? ev;
			let v = this.getDimension(evObj)

			let rect = this.$container.getBoundingClientRect();
			let f = this.getFrac(v, rect)
			return f;
		};

		// Event handling
		let held = false;
		
		$(document).on('mousemove touchmove', (ev) => {
			if(!held) return

			valueChange(drag(ev));	
		});
		
		this.$container.addEventListener('mousedown', (ev) => {
			held = true;
			valueChange(drag(ev));
		});
		this.$container.addEventListener('touchstart', (ev) => {
			held = true;
			valueChange(drag(ev));
		});

		this.$thumb.addEventListener('mousedown', () => held = true);
		this.$thumb.addEventListener('touchstart', () => held = true);

		$(document).on('mouseup touchend', (ev) => {
			if(!held) return;
			held = false;

			valueChange(drag(ev));
		});
	}

	createTrack() {
		let $track = $("<div class='track'>");
		let track = new SliderTrack(this, $track);
		return track;
	}

	update() {
		let thumbWidth = this.$thumb.getBoundingClientRect().width;

		let x = (this.value - this.min) / (this.max - this.min);

		let progress = `${x * 100}%`;
		let displacement = `calc(${x * 100}% - ${thumbWidth/2}px)`;

		this.$lower.style[this.sizeProp] = progress;
		this.$thumb.style[this.anchorProp] = displacement;
	}
}

export class SliderTrack {
	public readonly controller: UISliderController;
	private $root: $Element;

	constructor(controller: UISliderController, $root: $Element) {
		this.controller = controller;
		this.$root = $root;
	}

	setColor(color: string) {
		this.$root.css("--track-color", color);
	}

	addRange(begin: number, width: number) {
		let $segment = $('<div class="track-range">');
		let range = new SliderTrackRange(this, $segment);
		range.begin = begin;
		range.width = width;
		this.$root.append($segment);
		return range;
	}

	clearRanges() {
		this.$root.empty();
	}

	get root() {
		return this.$root;
	}
}

export class SliderTrackRange {
	private track: SliderTrack;
	private $range: $Element;

	constructor(track: SliderTrack, $range: $Element) {
		this.track = track;
		this.$range = $range;
	}

	set begin(val: number) {
		let anchor = this.track.controller.anchorProp;
		this.$range.css(anchor, `${val * 100}%`)
	}

	set width(val: number) {
		let size = this.track.controller.sizeProp;
		this.$range.css(size, `${val * 100}%`)
	}
}

function attachStyles(shadow: ShadowRoot) {
	if (shadow.adoptedStyleSheets) {
		if (!stylesheet) {
			stylesheet = new CSSStyleSheet();
			fetch('/res/css/slider.css')
				.then(res => res.text())
				.then(css => stylesheet.replace(css));
		}
		shadow.adoptedStyleSheets = [stylesheet];
	} else {
		const style = document.createElement('style');
		style.textContent = `@import url('/res/css/slider.css');`
		shadow.appendChild(style);
	}
}

async function doStaticInitialization() {

}
