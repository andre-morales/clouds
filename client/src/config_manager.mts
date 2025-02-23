import { FetchException } from "./faults.mjs";
import { RootKey } from "./utils/root_key.mjs";

export class ConfigManager {
	preferencesMgr: RootKey;
	preferences: any;

	constructor() {
		this.preferencesMgr = new RootKey("/usr/.system/preferences.json");
		this.preferences = this.preferencesMgr.getRoot();
	}

	async init() {
		// Fail silently if the file does not exist, a default empty object will be left in the
		// preferences object.
		try {
			await this.preferencesMgr.fetch();
			this.preferencesMgr.load();
		} catch(err: unknown) {
			if (!(err instanceof FetchException))
				throw err;
		}
	}
}
