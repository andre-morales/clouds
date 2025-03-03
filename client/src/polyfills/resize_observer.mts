export default class ResizeObserverPolyfill {
	callback: any;
	observedElements: any;
	listener: any;

    constructor(callback) {
      this.callback = callback;
      this.observedElements = new Map();
      this.listener = this.handleResize.bind(this);
      window.addEventListener('resize', this.listener);
    }

    observe(element) {
      if (!this.observedElements.has(element)) {
        this.observedElements.set(element, { width: element.offsetWidth, height: element.offsetHeight });
      }
    }

    unobserve(element) {
      this.observedElements.delete(element);
    }

    disconnect() {
      window.removeEventListener('resize', this.listener);
      this.observedElements.clear();
    }

    handleResize() {
      this.observedElements.forEach((size, element) => {
        const newWidth = element.offsetWidth;
        const newHeight = element.offsetHeight;

        if (newWidth !== size.width || newHeight !== size.height) {
          this.callback([{
            target: element,
            contentRect: { width: newWidth, height: newHeight }
          }]);
          this.observedElements.set(element, { width: newWidth, height: newHeight });
        }
      });
    }
}