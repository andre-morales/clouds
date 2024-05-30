export class UITabs extends HTMLElement {
	onTabChanged: Function;

	constructor() {
		super();
		this.onTabChanged = null;
	}

	connectedCallback() {
		let $switchers = this.querySelectorAll('.ui-tabs-switch');
		for (let $switch of $switchers) {
			$switch.addEventListener('click', () => {
				let tab = $switch.getAttribute('data-tab');
				this.setActiveTab(tab);
			});
		}
	}

	setActiveTab(tab) {
		let $tabPane = $(this);
		$tabPane.find('.ui-tabs-switch').removeClass('selected');
		$tabPane.find('.ui-tab').removeClass('visible');

		$tabPane.find(`.ui-tabs-switch[data-tab='${tab}']`).addClass('selected');
		$tabPane.find(`.ui-tab[data-tab='${tab}']`).addClass('visible');
		if (this.onTabChanged) this.onTabChanged(tab);
	}
}
