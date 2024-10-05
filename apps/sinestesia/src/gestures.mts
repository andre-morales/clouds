export class Gestures {
	#enabled: boolean;
	#transform: any;
	#onUpdate: Function;

	constructor(updateCallback: Function) {
		this.#onUpdate = updateCallback;
	}

	setEnabled(enabled: boolean) {
		this.#enabled = enabled;
	}

	setTransform(transform: any) {
		this.#transform = transform;
	}

	cleanTransform() {
		this.#transform.x = 0;
		this.#transform.y = 0;
		this.#transform.scale = 1;	
	}

	on(element: HTMLElement) {
		// Prevent adding gestures more than once
		if (element.getAttribute('data-has-gestures')) return;
		element.setAttribute('data-has-gestures', 'true');

		let trans = this.#transform;
		
		let _lx = 0, _ly = 0;
		let _lscale = 1;
		
		let hammer = new Hammer.Manager(element, {
			recognizers: [
				[Hammer.Pinch, {}],
				[Hammer.Pan, {}]
			]
		});
		
		hammer.on('pinchstart', () => {
			_lscale = trans.scale;
		});
		hammer.on('pinch', (ev) => {
			if (!this.#enabled) return;

			trans.scale = _lscale * ev.scale; 
			//this.updateTransform();
			this.#onUpdate();
		});

		hammer.on('panstart', () => {
			_lx = trans.x;
			_ly = trans.y;
		});
		hammer.on('pan', (ev) => {
			if (!this.#enabled) return;

			trans.x = _lx + ev.deltaX / trans.scale;
			trans.y = _ly + ev.deltaY / trans.scale;
			//this.updateTransform();
			this.#onUpdate();
		});
	}
}