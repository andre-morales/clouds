import * as ESBuild from 'esbuild';
import { sassPlugin as Sass } from 'esbuild-sass-plugin';
import { context, runBuild, setBaseConfig } from '../framon/system.ts';
import swcTransformPlugin from '../framon/plugin_swc.ts';
import writerPlugin from '../framon/plugin_writer.ts';
import postCSSPlugin from '../framon/plugin_postcss.ts';

const developmentMode = Boolean(Number(process.env.DEV_MODE));
const watchMode = Boolean(Number(process.env.WATCH_MODE));
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
	plugins: [
		Sass({ embedded: true }),
		postCSSPlugin(),
		swcTransformPlugin({ iife: true }),
		writerPlugin()],
	target: ['esnext'],
	write: false
}

function main() {
	setBaseConfig(baseConfig);

	let contexts = [
		context({
			entryPoints: [
				'./client/src/boot/entry.mts',
				'./client/src/boot/login.mts'
			],
			outdir: './client/public/pack/'
		}),
		context({
			entryPoints: ['./client/src/client_core.mts'],
			outfile: './client/public/pack/core.chk.js',
			globalName: 'CoreModuleExport',
			footer: {
				js: 'window.CoreModule = CoreModuleExport'
			}
		}),
		context({
			entryPoints: [
				'./client/src/ui/controls/slider/slider.scss',
				'./client/src/styles/themes/default.scss',
				'./client/src/styles/themes/retro.scss',
			],
			outdir: './client/public/pack/',
		})
	];

	runBuild(contexts, watchMode, emitMetafile ? 'logs/core.meta.json' : undefined);
}

main();
