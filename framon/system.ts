import * as ESBuild from 'esbuild';
import FS from 'fs';
import { getBaselineTargets, getESBuildTargets } from './targets.ts';
import Chalk from 'chalk';
import Path from 'node:path';

const baseline = getBaselineTargets();

const baseConfig: ESBuild.BuildOptions = {
	logLevel: "debug",
	define: {
		'__BASELINE_CHROME__': JSON.stringify(baseline.chrome),
		'__BUILD_BASELINE_BROWSERS__': JSON.stringify(baseline)
	},
	target: getESBuildTargets(),
};

var currentBaseConfig: ESBuild.BuildOptions = baseConfig;

/**
 * Set a base configuration all entry points will use. context() builders can override the
 * properties defined in the base configuration.
 * @param base The ESBuild configuration to use as a base.
 */
export async function setBaseConfig(base: ESBuild.BuildOptions) {
	currentBaseConfig = mergeConfigs(baseConfig, base);
}

/**
 * Define a new ESBuild build context with the specified options.
 * @param config The ESBuild configuration for this context.
 * @returns A promise to a pair [options, context]. The return options object is the true config
 * passed to ESBuild, after it was merged with the base options. The context object is the ESBuild
 * context.
 */
export async function context(config: ESBuild.BuildOptions): Promise<[ESBuild.BuildOptions, ESBuild.BuildContext]> {
	let finalConfig = mergeConfigs(currentBaseConfig, config);
	return [finalConfig, await ESBuild.context(finalConfig)];
}

/**
 * Builds (or watches) all contexts passed. Optionally emitting a meta file.
 * @param contexts The contexts to build, in the same format as returned by the context() call.
 * @param watchMode Whether these contexts should be built or watched
 * @param metafileName If specified, will emit a meta file that is the merged result of the meta
 * of all contexts. This option is ignored in watch mode.
 */
export async function runBuild(contexts: Promise<[ESBuild.BuildOptions, ESBuild.BuildContext]>[], watchMode: boolean, metafileName?: string): Promise<void> {
	if (watchMode) {
		watchAll(contexts);
		return;
	}

	const start = performance.now();
	
	let results = await rebuildAll(contexts);
	
	// Write files when write: false
	await writeAllResults(results);

	if (metafileName) 
		await emitMeta(metafileName, results);

	await disposeAll(contexts);

	let timeElapsed = (performance.now() - start) / 1000.0;
	log('s', `Done in ${timeElapsed.toFixed(2)}s.`);
}

/**
 * Watch all the specified context for modifications, and rebuild them as necessary.
 * @param contexts The context objects as passed from the context() call.
 */
async function watchAll(contexts: Promise<[ESBuild.BuildOptions, ESBuild.BuildContext]>[]) {
	contexts.forEach(async (prom) => {
		let [opt, ctx] = await prom;
		await ctx.watch();
		log('i', "Watching " + opt.entryPoints);
	});
}

async function rebuildAll(contexts: Promise<[ESBuild.BuildOptions, ESBuild.BuildContext]>[]): Promise<ESBuild.BuildResult[]> {
	let rebuilds = contexts.map(prom => prom.then(ctx => ctx[1].rebuild()));
	let results = await Promise.all(rebuilds);
	log('i', "Rebuilt all contexts.");
	return results;
}

async function writeAllResults(results: ESBuild.BuildResult[]) {
	let promises: Promise<void>[] = [];

	for (let result of results) {
		if (!result.outputFiles) continue;

		for (let file of result.outputFiles) {
			let promise = FS.promises.writeFile(file.path, file.text);
			promises.push(promise);
		};
	};

	await Promise.all(promises);
}

async function emitMeta(fileName: string, results: ESBuild.BuildResult[]) {
	let outputText = JSON.stringify(joinBuildResults(...results));
	await writeFileEnsureDir(fileName, outputText);
	log('i', `Emitted meta file "${Chalk.yellow(fileName)}"`);
}

async function disposeAll(contexts: Promise<[ESBuild.BuildOptions, ESBuild.BuildContext]>[]) {
	await Promise.all(contexts.map(ctx => ctx.then((c) => c[1].dispose())));
	log('i', "Finalized all contexts.");
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

	await writeFileEnsureDir(resultFile, JSON.stringify(result));
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

export function log(type: 'i' | 'w' | 'e' | 's', ...msg: any) {
	switch(type) {
		case 'i': console.log(Chalk.bgBlueBright.bold.white(' Framon '), ...msg); break;
		case 'w': console.log(Chalk.bgYellowBright.bold.white(' Framon '), ...msg); break;
		case 'e': console.log(Chalk.bgRedBright.bold.white(' Framon '), ...msg); break;
		case 's': console.log(Chalk.bgGreenBright.bold.white(' Framon '), ...msg); break;
	}
}

/**
 * Write a file ensuring the directories along the way exist.
 * @param path Path to the file.
 * @param contents Buffer of context.
 */
export async function writeFileEnsureDir(path: string, contents: string | Uint8Array) {
	let dir = Path.dirname(path);
	let exists = true;
	try {
		await FS.promises.access(dir);
	} catch {
		exists = false;
	}

	if (!exists) {
		await FS.promises.mkdir(dir, { recursive: true });
	}

	await FS.promises.writeFile(path, contents);
}


export default { log }

log('i', "ESBuild targets:", getESBuildTargets());