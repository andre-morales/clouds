import { FileSystem } from "./bridges/filesystem.mjs";

interface Icon {
	url: string;
	type: string;
	size: number;
}

interface AppDefinition {
	id: string;
	displayName: string;
	manifestUrl: string;
	flags: string[];
	icons: Icon[];
}

export class AppManager {
	definitions: Map<string, AppDefinition>;
	/** @deprecated Use app entries instead. */
	allDeclarations: any;
	#appDeclarations: any;

	constructor() {
		this.definitions = new Map();
	}

	async init() {
		// Fetch app definitions from the user profile
		this.#appDeclarations = await FileSystem.readJson('/usr/.system/apps.json');
		this.allDeclarations = this.#appDeclarations;

		// Remove disabled apps
		for (let app of Object.keys(this.#appDeclarations)) {
			if (app.startsWith('-')) delete this.#appDeclarations[app];
		}

		for (let [appId, declaration] of Object.entries(this.#appDeclarations)) {
			let decl: any = declaration;

			// Construct definition from config declaration
			let definition = {} as AppDefinition;
			definition.id = appId;
			definition.displayName = decl.name ?? appId;
			definition.manifestUrl = decl.manifestUrl ?? ('/app/' + appId + '/manifest.json');
			definition.flags = decl.flags ?? [];
			if (decl.icon) {
				definition.icons = [{ url: decl.icon, type: 'image/', size: 0 }];
			} else {
				definition.icons = [this.getDefaultIcon()];
			}

			// Add to definitions map
			this.definitions.set(appId, definition);
		}
	}

	getAppEntries() {
		return this.definitions.entries();
	}

	getDefaultIcon(): Icon {
		return { url: '/res/img/app64.png', type: 'image/png', size: 64 };
	}
}