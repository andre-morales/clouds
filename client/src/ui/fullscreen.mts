import Driver from "../drivers/fullscreen_driver.mjs";

type FullscreenCallback = () => void;

export class Fullscreen {
	private static enabled: boolean;
	private static stack: HTMLElement[] = [];
	private static currentElement: HTMLElement = null;
	private static fullscreenCallbacks: FullscreenCallback[] = [];
	private static $style = null;

	// Call before utilizing any of the fullscreen utilities. Sets up a callback for fullscreen state changes and
	// prepares custom styling for any fullscreen elements.
	public static init() {
		this.enabled = Driver.isSupported();
		if (!this.enabled) {
			console.warn("Fullscreen is not supported in this browser.");
			return;
		}

		let fullscreenHandler = () => {
			// If the browser went fullscreen
			if(Driver.fullscreenElement) {
				// Notify those who are waiting for
				// the browser to finish going fullscreen
				this.fullscreenCallbacks.forEach(fn => fn());
				this.fullscreenCallbacks = [];
				return;
			}
			
			// Whenever the user exits browser fullscreen,
			// update our custom fullscreen state as well
			this.clearClasses();
			this.clearStyle();
			this.stack = [];
			this.currentElement = null;			
		}
		
		// Locates the empty <style> in the head of the page. This tag will be used for applying --reversible--
		// style changes to the fullscreen element itself and all of its ancestors.
		this.$style = $("#fullscreen-style");
		
		// Install the listener
		Driver.onFullscreenChange(fullscreenHandler);
	}

	// Applies fullscreen on any html element. Fullscreen calls can be stacked, and will be unwound
	// upon calling rewind().
	public static on(el: HTMLElement) {
		this.currentElement = el;
		this.stack.push(el);			
		
		// Wait for the browser to go fullscreen if it wasn't already
		// and then apply the styles and classes.
		this.domEnterFullscreen(() => {
			this.clearClasses();
			this.clearStyle();

			this.applyStyle(el);
			this.applyClasses(el);
		});
	}

	// Leave fullscreen mode entirely. The fullscreen stack is cleared.
	public static leave() {
		this.stack = [];
		this.currentElement = null;

		this.clearClasses();
		this.clearStyle();
		this.domExitFullscreen();
	}

	// Fullscreen the element that was previously fullscreen. If none were, leaves fullscreen state.
	public static rewind() {
		let pop = this.stack.pop();
		let len = this.stack.length;
		if (len == 0) {
			this.domExitFullscreen();
			this.currentElement = null;
		}

		let last = this.stack[len - 1];
		this.currentElement = last;
		if(last) {
			this.clearClasses();
			this.clearStyle();
			this.applyStyle(last);
			this.applyClasses(last);
		}
	}
	
	// Apply custom fullscreen classes to the element and its ancestors.
	private static applyClasses(elem: HTMLElement) {
		this.clearClasses();

		let $el = $(elem);
		$el.addClass('fullscreened');
		$el.parents().each((i, el) => {
			$(el).addClass('fscr-parent');
			return true;
		});
	}

	/**
	 * Removes all custom classes from fullscreen elements and its ancestors.
	 **/ 
	private static clearClasses() {
		// Get current fullscreen element
		let $el = $('.fullscreened');
		if ($el.length == 0) return;

		// Remove classes
		$el.removeClass('fullscreened');
		$('.fscr-parent').removeClass('fscr-parent')
	}

	/**
	 * Applies custom styling to the fullscreen element and its parents by inserting a rule in the
	 * fullscreen <style> tag.
	 */
	private static applyStyle(elem: HTMLElement) {
		this.clearStyle();
		
		let sheet = this.$style[0].sheet;
		setTimeout(() => {
			let rect = elem.getBoundingClientRect();
			sheet.insertRule(`.fullscreened { transform: translate(${-rect.x}px, ${-rect.y}px); width: ${window.innerWidth}px; height: ${window.innerHeight}px; } `);
		}, 50);
	}

	// Removes all custom styling from the elements by clearing the fullscreen <style> tag.
	private static clearStyle() {
		let sheet = this.$style[0].sheet;
		while (sheet.cssRules.length > 0) {
			sheet.deleteRule(0);
		}
	}

	// Requests fullscreen state on the body element of the page, calling the given callback once the transition
	// is finished. If the browser was already on fullscreen state, calls callback immediately.
	private static domEnterFullscreen(callback: () => void) {
		// If the browser already is in fullscreen, just run the callback immediately
		if (Driver.fullscreenElement) {
			if (callback) callback();
			return;
		}
		
		// Otherwise, schedule the callback and request DOM fullscreen on the whole document
		if (callback) this.fullscreenCallbacks.push(callback);
		Driver.requestFullscreen();
	}
	
	// Leaves browser fullscreen state
	private static domExitFullscreen() {
		if (Driver.fullscreenElement) Driver.exitFullscreen();
	}

	public static get element(): HTMLElement {
		return Fullscreen.currentElement;
	}
}

export default Fullscreen;