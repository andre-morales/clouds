import * as ESBuild from 'esbuild';
import * as SWC from '@swc/core';
import Path from 'node:path';
import { getBaselineTargets } from './esbuild_system.ts';

const PLUGIN_NAME = 'swc-post-plugin';

interface PluginOptions {
	/*** If false, will let the files trough untouched. */
	enable?: boolean

	/*** Wrap the resulting SWC transformed code into a IIFE. This will break source maps (for now.) */
	iife?: boolean
}

class SWCPostPlugin {
	private options: PluginOptions;

	constructor(options?: PluginOptions) {
		this.options = options ?? {};
	}

	setup(build: ESBuild.PluginBuild) {
		build.onEnd(async (result) => {
			if (this.options.enable === false)
				return;

			if (!result.outputFiles) {
				warn('No output files found. No processing will be done. Make sure to set write: false in your ESBuild options.');
				return;
			}

			if ((['both', 'external'] as any).includes(build.initialOptions.sourcemap)) {
				warn('Source map modes "both" and "external" not yet supported.');
				return;
			}

			await Promise.all(result.outputFiles.map((file) => { 
				return this.processFile(file, result, build.initialOptions);
			}));
		});
	}

	async processFile(file: ESBuild.OutputFile, build: ESBuild.BuildResult, options: ESBuild.BuildOptions) {
		if (!file.path.match(/\.(m|c)?js$/i))
			return;

		let ctx = new BuildContext(this.options, file, build, options);

		// Find the source map for this output file
		ctx.findInitialSourceMap();

		// Setup SWC configuration
		ctx.configureSWC();

		// Invoke SWC
		await ctx.invokeSWC();

		// Attach the new sourcemap to the output.
		ctx.attachSourceMap();

		// Save SWC build result to file
		ctx.saveBuildResult();
	}
}

interface InitialSourceMap {
	kind: 'empty' | 'included' | 'file',
	file?: ESBuild.OutputFile,
	url?: string
}

class BuildContext {
	private readonly pluginOptions: PluginOptions;
	private readonly file: ESBuild.OutputFile;
	private readonly build: ESBuild.BuildResult;
	private readonly buildOptions: ESBuild.BuildOptions;

	private initialMap: InitialSourceMap;
	private swcOptions: SWC.Options;
	private swcResult: SWC.Output;

	constructor(pluginOptions: PluginOptions, file: ESBuild.OutputFile, build: ESBuild.BuildResult, buildOptions: ESBuild.BuildOptions) {
		this.pluginOptions = pluginOptions;
		this.file = file;
		this.build = build;
		this.buildOptions = buildOptions;
	}

	findInitialSourceMap() {
		this.initialMap = this.getInitialSourceMap();
	}

