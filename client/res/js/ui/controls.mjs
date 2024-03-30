export async function init() {
	let SliderM = await import('/res/js/ui/controls/slider.mjs');
	window.customElements.define('ui-slider', SliderM.UISlider);

	let TabsM = await import('/res/js/ui/controls/tabs.mjs');
	window.customElements.define('ui-tabs', TabsM.UITabs);
}

export default { init };