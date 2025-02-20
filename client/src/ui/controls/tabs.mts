export class UITabs extends HTMLElement {
	onTabChanged?: Function;
	private $header: $Element;

	constructor() {
		super();
	}

	connectedCallback() {
		let $self = $(this);

		// Identify and create header if necessary
		this.$header = $self.find('.ui-tabs-header');
		if (this.$header.length == 0) {
			this.$header = $("<div class='ui-tabs-header'>").prependTo($self);
		}

		let $switchers = this.querySelectorAll('.ui-tabs-switch');

		for (let $switch of $switchers) {
			$switch.addEventListener('click', () => {
				let tab = $switch.getAttribute('data-tab');
				if (tab) this.setActiveTab(tab);
			});
		}
	}

	public createTab(tabId: string, tabLabel: string): $Element {
		let $self = $(this);
		let $tab = $(`<div class="ui-tab ${tabId}-tab" data-tab="${tabId}">`);
		$self.append($tab);

		let $tabSwitch = $(`<button class="ui-tabs-switch" data-tab="${tabId}">${tabLabel}</button>`);
		this.$header.append($tabSwitch);

		$tabSwitch.click(() => {
			this.setActiveTab(tabId);
		});
		return $tab;
	}

	public getTab(tabId: string) {
		return $(this).find(`div[data-tab="${tabId}"]`);
	}

	public setActiveTab(tab: string): void {
		let $tabPane = $(this);
		$tabPane.find('.ui-tabs-switch').removeClass('selected');
		$tabPane.find('.ui-tab').removeClass('visible');

		$tabPane.find(`.ui-tabs-switch[data-tab='${tab}']`).addClass('selected');
		$tabPane.find(`.ui-tab[data-tab='${tab}']`).addClass('visible');
		if (this.onTabChanged) this.onTabChanged(tab);
	}
}
