import { AppManifest } from "./app.mjs";
import Resource from "./resource.mjs";
import { getObjectByName } from "./util.mjs";

interface AppResources {
	scripts: Promise<Resource>[];
	modules: Promise<Resource>[];
	styles: Promise<Resource>[];
}

async function runAppFetch(manifestURL: string, buildArgs?: unknown[]) {
	try {
		// Fetch manifest
		let manifest = await getManifest(manifestURL);

		// Start fetching of scripts, styles and modules required by this app under a temporary
		// resource user id.
		const tmpResourceUserId = 'APP-CREATOR';
		let resources = fetchAppResources(manifest, tmpResourceUserId);

		// Wait for all scripts to load and save the resource objects.
		// We don't wait for the styles to load since most of the time, its not necessary
		let loadedModuleResources = await Promise.all(resources.modules);
		let loadedScriptResources = await Promise.all(resources.scripts);

		// Obtain constructor function
		let AppClass = await getAppConstructor(manifest, manifest.modules);

		// Instantiate the app object with any passed arguments
		let app = new AppClass(manifest, buildArgs ?? []);

		// Replace the temporary user and set the app as a user of its own script resources
		for (let res of loadedModuleResources) {
			res.replaceUser(tmpResourceUserId, app);
		}

		for (let res of loadedScriptResources) {
			res.replaceUser(tmpResourceUserId, app);
		}

		// Once a style its loaded, we should replace the temporary user with the app object.
		for (let promise of resources.styles) {
			promise.then((res) => {
				res.replaceUser(tmpResourceUserId, app);
			});
		}

		// Save the app in the running array and fire any events
		Client.runningApps.push(app);
		Client.dispatch('apps-add');
		app.state = 'alive';

		// Fire the app initialization and return its instance
		await app.init();
		return app;
	} catch(err) {
		throw new AppInitializationError('Failed to instantiate "' + manifestURL + '" - ' + err, err);
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

	resources.modules = modules.map((url) => {
		return Client.resourceMan.fetchModule(url, userId);
	});

	resources.scripts = scripts.map((url) => {
		return Client.resourceMan.fetchScript(url, userId);
	});

	resources.styles = styles.map((url) => {
		return Client.resourceMan.fetchStyle(url, userId);
	});

	return resources;
}

/**
 * Locate the App constructor either on the explicit 'builder' function on the manifest, or as the
 * default export of the first module.
 */
async function getAppConstructor(manifest: AppManifest, modules: any): Promise<any> {
	let AppClass: any;

	// Obtain the app class declared in the manifest from the global namespace
	if (manifest.builder) {
		AppClass = getObjectByName(manifest.builder);
	// Obtain the app class as the default export of the first module
	} else {
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

class AppInitializationError extends Error {
	constructor(msg: string, cause?: Error) {
		super(msg, { 'cause': cause });
		this.name = 'AppInitializationError';
	}
}

export { runAppFetch };