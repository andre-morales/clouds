import Desktop from "../../desktop.mjs";
import { ContextMenu } from "./ctx_menu.mjs";

export default class ContextMenuDesktopController {
	private desktop: Desktop;
	private contextMenuOpen: boolean;
	private currentContextMenu: ContextMenu;
	private $contextMenu: $Element;

	constructor(desktop: Desktop) {
		this.desktop = desktop;
		this.contextMenuOpen = false;
		this.$contextMenu = $('.context-menu');

		$(document).on('mousedown', (ev) => {
			let $cMenu = this.$contextMenu;
			let el = ev.target as HTMLElement;

			// If the context menu *is not* and *does not contain*
			// the clicked element.
			if ($cMenu[0] != el && $cMenu.has(el).length === 0) {
				this.contextMenuOpen = false;
				this.currentContextMenu = null;
				$cMenu.removeClass('visible');
				$cMenu.find('.context-menu').removeClass('visible');
			}
		});
	}

	addCtxMenuOn(element: HTMLElement | $Element, menuFn: (ev: MouseEvent) => ContextMenu) {
		$(element).on('contextmenu', (ev: MouseEvent) => {
			let mx = ev.clientX, my = ev.clientY;
	
			let menu = menuFn(ev);
			if (menu) {
				this.openCtxMenuAt(menu, mx, my);
				ev.preventDefault();
				return false;
			}
		});
	}

	openCtxMenuAt(menu: ContextMenu, x: number, y: number) {
		if (this.currentContextMenu) {
			this.currentContextMenu.close();
		}
		this.currentContextMenu = menu;
		
		this.contextMenuOpen = true;
		let $menu = this.$contextMenu;
		$menu.removeClass('.visible');
		$menu.empty();
		menu._setBase($menu)
		menu._build();

		$menu.addClass('visible');
		let mWidth = $menu[0].offsetWidth;
		let mHeight = $menu[0].offsetHeight;

		let [screenWidth, screenHeight] = this.desktop.getDesktopSize();

		if (x + mWidth > screenWidth) x -= mWidth;
		if (x < 0) x = 0;

		if (y + mHeight > screenHeight) y -= mHeight;
		if (y < 0) y = 0;

		$menu.css('left', x);
		$menu.css('top', y);
	}
}