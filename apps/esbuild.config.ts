import * as ESBuild from 'esbuild';
import Path from 'path';
import Glob from 'glob';
import Babel from 'esbuild-plugin-babel';
import { sassPlugin as Sass } from 'esbuild-sass-plugin';
import { context, runBuild, setBaseConfig } from '../build_config/esbuild_system.ts';

const developmentMode = Boolean(process.env.DEV_MODE);
const watchMode = Boolean(process.env.DEV_MODE);
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
	plugins: [
		Sass({ embedded: true }),
		Babel(),
	],
	metafile: emitMetafile
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
			globalName: 'AppModule_' + id
		});

		return ctx;
	});

	runBuild(contexts, watchMode, emitMetafile ? 'apps.meta.json' : undefined);
}

main();