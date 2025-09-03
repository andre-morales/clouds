import * as ESBuild from 'esbuild';
import Path from 'node:path';
import Chl from 'chalk';
import { log } from './system.ts';
import PostCSS from 'postcss'; 
import postcssPresetEnv from 'postcss-preset-env';
import Deferred from '../common/deferred.mts';

const PLUGIN_NAME = 'postcss-post-plugin';

interface PluginOptions {
	/*** If false, will let the files trough untouched. */
	enable?: boolean

	/*** Wrap the resulting SWC transformed code into a IIFE. */
	iife?: boolean
}

class PostCSSPlugin {
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
		if (!file.path.match(/\.css$/i))
			return;

		let ctx = new BuildContext(this.options, file, build, options);

		ctx.findInitialSourceMap();
		ctx.configurePostCSS();
		await ctx.invokePostCSS();
		ctx.attachSourceMap();
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
	private postcssPlugins: PostCSS.AcceptedPlugin[];
	private postcssEnvOptions: PostCSS.ProcessOptions;
	private postcssResult: PostCSS.Result;

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
		// For single line comments
		let matchesSL = this.file.text.match(/(?<=\/\/\s*#\s*sourceMappingURL=)[^\s]+/);
		
		// For multi-line comments
		let matchesML = this.file.text.match(/(?<=\/\*\s*#\s*sourceMappingURL=)[^\s\*]+(?=\s*\*\/)/);
		
		let matches = matchesSL ?? matchesML;
		if (!matches) {
			return { kind: 'empty'};
		}
	
		// If the source map uses a data: url, it means it's an inline
		let sourceMapRef = matches[0];
		if (sourceMapRef.startsWith('data:'))
			return { kind: 'included' };
	
		// Use the sourcemap url found to figure out the path to the map file
		let sourceMapPath = this.resolveSourceMapURL(sourceMapRef);
	
		// Try finding the map file in the output files of ESBuild
		let mapFile = this.build.outputFiles.find(v => v.path === sourceMapPath);
		if (!mapFile) {
			warn(`Couldn't find source map of "${this.file.path}" in output files.
	 Tried to look for "${sourceMapPath}" because the file contained a reference to "${sourceMapRef}".`);
			return { kind: 'empty'};
		}
	
		// If the source map file was found in the build, return it
		return { kind: 'file', file: mapFile, url: sourceMapRef };
	}

	configurePostCSS() {
		this.postcssPlugins = [
			// postcss-preset-env automatically loads .browserslistrc to detect
			// the target versions. No need to specify browsers here.
			postcssPresetEnv({})
		];

		this.postcssEnvOptions = {
			// Specifying source and destination of the compiled file is required
			// for correct sourcemap generation
			from: this.file.path,
			to: this.file.path,

			map: {
				// Pipe previous sourcemap
				prev: this.initialMap.file?.text,

				// If using inline sourcemaps, ask postcss to do so as well
				inline: this.buildOptions.sourcemap == 'inline'
			}
		};
	}

	async invokePostCSS(): Promise<PostCSS.Result> {
		const postcss = PostCSS(this.postcssPlugins);

		let deferred = new Deferred();

		// Invoke PostCSS with the calculated options. A deferred object is
		// used because the returned object is not a pure promise.
		let promise = postcss.process(this.file.text, this.postcssEnvOptions);
		promise.then(res => {
			deferred.resolve(res);
		})

		// Store PostCSS result
		this.postcssResult = await deferred.promise;
		console.log("INP:", this.file.text);
		console.log("OUT:", this.postcssResult.content);
		return this.postcssResult;
	}

	attachSourceMap() {
		if (!this.postcssResult.map)
			return;

		if (!this.initialMap.file) {
			return;
		}

		// Replace original sourcemap contents with the one generated by PostCSS
		this.initialMap.file.contents = new TextEncoder().encode(this.postcssResult.map.toString());
	}

	saveBuildResult() {
		this.file.contents = new TextEncoder().encode(this.postcssResult.css);
	}

	/**
	 * From the sourceMappingURL, resolve the url back to a local computer path.
	 */
	private resolveSourceMapURL(sourceMapRef: string) {
		return Path.join(Path.dirname(this.file.path), sourceMapRef);
	}
}

export default (options?: PluginOptions) => { 
	let plugin = new PostCSSPlugin(options);
	return {
		name: PLUGIN_NAME,
		setup: (pb: ESBuild.PluginBuild) => plugin.setup(pb)
	}
};

function warn(...args: any[]) {
	log('w', Chl.yellowBright(PLUGIN_NAME + ":"), ...args);
}