import { ClientClass } from "../client_core.mjs";
import Browser from "../utils/browser.mjs";

const THEMES_PATH = '/res/pack/styles/themes/';
const DEFAULT_THEME = 'default';

export default class ThemeManager {
	constructor() {}

	public async init() {
		// Await configuration loaded
		const config = ClientClass.get().config;
		await config.init();		

		config.preferencesMgr.observeProperty('theme', (theme) => {
			this.useTheme(theme as string);	
		});

		// Load configured theme if setup.
		let theme = config.preferences.theme;
		if (theme) {
			try {
				await this.setTheme(theme);
				return;
			} catch {}
		}

		// If theme loading fails on startup, use the default theme.
		await this.useDefaultTheme();
	}

	private async useTheme(theme: string) {
		if (theme) {
			try {
				await this.setTheme(theme);
				return;
			} catch {}
		}
	}

	private async useDefaultTheme() {
		await this.setTheme(DEFAULT_THEME);
	}

	private async setTheme(theme: string) {
		// Add stylesheet for the specified theme.
		let resource = Browser.addStylesheet(`${THEMES_PATH}${theme}.css`);

		try {
			await resource.promise;
		} catch (err) {
			console.log(err);

			// If the theme fails to load, the current theme will remain active, but we will
			// remove this node.
			resource.element.remove();

			ClientClass.get().watson.showErrorDialog("Theme", "Theme " + theme + " failed to load.", err)
			throw err;
		}

		// If the theme loaded successfully, remove the old system theme, and mark the new one
		// as current.
		$('.system-theme-style').remove();
		resource.element.classList.add('system-theme-style');
	}
}