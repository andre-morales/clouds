import { ContextMenu } from "./ctx_menu.mjs";

export default class ContextItem {
	public enabled: boolean;
	protected label?: string;
	protected action?: Function;
	protected $menuItem?: $Element;
	/** @internal */
	_menu: ContextMenu;

	public constructor(label?: string, action?: Function) {
		this.label = label;
		this.action = action;
		this.enabled = true;
	}

	/**
	 * Creates an HTML element for this menu item. This function is only ever called once.
	 */
	protected createElement(): $Element {
		let $item = $(`<i>${this.label}</i>`);
		$item.toggleClass('disabled', !this.enabled);
		$item.on('click', () => {
			this.click();
		});
		return $item;
	}

	/**
	 * Implements behavior for when this menu item is clicked.
	 */
	protected click() {
		if (!this.enabled) return;
		if (this.action) this.action();
		this.getRootMenu().close();
	}

	/**
	 * Obtains the menu owner of this context menu item.
	 */
	public getOwnerMenu() {
		return this._menu;
	}

	/**
	 * Obtains the topmost menu of the chain of submenus this item could be part of.
	 */
	public getRootMenu() {
		if (!this._menu) return null;

		let current = this._menu;
		while (current._menu) {
			current = current._menu;
		}
		return current;
	}

	/**
	 * Get an HTML element that represents this context menu item. If the element was not requested
	 * before, it is created now.
	 * @internal
	 */
	_getElement(): $Element {
		if (this.$menuItem) return this.$menuItem;

		this.$menuItem = this.createElement();
		return this.$menuItem;
	}
}

