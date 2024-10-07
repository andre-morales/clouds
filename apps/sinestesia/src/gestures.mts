export class Gestures {
	private enabled: boolean;
	private transform: any;
	private onUpdate: Function;

	constructor(updateCallback: Function) {
		this.onUpdate = updateCallback;
	}

	setEnabled(enabled: boolean) {
		this.enabled = enabled;
	}

	setTransform(transform: any) {
		this.transform = transform;
	}

	cleanTransform() {
		this.transform.x = 0;
		this.transform.y = 0;
		this.transform.scale = 1;	
	}

	on(element: HTMLElement) {
		// Prevent adding gestures more than once
		if (element.getAttribute('data-has-gestures')) return;
		element.setAttribute('data-has-gestures', 'true');

		let trans = this.transform;
		
		let lX = 0, lY = 0;
		let lScale = 1;
		
		let hammer = new Hammer.Manager(element, {
			recognizers: [
				[Hammer.Pinch, {}],
				[Hammer.Pan, {}]
			]
		});
		
		hammer.on('pinchstart', () => {
			lScale = trans.scale;
		});

		hammer.on('pinch', (ev) => {
			if (!this.enabled) return;
			
			trans.scale = lScale * ev.scale; 
			this.onUpdate();
		});

		hammer.on('panstart', () => {
			lX = trans.x;
			lY = trans.y;
		});

		hammer.on('pan', (ev) => {
			if (!this.enabled) return;

			trans.x = lX + ev.deltaX / trans.scale;
			trans.y = lY + ev.deltaY / trans.scale;
			this.onUpdate();
		});
	}
}