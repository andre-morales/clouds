"use strict"

class CtxMenuClass {
	constructor(entr, label) {
		this.entries = (entr) ? entr : [];
		this.label = label;
	}

	buildIn($menu, $rootMenu, screenWidth, screenHeight) {
		for (let entry of this.entries) {
			if (entry === '-') {
				$menu.append($('<hr>'));
				continue;
			}

			let $item;
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
				entry.buildIn($sub, $rootMenu);

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

class CtxItemClass {
	constructor(label, action) {
		this.label = label;
		this.action = action;
		this.enabled = true;
	}

	setEnabled(v) {
		this.enabled = v;
		return this;
	}
}

class CtxCheckClass extends CtxItemClass {
	constructor(label, action, checked) {
		super(label, action);
		this.checked = Boolean(checked);
	}
}

function CtxMenu() {
	return new CtxMenuClass(...arguments);
}

function CtxItem() {
	return new CtxItemClass(...arguments);
}

function CtxCheck() {
	return new CtxCheckClass(...arguments);
}