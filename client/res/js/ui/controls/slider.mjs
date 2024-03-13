var staticInit = false;
var stylesheet;

export class UISlider extends HTMLElement {
	constructor() {
		super();

		if (!staticInit) {
			doStaticInitialization();
		}

		this._value = this.getAttribute('value');
		this._min = this.getAttribute('min');
		this._max = this.getAttribute('max');
		if (!this._value) this._value = 0;
		if (!this._min) this._min = 0;
		if (!this._max) this._max = 100;

		// Create shadow DOM
		let shadow = this.attachShadow({ mode: 'open' });
		shadow.adoptedStyleSheets = [stylesheet];

		let container = document.createElement('div');
		shadow.append(container);
		this._container = container;

		let lower = document.createElement('span');
		lower.classList.add('lower');
		container.append(lower);
		this._lower = lower;

		let thumb = document.createElement('span');
		thumb.classList.add('thumb');
		container.append(thumb);
		this._thumb = thumb;
	}

	connectedCallback() {
		let valueChange = (coff, fireEv) => {
			coff = Mathx.clamp(coff, 0, 1);
			let val = this._min + (this._max - this._min) * coff;

			this.value = val;

			$(this).trigger('change');
		};

		let dragX = (ev) => {
			let mx = ev.pageX;

			let touches = ev.changedTouches;
			if (touches && touches[0]) {
				mx = touches[0].pageX;
			}

			let rect = this._container.getBoundingClientRect();
			return (mx - rect.left) / rect.width;
		};

		// Event handling
		let held = false;
		
		$(document).on('mousemove touchmove', (ev) => {
			if(!held) return

			valueChange(dragX(ev));	
		});
		
		this._container.addEventListener('mousedown', (ev) => {
			held = true;
			valueChange(dragX(ev));
		});
		this._container.addEventListener('touchstart', (ev) => {
			held = true;
			valueChange(dragX(ev));
		});

		this._thumb.addEventListener('mousedown', () => held = true);
		this._thumb.addEventListener('touchstart', () => held = true);

		$(document).on('mouseup touchend', (ev) => {
			if(!held) return;
			held = false;

			valueChange(dragX(ev));
		});
	}

	get value() {
		return this._value;
	}

	set value(val) {
		if (isNaN(val)) val = 0;
		this._value = val;

		let sliderWidth = this._container.getBoundingClientRect().width;
		let thumbWidth = this._thumb.getBoundingClientRect().width;

		let x = (val - this._min) / (this._max - this._min);
		this._lower.style.width = `${x * 100}%`;
		this._thumb.style.left = `${x * sliderWidth - thumbWidth/2}px`;
	}
}

async function doStaticInitialization() {
	staticInit = true;
	stylesheet = new CSSStyleSheet();
	fetch('/res/ui/slider.css')
		.then(res => res.text())
		.then(css => stylesheet.replace(css));
}