import ResizeObserverPolyfill from "./resize_observer.mjs";

function install() {
	// For Chrome < 76, Blob.text().
	if (!Blob.prototype.text) {
		Blob.prototype.text = async function(): Promise<string> {
			return new Promise((resolve, reject) => {
				let reader = new FileReader();
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = () => reject(reader.error);
				reader.readAsText(this);
			});
		};
	}

	// For Chrome < 64 Make same-origin the default credentials option for fetch().
	if (new Request('').credentials === 'omit') {
		let FETCH = window.fetch;
		window.fetch = function(input: any, params: any): Promise<Response> {
			if (!params)
				params = {};

			if (!params.credentials)
				params.credentials = 'same-origin';
			return FETCH(input, params);
		}
	}

	// For Chrome < 64 Implement ResizeObservers
	if (!window.ResizeObserver) {
		window.ResizeObserver = ResizeObserverPolyfill;
	}

	// For Chrome < 61 Implement Element.scrollTo()
	if (!('scrollTo' in Element.prototype)) {
		(Element.prototype as any).scrollTo = function(x, y) {
			if (typeof x === 'object') {
				// If an object is passed, use the object's `left` and `top` properties
				this.scrollLeft = x.left || 0;
				this.scrollTop = x.top || 0;
			} else {
				// If two numeric values are passed (x and y)
				this.scrollLeft = x || 0;
				this.scrollTop = y || 0;
			}
		};
	}
}

export default { install };