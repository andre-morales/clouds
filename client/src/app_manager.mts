import AppManifest, { IAppManifest } from "./app_manifest.mjs";
import { FileSystem, Paths } from "./drivers/filesystem.mjs";

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
	private manifests: Map<string, AppManifest>;
	private definitions: Map<string, AppDefinition>;
	private appDeclarations: { [id: string]: AppDeclaration };

	public constructor() {
		this.manifests = new Map();
		this.definitions = new Map();
		this.appDeclarations = {};
	}

	public async init() {
		// Fetch app definitions from the user profile, if available
		try {
			this.appDeclarations = await FileSystem.readJson('/usr/.system/apps.json');
		} catch {}

		// Remove disabled apps
		for (let app of Object.keys(this.appDeclarations)) {
			if (app.startsWith('-')) delete this.appDeclarations[app];
		}

		let promises = Object.keys(this.appDeclarations).map(async appId => {
			const decl = this.appDeclarations[appId];

			// Construct definition from config declaration
			let definition = {} as AppDefinition;
			definition.id = appId;
			definition.displayName = decl.name ?? appId;
			definition.manifestUrl = decl.manifestUrl ?? ('/app/' + appId + '/manifest.json');
			definition.flags = decl.flags ?? [];

			// Add to definitions map
			this.definitions.set(appId, definition);

			// Fetch manifest
			let manifestDefProm = await fetch(definition.manifestUrl, { cache: 'no-cache' });
			let manifestDef = await manifestDefProm.json() as IAppManifest;
			manifestDef.base = Paths.parent(definition.manifestUrl);

			// Create manifest object
			let manifest = new AppManifest(manifestDef);
			manifest.transformManifestPaths();

			// Store manifest
			this.manifests.set(appId, manifest);
		});

		await Promise.all(promises);
	}

	public getAppEntries() {
		return this.definitions.entries();
	}

	public getAppManifest(id: string) {
		return this.manifests.get(id);
	}

	public getDefaultAppIcon(): Icon {
		return { url: '/res/img/app64.png', type: 'image/png', size: 64 };
	}
}