import App, { AppState } from "./app.mjs";
import AppManifest, { IAppManifest } from "./app_manifest.mjs";
import { Paths } from "./drivers/filesystem.mjs";
import Resource from "./resource.mjs";
import Objects from "./utils/objects.mjs";

interface AppResources {
	scripts: Promise<Resource[]>;
	styles: Promise<Resource[]>;
}

export async function runUrl(manifestURL: string, buildArgs = []): Promise<App> {
	try {
		// Fetch manifest
		let manifest = await getManifest(manifestURL);

		// If no app base is declared, use the manifest url folder.
		if (!manifest.base) {
			manifest.base = Paths.parent(manifestURL);
		}

		return run(manifest, buildArgs);
	} catch(err: any) {
		if (err instanceof AppInitializationError) throw err;

		throw new AppInitializationError('Failed to instantiate "' + manifestURL + '" - ' + err, err);
	}
}

export async function run(manifest: IAppManifest, buildArgs = []): Promise<App> {
	const statics = run as any;
	
	try {
		let man = new AppManifest(manifest);
		man.transformManifestPaths();

		// Start fetching of scripts, styles and modules required by this app under a temporary
		// resource user id.
		if (!statics.idCounter)
			statics.idCounter = 0;
		
		const tmpResourceUserId = 'APP-CREATOR-' + (statics.idCounter++);

		let resources = fetchAppResources(man, tmpResourceUserId);

		// Wait for all scripts to load in order to instantiate the application.
		await resources.scripts;

		// Obtain constructor function
		let AppClass = await getAppConstructor(manifest, manifest.modules);

		// Instantiate the app object with any passed arguments
		let appObj = new AppClass(manifest, buildArgs ?? []);
		let app = appObj as App;

		// Pass resources loaded to the app instance
		tieResources(resources, app, tmpResourceUserId);

		// Save the app in the running array and fire any events
		Client.runningApps.push(app);
		Client.events.dispatch('apps-add');
		app.state = AppState.ALIVE;

		// Fire the app initialization and return its instance
		await appObj.init();
		return app;
	} catch(err: any) {
		console.error("App initialization error cause: ", err);
		throw new AppInitializationError(`Failed to instantiate "${manifest.id} (${manifest.displayName ?? ""})"` + ' - ' + err, err);
	}
}

/**
 * Fetches the manifest located at the url passed and converts it do AppManifest format.
 */
async function getManifest(url: string): Promise<IAppManifest> {
	// Fetch manifest
	let fRes = await fetch(url, { cache: 'no-cache' });
	if (fRes.status == 404) {
		throw new Error('Manifest not found.');
	}
	if (fRes.status == 403) {
		throw new Error('Access denied.');
	}

	// Await for manifest
	let manifestObj = await fRes.json();
	return manifestObj as IAppManifest;
}

/**
 * Invoke the fetching of all required resources declared in the manifest. All resources will
 * be instantiated with the userId passed as the resources owner.
 */
function fetchAppResources(manifest: AppManifest, userId: string): AppResources {
	let scripts = manifest.manifest.scripts ?? [];
	let styles = manifest.manifest.styles ?? [];

	let resources: any = {};
	resources.modules = [];

	resources.scripts = Promise.all(scripts.map((url) => {
		return Client.resources.fetchScript(url + '?h=' + manifest.hash, userId);
	}));

	resources.styles = Promise.all(styles.map((url) => {
		return Client.resources.fetchStyle(url + '?h=' + manifest.hash, userId);
	}));

	return resources;
}

/**
 * Locate the App constructor either on the explicit 'builder' function on the manifest, or as the
 * default export of the first module.
 */
async function getAppConstructor(manifest: IAppManifest, modules: any): Promise<any> {
	let AppClass: any;

	// Obtain the app class declared in the manifest from the global namespace
	if (manifest.builder) {
		AppClass = Objects.getObjectByName(window, manifest.builder);
	// Obtain the app class as the default export of the first module
	} else {
		// If the app publishes an umd module in the global namespace, try to use it
		let umdModuleId: any = "AppModule_" + manifest.id;
		let umdModule: any = window[umdModuleId]
		if (umdModule && umdModule.default) {
			return umdModule.default;
		}
	}
	
	if (!AppClass) {
		throw Error('Builder unavailable.');
	}

	return AppClass;
}

/**
 * Wait for all resources to load, and replace all temporary resource user IDs with the app
 * instance itself as an user id.
 */
async function tieResources(resources: AppResources, app: App, tmpId: string) {
	let scripts = await resources.scripts;
	let styles = await resources.styles;

	for (let res of [scripts, styles].flat()) {
		// Replace the temporary user and set the app as a user of its own resources
		res.replaceUser(tmpId, app);
		app.resources.add(res);
	}
}

class AppInitializationError extends Error {
	constructor(msg: string, cause?: Error) {
		super(msg, { 'cause': cause });
		this.name = 'AppInitializationError';
	}
}

export default { run, runUrl };