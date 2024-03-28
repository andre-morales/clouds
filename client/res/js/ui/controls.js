class UIControls {
	static async init() {
		let SliderM = await import('/res/js/ui/controls/slider.mjs');
		window.customElements.define('ui-slider', SliderM.UISlider);

		let TabsM = await import('/res/js/ui/controls/tabs.mjs');
		window.customElements.define('ui-tabs', TabsM.UITabs);
	}	

	static tabs(elem) {
		let $tabPane = $(elem);
		let control = new UITabs($tabPane);

		$tabPane.find('.ui-tabs-header button').click((ev) => {
			let tab = ev.target.getAttribute('data-tab');
			$tabPane.find('.ui-tabs-header .button').removeClass('selected');
			$tabPane.find('.ui-tab').removeClass('visible');

			ev.target.classList.add('selected');
			$tabPane.find(`.ui-tab[data-tab='${tab}']`).addClass('visible');
			if (control.onTabChanged) control.onTabChanged(tab);
		});

		return control;
	}
}

class UITabs {
	constructor($elem) {
		this.$element = $elem;
		this.onTabChanged = null;
	}
}