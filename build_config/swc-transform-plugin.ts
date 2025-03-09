import { transform } from '@swc/core';
import * as ESBuild from 'esbuild';
import FS from 'node:fs';
import { getBaselineTargets } from './esbuild_system.ts';

interface PluginOptions {
	write?: boolean;
}

class SwcTransformPlugin implements ESBuild.Plugin {
	public readonly name: string;
	public readonly write: boolean;

	constructor(options?: PluginOptions) {
		this.name = 'swc-transform';
		this.write = Boolean(options?.write);
	}

	setup(build: ESBuild.PluginBuild) {
		build.onEnd(async (result) => {
			if (!result.outputFiles) {
				console.warn('swc-transform-plugin: No output files found. Make sure to set write: false in your ESBuild options.');
				return;
			}
		  
			// Process all javascript files
			await Promise.all(result.outputFiles.map(this.processFile.bind(this)));
		});
	}

	private async processFile(file: ESBuild.OutputFile): Promise<void> {
		if (!file.path.endsWith('.js')) return;

		try {
			let code = await invokeSwc(file.text);
			file.contents = code;

			if (this.write) {
				console.log("Writing file: ", file.path);
				await FS.promises.writeFile(file.path, code);
			}
		} catch (err) {
			console.error(`Error transforming ${file.path} with SWC:`, err);
		}
	}
}

async function invokeSwc(input: string) {
	// Read browserslistrc and join entries into a single string
	let browserList = Object.entries(getBaselineTargets()).map(e => e[0] + ' ' + e[1]).join(',');

	const swcResult = await transform(input, {
		env: {
			targets: browserList
		},
		minify: false,
	});
	
	let encoder = new TextEncoder();
	let codeBuffer = encoder.encode(swcResult.code);
	return codeBuffer;
}

export default (options?: PluginOptions) => { 
	let plugin = new SwcTransformPlugin(options);
	return {
		name: plugin.name,
		setup: (pb) => plugin.setup(pb)
	}
};
