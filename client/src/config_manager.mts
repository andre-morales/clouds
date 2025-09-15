import { FetchException } from "./faults.mjs";
import { RootKey } from "./utils/root_key.mjs";
import Deferred from "/@comm/dist/deferred.mjs";

export class ConfigManager {
	preferencesMgr: RootKey;
	preferences: any;

	constructor() {
		this.preferencesMgr = new RootKey("/usr/.system/preferences.json");
		this.preferences = this.preferencesMgr.getRoot();
	}

	/**
	 * Initialize the configuration system.
	 * 
	 * @returns A promise resolved when the config system is ready. If an init()
	 * call was already perform before, the returned promise is the same one.
	 */
	async init(): Promise<void> {
		const stx = this.init as { initPromise?: any };

		if (stx.initPromise)
			return stx.initPromise;

		let deferred = new Deferred();
		stx.initPromise = deferred.promise;

		// Fail silently if the file does not exist, a default empty object will be left in the
		// preferences object.
		try {
			await this.preferencesMgr.fetch();
			this.preferencesMgr.load();
		} catch(err: unknown) {
			if (!(err instanceof FetchException))
				throw err;
		}

		deferred.resolve();
	}
}
