import FS from 'fs';

var profile = 'default';
var config = {};

// Initialize the configuration system with the program arguments.
// If no --profile argument was passed, 'default' will be used as the profile.
// Configuration is loaded first from all.json, then, replaced by the specific 
// profile.json file.
export function init(args) {
	let i = args.indexOf('--profile');
	if (i >= 0) profile = args[i + 1];
	console.log('Profile: ' + profile);

	let allConfig = JSON.parse(FS.readFileSync(`config/profiles/all.json`));
	let profConfig = JSON.parse(FS.readFileSync(`config/profiles/${profile}.json`));

	Object.assign(config, allConfig, profConfig);
	print();
}

export function isExtensionEnabled(ext) {
	return config.extensions
		&& config.extensions[ext]
		&& config.extensions[ext].enabled;
}

export function print() {
	console.log("Config:", config);
}

export { profile, config };
export default config;