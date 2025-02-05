import ContextCheckbox from "./ctx_checkbox.mjs";
import ContextItem from "./ctx_item.mjs";
import { ContextMenu } from "./ctx_menu.mjs";
import { ContextMenuSeparator } from "./separator.mjs";
import { BadParameterFault } from "/@sys/faults.mjs";

interface CtxEntryOptions {
	checked?: boolean;
	disabled?: boolean;
}

export interface CtxEntry {
	0: string;
	1?: Function | ((v: boolean) => void) | CtxEntry[];
	2?: CtxEntryOptions;
}

export function menuFromDefinition(entries: CtxEntry[], label?: string) {
	return new ContextMenu(itemsFromDefinition(entries), label);
}

/**
 * Generated context menu items from entries.
 * @param entries Array of stringified entries in a terse syntax.
 * @returns An array of context menu entries. These can be added to a context menu as is.
 */
export function itemsFromDefinition(entries: CtxEntry[]): ContextItem[] {
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

export default { itemsFromDefinition, menuFromDefinition }