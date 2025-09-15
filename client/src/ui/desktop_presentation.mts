import { ClientClass } from "../client_core.mjs";
import Desktop from "./desktop.mjs";

export default class DesktopPresentation {
	public desktop: Desktop;
	public $desktop: $Element;

	constructor(desktop: Desktop) {
		this.desktop = desktop;
		this.$desktop = $('#desktop');
	}

	public setCursor(cursor: string) {
		document.body.style.cursor = cursor;
	}

	public setPointerEvents(evs: boolean) {
		this.$desktop.find('.dt-area').toggleClass('no-pointer-events', !evs);
	}

	public reloadPreferences() {
		let prefs = ClientClass.get().config.preferences;
		
		if (prefs.background) {
			this.$desktop.css('background-image', 'url("' + prefs.background + '")');
		}
		$(document.documentElement).toggleClass('fullscreen-filter-on', Boolean(prefs.fullscreen_filter));
	}
}