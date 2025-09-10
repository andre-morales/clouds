import AppManifest, { IAppManifest } from "./app_manifest.mjs";
import { FileSystem, Paths } from "./drivers/filesystem.mjs";
import Deferred from "/@comm/dist/deferred.mjs";

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

			// Fetch cached manifest, if available
			let { result: manifestDefProm, update: manifestUpdateProm } = fetchOffline(definition.manifestUrl);
			let manifestDef = await manifestDefProm.then(r => r.json()) as IAppManifest;

			manifestDef.base = Paths.parent(definition.manifestUrl);

			// Create manifest object
			let manifest = new AppManifest(manifestDef);
			manifest.transformManifestPaths();

			// If this manifest receives updates in the future, save the promise
			manifest.updatePromise = (async () => {
				// If no update is available, have the promise return null
				let response = await manifestUpdateProm;
				if (!response)
					return null;

				// If an update is available, fetch it, parse it and save it.
				let newManifest = await response.json();
				manifest.newManifest = newManifest;
				return newManifest;
			})();		

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

function fetchOffline(url: string, init?: RequestInit): { result: Promise<Response>, update: Promise<Response>} {
	// Offline fetch. If this resouce is not in cache at all, this call will reach out online.
	let offOpt = Object.assign(init ?? {}, { cache: 'force-cache' });
	let offReq = fetch(url, offOpt);

	// Online revalidation fetch.
	let onOpt = Object.assign(init ?? {}, { cache: 'no-cache' });
	let onReq = fetch(url, onOpt);

	let deferred = new Deferred();

	Promise.all([offReq, onReq]).then(([off, on]) => {
		if (off.headers.get('etag') == on.headers.get('etag')) {
			deferred.resolve(null);
			return;
		}

		deferred.resolve(onReq);
	});
	
	return { result: offReq, update: deferred.promise };
}
