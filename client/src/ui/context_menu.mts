import { ClientClass } from "../client_core.mjs";
import { BadParameterFault, IllegalStateFault } from "../faults.mjs";

interface CtxEntryOptions {
	checked?: boolean;
	disabled?: boolean;
}

export interface CtxEntry {
	0: string;
	1?: Function | CtxEntry[];
	2?: CtxEntryOptions;
}

export class ContextItem {
	label: string;
	action: Function;
	enabled: boolean;
	_menu: ContextMenu;
	protected $menuItem: $Element;

	constructor(label: string, action: Function) {
		this.label = label;
		this.action = action;
		this.enabled = true;
		this._menu = null;
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
	click() {
		if (!this.enabled) return;
		if (this.action) this.action();
		this.getRootMenu().close();
	}

	/**
	 * Get an HTML element that represents this context menu item. If the element was not requested
	 * before, it is created now.
	 */
	getElement(): $Element {
		if (this.$menuItem) return this.$menuItem;
		this.$menuItem = this.createElement();
		return this.$menuItem;
	}

	/**
	 * Obtains the menu owner of this context menu item.
	 */
	getMenu() {
		return this._menu;
	}

	/**
	 * Obtains the topmost menu of the chain of submenus this item could be part of.
	 */
	getRootMenu() {
		if (!this._menu) return null;

		let current = this._menu;
		while (current._menu) {
			current = current._menu;
		}
		return current;
	}
}

export class ContextMenuSeparator extends ContextItem {
	constructor() {
		super(null, null);
	}

	protected createElement(): $Element {
		return $('<hr/>');
	}
}

export class ContextCheckbox extends ContextItem {
	#checked: boolean;

	constructor(label: string, action: Function, checked: boolean) {
		super(label, action);
		this.#checked = Boolean(checked);
	}

	createElement(): $Element {
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

export class ContextMenu extends ContextItem {
	$menuBase: $Element;
	#items: ContextItem[];

	constructor(items: ContextItem[], label?: string) {
		super(label, () => {});
		this.#items = [];

		for (let it of items) {
			this.addItem(it);
		}
	}

	addItem(it: ContextItem) {
		it._menu = this;
		this.#items.push(it);
	}

	getItems(): readonly ContextItem[] {
		return this.#items;
	}

	close() {
		this.$menuBase.removeClass('visible');
		this.$menuBase.find('.context-menu').removeClass('visible');
	}

	setBase($base: $Element) {
		this.$menuBase = $base;
	}

	createElement(): $Element {
		let $item = super.createElement();
		$item.addClass('menu');
		this.$menuBase = $('<div class="context-menu">').appendTo($item);
		return $item;
	}

	/**
	 * Opens this context submenu item.
	 */
	click() {
		const { screenWidth, screenHeight } = ClientClass.get().desktop;

		this.$menuBase.addClass('visible');

		let $parentMenu: HTMLElement = this.getMenu().$menuBase[0];
		let $base: HTMLElement = this.$menuBase[0];
		let $item: HTMLElement = this.$menuItem[0];

		let menuStyle = getComputedStyle($base);
		let parentRect = $parentMenu.getBoundingClientRect();
		let itemRect = $item.getBoundingClientRect();

		// X position relative to the parent menu
		let x = $parentMenu.offsetWidth - 1;

		// Y position relative to the parent menu 
		let yPadding = parseFloat(menuStyle.paddingTop) + parseFloat(menuStyle.borderTopWidth);
		let y = itemRect.y - parentRect.y - yPadding - 1;

		let mWidth = $base.offsetWidth;
		let mHeight = $base.offsetHeight;

		// If the menu would appear outside the screen on the right, make it appear on the left.
		if (parentRect.x + x + mWidth > screenWidth) {
			x = -mWidth;
		}

		// Don't allow the menu to appear outside to the left edge either
		if (parentRect.x + x < 0) {
			x = -parentRect.x;
		}

		// Make the menu appear upwards if it would escape the bottom of the screen
		if (parentRect.y + y + mHeight > screenHeight) {
			y = itemRect.bottom - parentRect.y - mHeight + yPadding  - 1;
		}
		
		// Make the menu appear on top if it would escape upwards
		if (parentRect.y + y < 0) y = -parentRect.y;

		this.$menuBase.css({'left': x, 'top': y});
	}

	/**
	 * Constructs the elements in this menu base element.
	 */
	build() {
		this.$menuBase.empty();

		for (let item of this.#items) {
			let $item = item.getElement();

			// Build submenus
			if (item instanceof ContextMenu) {
				item.build();
			}

			this.$menuBase.append($item);
		}
	}

	static fromDefinition(entries: CtxEntry[], label?: string): ContextMenu {
		return new ContextMenu(itemsFromDefinition(entries), label);
	}
}

/**
 * Generated context menu items from entries.
 * @param entries Array of stringified entries in a terse syntax.
 * @returns An array of context menu entries. These can be added to a context menu as is.
 */
function itemsFromDefinition(entries: CtxEntry[]): ContextItem[] {
	let constructed: ContextItem[] = [];

	for (let entry of entries) {
		let type = entry[0].at(0);
		let label = entry[0].substring(1);
		let options = (entry[2] ?? {}) as CtxEntryOptions;
		let item: ContextItem;

		// Horizontal separator
		if (type == '|') {
			item = new ContextMenuSeparator();
		// Regular entry
		} else if (type == '-') {
			let action = entry[1] as Function;
			item = new ContextItem(label, action);
			item.enabled = !options.disabled;
		// Checked options
		} else if (type == '*') {
			let action = entry[1] as Function;
			let checked = Boolean(options.checked);
			item = new ContextCheckbox(label, action, checked);
		// Submenus
		} else if (type == '>') {
			let subEntries = entry[1] as CtxEntry[];
			let subMenu = itemsFromDefinition(subEntries);
			item = new ContextMenu(subMenu, label);
		} else {
			throw new BadParameterFault(`Undefined context menu entry type '${type}' of entry '${entry[0]}'`);
		}
		constructed.push(item);
	}

	return constructed;
}
