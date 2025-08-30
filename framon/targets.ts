import BrowsersList from 'browserslist';

/**
 * Fetches the browserslist configured and calculates the minimum version of each browser vendor.
 * @returns An object { vendor: min-version } that represents the minimum version of each
 * browser listed.
 */
export function getBaselineTargets(): {[vendor: string]: number} {
	// Cache the calculated targets
	const stx = getBaselineTargets as any;
	if (stx.cachedTargets)
		return stx.cachedTargets;

	// We'll populate this with the lowest version of each browser on the browserslist
	let targets = {};

	let browsers = BrowsersList();
	for (let browser of browsers) {
		let [vendor, version] = browser.split(' ');

		// Only care about main vendors
		if (!['chrome', 'firefox', 'edge', 'safari'].includes(vendor))
			continue;

		// If this browser vendor hasn't been seen yet, or if its version is lower than the one
		// currently in targets, save this target
		if (!targets[vendor] || Number(version) < targets[vendor] )
			targets[vendor] = Number(version);
	}

	stx.cachedTargets = targets;
	return targets;
}

/**
 * Queries the baseline browser targets with getBaselineTargets() and formats it ESBuild format.
 * @returns An array of target strings
 */
export function getESBuildTargets() {
	let out: string[] = [];
	const vendors = ['chrome', 'firefox', 'edge', 'safari', 'opera', 'ie'];

	let targets = getBaselineTargets();
	for (let [vendor, version] of Object.entries(targets)) {
		if (!vendors.includes(vendor))
			continue;

		out.push(vendor + version);
	}

	return out;
}