import * as ESBuild from 'esbuild';
import FS from 'fs';

var baseConfig: ESBuild.BuildOptions = {
	logLevel: "debug"
};

export async function setBaseConfig(base: ESBuild.BuildOptions) {
	Object.assign(baseConfig, base);
}

export async function context(config: ESBuild.BuildOptions): Promise<[ESBuild.BuildOptions, ESBuild.BuildContext]> {
	let finalConfig = Object.assign(config, baseConfig);
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
	let outputText = JSON.stringify(joinResults(...results));
	await FS.promises.writeFile(fileName, outputText);
	console.log("Emitted meta file.");
}

async function disposeAll(contexts: Promise<[ESBuild.BuildOptions, ESBuild.BuildContext]>[]) {
	await Promise.all(contexts.map(ctx => ctx.then((c) => c[1].dispose())));
	console.log("Finalized all contexts.");
}

function joinResults(...results: ESBuild.BuildResult[]) {
	let result = {
		inputs: {},
		outputs: {}
	};
	for (let res of results) {
		if (!res.metafile) continue;

		Object.assign(result.inputs, res.metafile.inputs);
		Object.assign(result.outputs, res.metafile.outputs);
	}

	return result;
}
