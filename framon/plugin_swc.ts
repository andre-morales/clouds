import * as ESBuild from 'esbuild';
import * as SWC from '@swc/core';
import Chl from 'chalk';
import { getBaselineTargets } from './targets.ts';
import { log } from './system.ts';
import findESBuildSourceMap, { type InitialSourceMap } from './find_sourcemap.ts';
const PLUGIN_NAME = 'swc-post-plugin';

interface PluginOptions {
	/*** If false, will let the files trough untouched. */
	enable?: boolean

	/*** Wrap the resulting SWC transformed code into a IIFE. */
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
				log('w', Chl.magenta(PLUGIN_NAME) + Chl.yellow(`: No output files found. No processing will be done. Make sure to set ${Chl.green("write: false")} in your ESBuild options.`));
				return;
			}

			if ((['both', 'external'] as any).includes(build.initialOptions.sourcemap)) {
				log('w', Chl.magenta(PLUGIN_NAME) + Chl.yellow(`: Sourcemap mode "${build.initialOptions.sourcemap}" not supported. No processing will be done.`));
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
		this.initialMap = findESBuildSourceMap(this.file, this.build.outputFiles);
	}

	configureSWC() {
		// Read browserslist file and join entries into a single string
		const browserList = Object.entries(getBaselineTargets()).map(e => e[0] + ' ' + e[1]).join(',');

		const options: SWC.Options = {
			env: {
				targets: browserList,
			},
			jsc: {
				// Reasonable difference of around 10% code size.
				assumptions: {
					setPublicClassFields: true,
					setClassMethods: true,
					noDocumentAll: true,
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
			// For 'inline' or 'both' map generation, let swc find the sourcemap embedded in the file,
			// and have it generate the source map object as well.
			case 'inline':
			case 'both':
				options.sourceMaps = true;
				options.inputSourceMap = true;
				break;
			// For all other map generations, a separate map file will be generated. We'll feed
			// swc with the source map file we found earlier.
			case 'linked':
			case 'external':
				options.sourceMaps = true;

				if (!this.initialMap.file) {
					warn("Configure warning! Initial sourcemap of " + this.file.path + " missing.");
					break;
				}

				options.inputSourceMap = this.initialMap.file?.text;
				break;
		}

		this.swcOptions = options;
	}

	async invokeSWC(): Promise<SWC.Output> {
		// Invoke SWC
		const result = await SWC.transform(this.file.text, this.swcOptions);
		
		// Wrap resulting SWC transform into a IIFE.
		if (this.pluginOptions.iife) {
			result.code = `(function(){\n${result.code}\n})();`;

			// Insert a single ; as the first mapping. This has the effect of shifting all mappings
			// down by one line, fixing the addition of the "(function() {" line above.
			if (result.map)
				result.map = result.map.replace(',"mappings":"', ',"mappings":";');
		}

		// If the source map configuration is one these, we'll have to modify the source file
		// to either link the path to the source map, or include it directly
		if ((['inline', 'linked', 'both'] as any).includes(this.buildOptions.sourcemap)) {
			// Remove the original sourceMapUrl line from file
			let i1 = result.code.indexOf("//# sourceMappingURL=");
			let i2 = result.code.indexOf("\n", i1);
			if (i1 != -1)
				result.code = result.code.slice(0, i1) + result.code.slice(i2);
		}

		// Warn if swc did not generate a sourcemap.
		if (!result.map) {
			log('w', `Invoke warning! swc did not generate a source map for "${this.file.path}".`);
		}

		// Based on the source map configuration specified, we might need to inject a string on
		// the resulting code.
		switch(this.buildOptions.sourcemap) {
			// Inject in the compiled code result a link to the source map we will emit separately.
			case 'linked':
				result.code += '\n//# sourceMappingURL=' + this.initialMap.url;
				break;
			// Inject in the compiled code the encoded source map.
			case 'inline':
			case 'both':
				let encodedData = Buffer.from(result.map as any).toString('base64');
				result.code += "//# sourceMappingURL=data:application/json;base64," + encodedData;
				break;
		}

		this.swcResult = result;
		return result;
	}

	attachSourceMap() {
		switch(this.buildOptions.sourcemap) {
			// For all settings that emit a .map file, replace the original .map file that was
			// going to be emitted with new contents.
			case 'linked':
			case 'external':
			case 'both':
				if (!this.initialMap.file) {
					warn('Attachment warning! Initial sourcemap of "' + this.file.path + '" missing.')
					return;
				}

				this.initialMap.file.contents = new TextEncoder().encode(this.swcResult.map);
				break;
		}
	}

	saveBuildResult() {
		// Replace the original ESBuild result with SWC's resulting code.
		this.file.contents = new TextEncoder().encode(this.swcResult.code);
	}
}

export default (options?: PluginOptions) => { 
	let plugin = new SWCPostPlugin(options);
	return {
		name: PLUGIN_NAME,
		setup: (pb: ESBuild.PluginBuild) => plugin.setup(pb)
	}
};

function warn(...args) {
	log('w', Chl.yellowBright(PLUGIN_NAME + ":"), ...args);
}