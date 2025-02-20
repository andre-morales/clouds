import { UIErrorDisplay } from './error_display.mjs';
import { UISlider } from './slider.mjs';
import { UITabs } from './tabs.mjs';

export async function init() {
	window.customElements.define('ui-slider', UISlider);
	window.customElements.define('ui-tabs', UITabs);
	window.customElements.define('ui-error-display', UIErrorDisplay);
}

export default { init };