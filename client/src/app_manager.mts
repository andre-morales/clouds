import { FileSystem } from "./drivers/filesystem.mjs";

export interface AppDefinition {
	id: string;
	displayName: string;
	manifestUrl: string;
	flags: string[];
	icons: Icon[];
	getIcon: (size: number) => Icon;
}

interface Icon {
	url: string;
	type: string;
	size: number;
}

interface AppDeclaration {
	name?: string;
	manifestUrl?: string;
	flags?: string[];
	icon?: string;
}

export class AppManager {
	#definitions: Map<string, AppDefinition>;
	#appDeclarations: any;

	constructor() {
		this.#definitions = new Map();
	}

	async init() {
		// Fetch app definitions from the user profile
		this.#appDeclarations = await FileSystem.readJson('/usr/.system/apps.json');

		// Remove disabled apps
		for (let app of Object.keys(this.#appDeclarations)) {
			if (app.startsWith('-')) delete this.#appDeclarations[app];
		}

		for (let [appId, decl_] of Object.entries(this.#appDeclarations)) {
			let decl = decl_ as AppDeclaration;

			// Construct definition from config declaration
			let definition = {} as AppDefinition;
			definition.id = appId;
			definition.displayName = decl.name ?? appId;
			definition.manifestUrl = decl.manifestUrl ?? ('/app/' + appId + '/manifest.json');
			definition.flags = decl.flags ?? [];
			if (decl.icon) {
				definition.icons = [{ url: decl.icon, type: 'image/', size: 0 }];
			} else {
				definition.icons = [this.getDefaultAppIcon()];
			}

			definition.getIcon = (size) => {
				let bestMatch = definition.icons[0];

				for (let i = 1; i < definition.icons.length; i++) {
					let icon = definition.icons[i];

					// If we found an exact size match
					if (bestMatch.size == size) break;

					// If our best match is smaller than we need, grow it if the icon is bigger
					else if (bestMatch.size < size) {
						if (icon.size > bestMatch.size) {
							bestMatch = icon;
						}

					// If our best match is bigger than we need, reduce it only if the icon first
					// our purposes.
					} else if (bestMatch.size > size){
						if (icon.size < bestMatch.size && icon.size >= size) {
							bestMatch = icon;
						}
					}
				}

				return bestMatch;
			};

			// Add to definitions map
			this.#definitions.set(appId, definition);
		}
	}

	getAppEntries() {
		return this.#definitions.entries();
	}

	getDefaultAppIcon(): Icon {
		return { url: '/res/img/app64.png', type: 'image/png', size: 64 };
	}
}