import FS from 'node:fs';

interface Configuration {
	extensions?: any;
	fs?: any;
	log_fs_operations?: boolean;
	log_requests?: boolean;
	https_port?: number;
	http_port?: number;
	no_auth_user?: string;
}

export var profile = 'default';
export var config: Configuration = {};

/**
 *  Initialize the configuration system with the program arguments.
 *  If no --profile argument was passed, 'default' will be used as the profile.
 *  Configuration is loaded first from all.json, then, replaced by the specific 
 *  profile.json file.
 * @param args Program cmd-line arguments
 */
export function init(args: string[]) {
	let i = args.indexOf('--profile');
	if (i >= 0) profile = args[i + 1];
	console.log('Profile: ' + profile);

	let allConfig = JSON.parse(FS.readFileSync(`config/profiles/all.json`).toString());
	let profConfig = JSON.parse(FS.readFileSync(`config/profiles/${profile}.json`).toString());

	Object.assign(config, allConfig, profConfig);
	print();
}

/**
 * Checks wether the given extension is enabled.
 * @param ext Th extension id.
 * @returns True if the extension exists and is enabled, false otherwise.
 */
export function isExtensionEnabled(ext: string): boolean {
	return config.extensions
		&& config.extensions[ext]
		&& config.extensions[ext].enabled === true;
}

/**
 * Logs to the console the current configuration.
 */
export function print() {
	console.log("Config:", config);
}

export default config;