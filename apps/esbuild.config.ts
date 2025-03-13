import * as ESBuild from 'esbuild';
import Path from 'path';
import * as Glob from 'glob';
import swcTransformPlugin from '../build_config/esbuild_plugin_post_swc.ts';
import writerPlugin from '../build_config/esbuild_plugin_output_writer.ts';
import { sassPlugin as Sass } from 'esbuild-sass-plugin';
import { context, runBuild, setBaseConfig } from '../build_config/esbuild_system.ts';

const developmentMode = Boolean(process.env.DEV_MODE);
const watchMode = Boolean(process.env.WATCH_MODE);
const emitMetafile = true;

const baseConfig: ESBuild.BuildOptions = {
	bundle: true,
	external: ['*.png'],
	format: 'iife',
	minify: !developmentMode,
	sourcemap: developmentMode ? 'inline' : 'linked',
	define: {
		'__BUILD_MODE__': `'${developmentMode ? 'Development' : 'Production'}'`
	},
	metafile: emitMetafile,
	plugins: [ Sass({ embedded: true }), swcTransformPlugin({ iife: true }), writerPlugin()],
	target: ['esnext'],
	write: false,
	// Specify a separate tsconfig.json to prevent bundling client modules
	tsconfig: './apps/build.tsconfig.json'
};

function main() {
	setBaseConfig(baseConfig);

	// Find the path to all folders inside the apps directory
	let globs = Glob.sync('./apps/*/');

	// For each app folder, associate the bundle id with the given entry point configuration.
	let contexts = globs.map((path) => {
		let id = Path.basename(path);

		let ctx = context({
			entryPoints: ['./apps/' + id + '/main.mts'],
			outfile: './apps/' + id + '/dist/app.pack.js',
			globalName: 'AppModuleExport',
			footer: {
				js: `window.AppModule_${id} = AppModuleExport;`
			}
		});

		return ctx;
	});

	runBuild(contexts, watchMode, emitMetafile ? 'apps.meta.json' : undefined);
}

main();