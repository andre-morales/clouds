import { RootKey } from "./root_key.mjs";

export class ConfigManager {
	preferencesMgr: RootKey;
	preferences: any;

	constructor() {
		this.preferencesMgr = new RootKey("/usr/.system/preferences.json");
		this.preferences = this.preferencesMgr.getRoot();
	}

	async init() {
		await this.preferencesMgr.fetch().then((c) => c.load());
	}
}
