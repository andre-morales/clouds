import App, { AppManifest } from "./app.mjs";
import Resource from "./resource.mjs";
import Objects from "./utils/objects.mjs";

interface AppResources {
	scripts: Promise<Resource[]>;
	modules: Promise<Resource[]>;
	styles: Promise<Resource[]>;
}

export async function runUrl(manifestURL: string, buildArgs = []): Promise<App> {
	try {
		// Fetch manifest
		let manifest = await getManifest(manifestURL);

		return run(manifest, buildArgs);
	} catch(err: any) {
		if (err instanceof AppInitializationError) throw err;

		throw new AppInitializationError('Failed to instantiate "' + manifestURL + '" - ' + err, err);
	}
}

export async function run(manifest: AppManifest, buildArgs = []): Promise<App> {
	try {
		// Start fetching of scripts, styles and modules required by this app under a temporary
		// resource user id.
		const tmpResourceUserId = 'APP-CREATOR';
		let resources = fetchAppResources(manifest, tmpResourceUserId);

		// Wait for all scripts and modules to load in order to instantiate the application.
		await resources.modules;
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
		app.state = 'alive';

		// Fire the app initialization and return its instance
		await appObj.init();
		return app;
	} catch(err: any) {
		throw new AppInitializationError(`Failed to instantiate "${manifest.id} (${manifest.displayName ?? ""})"` + ' - ' + err, err);
	}
}

/**
 * Fetches the manifest located at the url passed and converts it do AppManifest format.
 */
async function getManifest(url: string): Promise<AppManifest> {
	// Fetch manifest
	let fRes = await fetch(url);
	if (fRes.status == 404) {
		throw new Error('Manifest not found.');
	}
	if (fRes.status == 403) {
		throw new Error('Access denied.');
	}

	// Await for manifest
	let manifestObj = await fRes.json();
	return manifestObj as AppManifest;
}

/**
 * Invoke the fetching of all required resources declared in the manifest. All resources will
 * be instantiated with the userId passed as the resources owner.
 */
function fetchAppResources(manifest: AppManifest, userId: string): AppResources {
	let modules = manifest.modules ?? [];
	let scripts = manifest.scripts ?? [];
	let styles = manifest.styles ?? [];

	let resources: any = {};

	resources.modules = Promise.all(modules.map((url) => {
		return Client.resources.fetchModule(url, userId);
	}));

	resources.scripts = Promise.all(scripts.map((url) => {
		return Client.resources.fetchScript(url, userId);
	}));

	resources.styles = Promise.all(styles.map((url) => {
		return Client.resources.fetchStyle(url, userId);
	}));

	return resources;
}

/**
 * Locate the App constructor either on the explicit 'builder' function on the manifest, or as the
 * default export of the first module.
 */
async function getAppConstructor(manifest: AppManifest, modules: any): Promise<any> {
	let AppClass: any;

	//let builder = window["AppModule_" + manifest.id].default;
	//return builder;

	// Obtain the app class declared in the manifest from the global namespace
	if (manifest.builder) {
		AppClass = Objects.getObjectByName(manifest.builder);
	// Obtain the app class as the default export of the first module
	} else {
		// If the app publishes an umd module in the global namespace, try to use it
		let umdModuleId: any = "AppModule_" + manifest.id;
		let umdModule: any = window[umdModuleId]
		if (umdModule && umdModule.default) {
			return umdModule.default;
		}

		// If the app has ES modules, use the default export of the first one
		if (modules.length < 1) {
			throw Error('Undisclosed builder and no modules declared.');
		}

		// Import first module and use its default export.
		let moduleName = modules[0];
		let namespace = await IMPORT(moduleName);
		AppClass = namespace.default;
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
	let modules = await resources.modules;
	let scripts = await resources.scripts;
	let styles = await resources.styles;

	for (let res of [modules, scripts, styles].flat()) {
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