import { ClientClass } from "../../../client_core.mjs";
import { IllegalStateFault } from "../../../faults.mjs";
import ContextItem from "./ctx_item.mjs";
import CtxShorthand, { CtxEntry } from "./shorthand.mjs";

export class ContextMenu extends ContextItem {
	private $menuBase: $Element;
	private items: ContextItem[];

	public constructor(items?: ContextItem[], label?: string) {
		super(label, () => {});
		this.items = [];

		if (items) {
			for (let it of items) {
				this.addItem(it);
			}
		}
	}

	public addItem(it: ContextItem) {
		it._menu = this;
		this.items.push(it);
	}

	public getItems(): readonly ContextItem[] {
		return this.items;
	}

	public close() {
		if (!this.$menuBase) return;

		this.$menuBase.removeClass('visible');
		this.$menuBase.find('.context-menu').removeClass('visible');
	}

	/**
	 * Creates a menu item that when clicked opens up this submenu.
	 */
	protected createElement(): $Element {
		let $item = super.createElement();
		$item.addClass('menu');
		this.$menuBase = $('<div class="context-menu">');
		this.$menuBase.appendTo($item);
		return $item;
	}

	/**
	 * Opens this context submenu item.
	 */
	protected click() {
		if (!this.$menuBase) throw new IllegalStateFault("No menu base.");
		if (!this.$menuItem) throw new IllegalStateFault("No menu item.");

		const [screenWidth, screenHeight] = ClientClass.get().desktop.getDesktopSize();

		this.$menuBase.addClass('visible');

		let parentMenu = this.getOwnerMenu();
		
		let $parentMenu: HTMLElement = parentMenu.$menuBase[0];
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

	/** Specify the root element for this menu to be constructed in.
	  * @internal
	  */
	_setBase($base: $Element) {
		this.$menuBase = $base;
	}

	/**
	 * Constructs the items in the base menu element. A menu base can be manually set (in the case
	 * of the first menu open in the desktop or automatically created when transforming this menu
	 * into a subitem trough _getElement().
	 * @internal
	 */
	_build() {
		if (!this.$menuBase) throw new IllegalStateFault("No menu base.");

		this.$menuBase.empty();

		for (let item of this.items) {
			let $item = item._getElement();

			// Build submenus
			if (item instanceof ContextMenu) {
				item._build();
			}

			this.$menuBase.append($item);
		}
	}

	public static fromDefinition(entries: CtxEntry[], label?: string): ContextMenu {
		return CtxShorthand.menuFromDefinition(entries, label);
	}
}

export default ContextMenu;