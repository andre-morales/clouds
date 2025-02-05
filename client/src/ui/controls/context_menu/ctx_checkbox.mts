import ContextItem from "./ctx_item.mjs";

export default class ContextCheckbox extends ContextItem {
	#checked: boolean;

	constructor(label: string, action: Function, checked: boolean) {
		super(label, action);
		this.#checked = Boolean(checked);
	}

	protected createElement(): $Element {
		let $item = super.createElement();
		$item.addClass('check');
		$item.toggleClass('checked', this.#checked);
		return $item;
	}

	click() {
		if (!this.enabled) return;

		this.setChecked(!this.#checked);
		if (this.action) this.action.apply(this, [this.#checked]);
		this.getRootMenu().close();	
	}

	setChecked(value: boolean) {
		this.#checked = value;
		if (this.$menuItem) {
			this.$menuItem.toggleClass('checked', this.#checked);
		}
	}

	isChecked() {
		return this.#checked;
	}
}
