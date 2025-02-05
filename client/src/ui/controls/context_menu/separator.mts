import ContextItem from "./ctx_item.mjs";

export class ContextMenuSeparator extends ContextItem {
	constructor() {
		super('', null);
	}

	protected createElement(): $Element {
		return $('<hr/>');
	}
}