	private getInitialSourceMap(): InitialSourceMap {
		if (!this.build.outputFiles) 
			return { kind: 'empty'};

		// Find the reference to a source map in the output file, if there is one
		let matches = this.file.text.match(/(?<=\/\/#\s*sourceMappingURL=)[^\s]+/);
		if (!matches)
			return { kind: 'empty'};
	
		// If the source map uses a data: url, it means it's an inline
		let sourceMapRef = matches[0];
		if (sourceMapRef.startsWith('data:'))
			return { kind: 'included' };
	
		// Use the sourcemap url found to figure out the path to the map file
		let sourceMapPath = this.resolveSourceMapURL(sourceMapRef);
	
		// Try finding the map file in the output files of ESBuild
		let mapFile = this.build.outputFiles.find(v => v.path === sourceMapPath);
		if (!mapFile) {
			console.warn(`Couldn't find source map of "${this.file.path}" in output files.
				Tried to look for "${sourceMapPath}" because the file contained a reference to "${sourceMapRef}".`);
			return { kind: 'empty'};
		}
	
		// If the source map file was found in the build, return it
		return { kind: 'file', file: mapFile, url: sourceMapRef };
	}

	configureSWC() {
		// Read browserslist file and join entries into a single string
		const browserList = Object.entries(getBaselineTargets()).map(e => e[0] + ' ' + e[1]).join(',');

		const options: SWC.Options = {
			env: {
				targets: browserList,
			},
			jsc: {
				assumptions: {
					// -- Reasonable difference of 10% code size.
					setPublicClassFields: true,
					setClassMethods: true,
					noDocumentAll: true,

					// -- Little difference
					/*
					setSpreadProperties: true,
					ignoreFunctionName: true,
					ignoreFunctionLength: true,
					mutableTemplateObject: true,
					noClassCalls: true,
					superIsCallableConstructor: true,
					arrayLikeIsIterable: true,
					constantReexports: true,
					enumerableModuleMeta: true,
					noIncompleteNsImportDetection: true,
					noNewArrows: true,
					setComputedProperties: true,
					skipForOfIteratorClosing: true,
					privateFieldsAsProperties: true,
					constantSuper: true,
					pureGetters: true,
					objectRestNoSymbols: true,
					ignoreToPrimitiveHint: true,*/
					
					// -- Makes builds non functional
					//iterableIsArray: true
				}
			},
			module: {
				type: 'commonjs',
				// Emit 'use strict' directive.
				strict: true
			}
		};

		// Toggle minification if desired
		if (this.buildOptions.minify) {
			options.minify = true;
			options.jsc!.minify = {
				compress: true,
				mangle: true
			}
		}

		// Based on ESBuild's source map generation config, determine SWC's.
		switch(this.buildOptions.sourcemap) {
			// For inline map generation, let swc include the sourcemap in the file right away.
			// Also let it find it in the input code.
			case 'inline':
				options.inputSourceMap = true;	
				options.sourceMaps = 'inline';
				break;
			// For 'both' map generation, let swc find the sourcemap embedded in the file, but have
			// it generate the source map object as well.
			case 'both':
				options.inputSourceMap = true;
				options.sourceMaps = true;
				break;
			// For all other map generations, a separate map file will be generated. We'll feed
			// swc with the source map file we found earlier.
			case 'linked':
			case 'external':
				if (!this.initialMap.file)
					throw new Error("Initial source map for " + this.file.path + " was not found.");

				options.inputSourceMap = this.initialMap.file?.text;
				options.sourceMaps = true;
				break;
		}

		this.swcOptions = options;
	}

	async invokeSWC(): Promise<SWC.Output> {
		// Invoke SWC
		const swcResult = await SWC.transform(this.file.text, this.swcOptions);
		
		// Wrap resulting SWC transform into a IIFE.
		if (this.pluginOptions.iife) {
			swcResult.code = `(function(){\n${swcResult.code}\n})();`;
		}

		// Based on the source map configuration specified, we might need to inject a string on
		// the resulting code.
		switch(this.buildOptions.sourcemap) {
			// Inject in the compiled code result a link to the source map we will emit separately.
			case 'linked':
				swcResult.code += '\n//# sourceMappingURL=' + this.initialMap.url;
				break;
			// Inject in the compiled code the encoded source map.
			case 'both':
				if (!swcResult.map)
					throw new Error("swc did not generate a source map to encode.");

				let encodedData = Buffer.from(swcResult.map).toString('base64');
				swcResult.code += "//# sourceMappingURL=data:application/json;base64," + encodedData;
				break;
		}

		this.swcResult = swcResult;
		return swcResult;
	}

	attachSourceMap() {
		switch(this.buildOptions.sourcemap) {
			// For all settings that emit a .map file, replace the original .map file that was
			// going to be emitted with new contents.
			case 'linked':
			case 'external':
			case 'both':
				if (!this.initialMap.file)
					throw new Error('Initial map for "' + this.file + '" not found.');

				this.initialMap.file.contents = new TextEncoder().encode(this.swcResult.map);
				break;
		}
	}

	saveBuildResult() {
		// Replace the original ESBuild result with SWC's resulting code.
		this.file.contents = new TextEncoder().encode(this.swcResult.code);
	}

	/**
	 * From the sourceMappingURL, resolve the url back to a local computer path.
	 */
	private resolveSourceMapURL(sourceMapRef: string) {
		return Path.join(Path.dirname(this.file.path), sourceMapRef);
	}
}

function warn(...args: any[]) {
	console.error(`\x1b[35m${PLUGIN_NAME}:\x1b[33m`, ...args, '\x1b[0m');
}

export default (options?: PluginOptions) => { 
	let plugin = new SWCPostPlugin(options);
	return {
		name: PLUGIN_NAME,
		setup: (pb: ESBuild.PluginBuild) => plugin.setup(pb)
	}
};
