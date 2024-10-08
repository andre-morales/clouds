var staticInit = false;
var stylesheet;

export class UISlider extends HTMLElement {
	#value: number;
	#min: number;
	#max: number;
	#container: HTMLElement;
	#lower: HTMLElement;
	#thumb: HTMLElement;

	constructor() {
		super();

		if (!staticInit) {
			doStaticInitialization();
		}

		this.#value = Number(this.getAttribute('value'));
		this.#min = Number(this.getAttribute('min'));
		this.#max = Number(this.getAttribute('max'));
		if (!this.#value) this.#value = 0;
		if (!this.#min) this.#min = 0;
		if (!this.#max) this.#max = 100;

		// Create shadow DOM
		let shadow = this.attachShadow({ mode: 'open' });
		shadow.adoptedStyleSheets = [stylesheet];

		let container = document.createElement('div');
		container.classList.add('root');
		shadow.append(container);
		this.#container = container;

		let lower = document.createElement('span');
		lower.classList.add('track');
		lower.classList.add('lower');
		container.append(lower);
		this.#lower = lower;

		let thumb = document.createElement('span');
		thumb.classList.add('thumb');
		container.append(thumb);
		this.#thumb = thumb;
	}

	connectedCallback() {
		let valueChange = (coff) => {
			if (coff < 0) coff = 0;
			if (coff > 1) coff = 1;
			let val = this.#min + (this.#max - this.#min) * coff;

			this.value = val;

			$(this).trigger('change');
		};

		let dragX = (ev) => {
			let mx = ev.pageX;

			let touches = ev.changedTouches;
			if (touches && touches[0]) {
				mx = touches[0].pageX;
			}

			let rect = this.#container.getBoundingClientRect();
			return (mx - rect.left) / rect.width;
		};

		// Event handling
		let held = false;
		
		$(document).on('mousemove touchmove', (ev) => {
			if(!held) return

			valueChange(dragX(ev));	
		});
		
		this.#container.addEventListener('mousedown', (ev) => {
			held = true;
			valueChange(dragX(ev));
		});
		this.#container.addEventListener('touchstart', (ev) => {
			held = true;
			valueChange(dragX(ev));
		});

		this.#thumb.addEventListener('mousedown', () => held = true);
		this.#thumb.addEventListener('touchstart', () => held = true);

		$(document).on('mouseup touchend', (ev) => {
			if(!held) return;
			held = false;

			valueChange(dragX(ev));
		});
	}

	private createTrack() {
		let $track = $("<div class='track'>");
		let track = new SliderTrack($track);
		return track;
	}

	addUnderTrack() {
		let track = this.createTrack();
		track.root.prependTo(this.#container);
		return track;
	}

	addOverTrack() {
		let track = this.createTrack();
		track.root.insertBefore(this.#thumb);
		return track;
	}

	get trackContainer() {
		return this.#container;
	}

	get value() {
		return this.#value;
	}

	set value(val) {
		if (isNaN(val)) val = 0;
		this.#value = val;

		let sliderWidth = this.#container.getBoundingClientRect().width;
		let thumbWidth = this.#thumb.getBoundingClientRect().width;

		let x = (val - this.#min) / (this.#max - this.#min);
		this.#lower.style.width = `${x * 100}%`;
		this.#thumb.style.left = `${x * sliderWidth - thumbWidth/2}px`;
	}
}

export class SliderTrack {
	private $root: $Element;

	constructor($root: $Element) {
		this.$root = $root;
	}

	setColor(color: string) {
		this.$root.css("--track-color", color);
	}

	addRange(begin: number, width: number) {
		let $segment = $('<div class="track-range">');
		let range = new SliderTrackRange($segment);
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
	private $range: $Element;

	constructor($range: $Element) {
		this.$range = $range;
	}

	set begin(val: number) {
		this.$range.css("left", `${val * 100}%`)
	}

	set width(val: number) {
		this.$range.css("width", `${val * 100}%`)
	}
}

async function doStaticInitialization() {
	staticInit = true;
	stylesheet = new CSSStyleSheet();
	fetch('/res/css/slider.css')
		.then(res => res.text())
		.then(css => stylesheet.replace(css));
}