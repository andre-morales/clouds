export class Fullscreen {
	static stack = [];
	static element = null;
	static fullscreenCallbacks = [];
	static $style = null;

	// Call before utilizing any of the fullscreen utilities. Sets up a callback for fullscreen state changes and
	// prepares custom styling for any fullscreen elements.
	static init() {
		let fscrHandler = () => {
			// If the browser went fullscreen
			if(document.fullscreenElement) {
				// Notify those who are waiting for
				// the browser to finish going fullscreen
				this.fullscreenCallbacks.forEach(fn => fn());
				this.fullscreenCallbacks = [];
				return;
			}
			
			// Whenever the user exits browser fullscreen,
			// update our custom fullscreen state as well
			this._clearClasses();
			this._clearStyle();
			this.stack = [];
			this.element = null;			
		}
		
		// Locates the empty <style> in the head of the page. This tag will be used for applying --reversible--
		// style changes to the fullscreened element itself and all of its ancestors.
		this.$style = $("#fullscreen-style");
		
		// Install the listener
		document.addEventListener('fullscreenchange', fscrHandler);
	}

	// Applies fullscreen on any html element. Fullscreen calls can be stacked, and will be unwound upon calling
	// rewind().
	static on(el) {
		this.element = el;
		this.stack.push(el);			
		
		// Wait for the browser to go fullscreen if it wasn't already
		// and then apply the styles and classes.
		this._domEnterFscr(() => {
			this._clearClasses();
			this._clearStyle();

			this._applyStyle(el);
			this._applyClasses(el);
		});
	}

	// Leave fullscreen from any elements entirely.
	static leave() {
		this.stack = [];
		this.element = null;

		this._clearClasses();
		this._clearStyle();
		this._domExitFscr();
	}

	// Fullscreen the element that was previously fullscreened. If none were, leaves fullscreen state.
	static rewind() {
		let pop = this.stack.pop();
		let len = this.stack.length;
		if (len == 0) {
			this._domExitFscr();
			this.element = null;
		}

		let last = this.stack[len - 1];
		this.element = last;
		if(last) {
			this._clearClasses();
			this._clearStyle();
			this._applyStyle(last);
			this._applyClasses(last);
		}
	}
	
	// Apply custom fullscreen classes to the element and its ancestors.
	static _applyClasses(elem) {
		this._clearClasses();

		let $el = $(elem);
		$el.addClass('fullscreened');
		$el.parents().each((i, el) => {
			$(el).addClass('fscr-parent');
		});
	}

	// Removes all custom classes from fullscreen elements and its ancestors.
	static _clearClasses() {
		// Get fullscreened element
		let $el = $('.fullscreened');
		if ($el.length == 0) return;

		// Remove classes
		$el.removeClass('fullscreened');
		$('.fscr-parent').removeClass('fscr-parent')
	}

	// Applies custom styling to the fullscreened element and its parents by inserting a rule in the fullscreen
	// <style> tag.
	static _applyStyle(elem) {
		this._clearStyle();
		
		let sheet = this.$style[0].sheet;
		setTimeout(() => {
			let rect = elem.getBoundingClientRect();
			sheet.insertRule(`.fullscreened { transform: translate(${-rect.x}px, ${-rect.y}px); width: ${window.innerWidth}px; height: ${window.innerHeight}px; } `);
		}, 50);
	}

	// Removes all custom styling from the elements by clearing the fullscreen <style> tag.
	static _clearStyle() {
		let sheet = this.$style[0].sheet;
		while (sheet.cssRules.length > 0) {
			sheet.deleteRule(0);
		}
	}

	// Requests fullscreen state on the body element of the page, calling the given callback once the transition
	// is finished. If the browser was already on fullscreen state, calls callback immediately.
	static _domEnterFscr(callback) {
		// If the browser already is in fullscreen, just run the callback immediately
		if (document.fullscreenElement) {
			if (callback) callback();
			return;
		}
		
		// Otherwise, schedule the callback and request DOM fullscreen on the whole document
		if (callback) this.fullscreenCallbacks.push(callback);
		document.body.requestFullscreen().then(() => {
			
		});
	}
	
	// Leaves browser fullscreen state
	static _domExitFscr() {
		if (document.fullscreenElement) document.exitFullscreen();
	}
}

export default Fullscreen;