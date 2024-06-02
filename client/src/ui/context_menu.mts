import { BadParameterFault } from "../faults.mjs";

type CtxItem = CtxItemClass | CtxMenuClass | string;

interface ContextEntryOptions {
	checked?: boolean;
	disabled?: boolean;
}

export interface ContextEntry {
	0: string;
	1?: Function | ContextEntry[];
	2?: ContextEntryOptions;
}

export class CtxMenuClass {
	entries: CtxItem[];
	label: string;

	constructor(entries: CtxItem[], label?: string) {
		this.entries = entries ?? [];
		this.label = label ?? '';
	}

	static fromEntries(entries: ContextEntry[], label?: string): CtxMenuClass {
		return new CtxMenuClass(itemsFromEntries(entries), label);
	}

	buildIn($menu: $Element, $rootMenu: $Element, screenWidth: number, screenHeight: number) {
		for (let entry_ of this.entries) {
			if (entry_ === '-') {
				$menu.append($('<hr>'));
				continue;
			}

			let entry: any = entry_;
			let $item: $Element;
			let label = entry.label;
			let action = entry.action;
			let enabled = entry.enabled;

			// Checkbox
			if (entry instanceof CtxCheckClass) {
				$item = $(`<i class='check'>${label}</i>`)
				if (entry.checked) $item.addClass('checked');

				$item.on('click', () => {
					entry.checked = !entry.checked;
					//$item.toggleClass('checked', entry.checked);
					if (action) action.apply(entry, [entry.checked]);
					$rootMenu.removeClass('visible');
				});
			// Submenu
			} else if (entry instanceof CtxMenuClass) {
				$item = $(`<i class='menu'>${label}</i>`);
				let $sub = $('<div class="context-menu">');
				entry.buildIn($sub, $rootMenu, undefined, undefined);

				$item.append($sub);

				$item.on('click', () => {
					$sub.addClass('visible');
					let rectP = $menu[0].getBoundingClientRect();
					let rectI = $item[0].getBoundingClientRect();

					let x = rectI.width;
					let y = rectI.y - rectP.y;

					let mwidth = $sub[0].offsetWidth;
					let mheight = $sub[0].offsetHeight;

					if (rectP.x + x + mwidth > screenWidth) x -= mwidth;
					if (x < 0) x = 0;

					if (rectP.y + y + mheight > screenHeight) y -= mheight;
					if (y < 0) y = 0;

					$sub.css('left', x);
					$sub.css('top', y);
				});
			// Regular item
			} else {
				$item = $(`<i>${label}</i>`)
				if (!enabled) $item.addClass('disabled');

				$item.on('click', () => {
					if (!enabled) return;
					if (action) action();
					$rootMenu.removeClass('visible');
				});
			}

			$menu.append($item);
		}
	}
}

export class CtxItemClass {
	label: string;
	action: Function;
	enabled: boolean;

	constructor(label: string, action: Function) {
		this.label = label;
		this.action = action;
		this.enabled = true;
	}

	setEnabled(v: boolean) {
		this.enabled = v;
		return this;
	}
}

export class CtxCheckClass extends CtxItemClass {
	checked: boolean;

	constructor(label: string, action: Function, checked: boolean) {
		super(label, action);
		this.checked = Boolean(checked);
	}
}

export function CtxMenu(entries: CtxItem[], label?: string): CtxMenuClass {
	return new (CtxMenuClass as any)(...arguments);
}

export function CtxItem(label: string, action: Function): CtxItemClass {
	return new (CtxItemClass as any)(...arguments);
}

export function CtxCheck(): CtxCheckClass {
	return new (CtxCheckClass as any)(...arguments);
}

/**
 * Generated context menu items from entries.
 * @param entries Array of stringified entries in a terse syntax.
 * @returns An array of context menu entries. These can be added to a context menu as is.
 */
function itemsFromEntries(entries: ContextEntry[]): CtxItem[] {
	let constructed: CtxItem[] = [];

	for (let entry of entries) {
		let type = entry[0].at(0);
		let label = entry[0].substring(1);
		let options = (entry[2] ?? {}) as ContextEntryOptions;
		let item: CtxItem;

		// Horizontal separator
		if (type == '|') {
			item = '-';
		// Regular entry
		} else if (type == '-') {
			let action = entry[1] as Function;
			item = new CtxItemClass(label, action);
			item.enabled = !options.disabled;
		// Checked options
		} else if (type == '*') {
			let action = entry[1] as Function;
			let checked = Boolean(options.checked);
			item = new CtxCheckClass(label, action, checked);
		// Submenus
		} else if (type == '>') {
			let subEntries = entry[1] as ContextEntry[];
			let subMenu = itemsFromEntries(subEntries);
			item = new CtxMenuClass(subMenu, label);
		} else {
			throw new BadParameterFault(`Undefined context menu entry type '${type}' of entry '${entry[0]}'`);
		}
		constructed.push(item);
	}

	return constructed;
}
