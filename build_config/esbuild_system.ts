import * as ESBuild from 'esbuild';
import FS from 'fs';
import BrowsersList from 'browserslist';

const baseline = getBaselineTargets();

const baseConfig: ESBuild.BuildOptions = {
	logLevel: "debug",
	define: {
		'__BASELINE_CHROME__': JSON.stringify(baseline.chrome),
		'__BUILD_BASELINE_BROWSERS__': JSON.stringify(baseline)
	},
	target: getESBuildTargets()
};

var currentBaseConfig: ESBuild.BuildOptions = baseConfig;

export async function setBaseConfig(base: ESBuild.BuildOptions) {
	currentBaseConfig = mergeConfigs(baseConfig, base);
}

export async function context(config: ESBuild.BuildOptions): Promise<[ESBuild.BuildOptions, ESBuild.BuildContext]> {
	let finalConfig = mergeConfigs(currentBaseConfig, config);
	return [finalConfig, await ESBuild.context(finalConfig)];
}

export async function runBuild(contexts: Promise<[ESBuild.BuildOptions, ESBuild.BuildContext]>[], watchMode: boolean, metafileName?: string) {
	if (watchMode) {
		watchAll(contexts);
		return;
	}

	let results = await rebuildAll(contexts);

	if (metafileName) 
		await emitMeta(metafileName, results);

	await disposeAll(contexts);
	console.log("Done.");
}

async function watchAll(contexts: Promise<[ESBuild.BuildOptions, ESBuild.BuildContext]>[]) {
	contexts.forEach(async (prom) => {
		let [opt, ctx] = await prom;
		await ctx.watch();
		console.log("Watching " + opt.entryPoints);
	});
}

async function rebuildAll(contexts: Promise<[ESBuild.BuildOptions, ESBuild.BuildContext]>[]): Promise<ESBuild.BuildResult[]> {
	let rebuilds = contexts.map(prom => prom.then(ctx => ctx[1].rebuild()));
	let results = await Promise.all(rebuilds);
	console.log("Rebuilt all contexts.");
	return results;
}

async function emitMeta(fileName: string, results: ESBuild.BuildResult[]) {
	let outputText = JSON.stringify(joinBuildResults(...results));
	await FS.promises.writeFile(fileName, outputText);
	console.log("Emitted meta file.");
}

async function disposeAll(contexts: Promise<[ESBuild.BuildOptions, ESBuild.BuildContext]>[]) {
	await Promise.all(contexts.map(ctx => ctx.then((c) => c[1].dispose())));
	console.log("Finalized all contexts.");
}

export function mergeConfigs(...configs: ESBuild.BuildOptions[]) {
	// Do merge defines instead of just replacing them
	let defines = Object.assign({}, ...configs.map(c => c.define));

	// Merge all other properties
	let result = Object.assign({}, ...configs);

	result.define = defines;
	return result;
}

export async function joinMetafiles(resultFile: string, ...files: string[]) {
	let result = {
		inputs: {},
		outputs: {}
	};

	for (let file of files) {
		let fileText = await FS.promises.readFile(file);
		let obj = JSON.parse(fileText.toString());

		result = joinMeta(result, obj);
	}

	await FS.promises.writeFile(resultFile, JSON.stringify(result));
	return result;
}

function joinBuildResults(...results: ESBuild.BuildResult[]) {
	let result = {
		inputs: {},
		outputs: {}
	};
	for (let res of results) {
		if (!res.metafile) continue;

		result = joinMeta(result, res.metafile);
	}

	return result;
}

function joinMeta(...metaFiles: ESBuild.Metafile[]): ESBuild.Metafile {
	let result = {
		inputs: {},
		outputs: {}
	};

	for (let res of metaFiles) {
		Object.assign(result.inputs, res.inputs);
		Object.assign(result.outputs, res.outputs);
	}
	return result;
}

export function getBaselineTargets(): {[vendor: string]: number} {
	let targets = {};

	let browsers = BrowsersList();
	for (let browser of browsers) {
		let [vendor, version] = browser.split(' ');

		if (!targets[vendor] || targets[vendor] > Number(version))
			targets[vendor] = Number(version);
	}

	return targets;
}

function getESBuildTargets() {
	let out: string[] = [];
	const vendors = ['chrome', 'firefox', 'edge', 'safari', 'opera', 'ie'];

	let targets = getBaselineTargets();
	for (let [vendor, version] of Object.entries(targets)) {
		if (!vendors.includes(vendor))
			continue;

		out.push(vendor + version);
	}

	return out;
}

console.log("Current targets:", getESBuildTargets());