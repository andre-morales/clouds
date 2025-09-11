import { Paths } from "./drivers/filesystem.mjs";
import { InternalFault } from "./faults.mjs";
import { Pointer } from "./utils/objects.mjs";

export interface IAppManifest {
	id: string;
	hash?: string;
	base?: string;
	icon?: string;
	displayName?: string;
	builder?: string;
	modules?: string[];
	scripts?: string[];
	styles?: string[];
	noWindowGrouping?: boolean;
}

export default class AppManifest {
	manifest: IAppManifest;
	newManifest: IAppManifest;
	updatePromise: Promise<any>;
	hash: string;

	constructor(manifest: IAppManifest) {
		this.manifest = manifest;
		this.hash = manifest.hash ?? '';
	}

	public transformManifestPaths() {
		const base = this.manifest.base;

		// With a pointer to a property, check is the path is relative and transform it.
		const map = (p: Pointer<string>) => {
			let path = p.v;
			if (path.startsWith('~/')) {
				if (!base) throw new InternalFault("App has no base path specified, and it can't be inferred either.");

				p.v = Paths.join(base, path.substring(2));
			}
		}
		
		// Transform all the properties with relative paths ~/
		map(Pointer.of(this.manifest, ['icon']));
		for (let arr of [this.manifest.modules, this.manifest.scripts, this.manifest.styles]) {
			if (!arr) continue;

			for (let i = 0; i < arr.length; i++) {
				map(Pointer.of(arr, [i]));
			}
		}
	}

	public async hasUpdates(): Promise<boolean> {
		if (!this.updatePromise)
			return false;

		let res = await this.updatePromise;
		if (!res)
			return false;

		return true;
	}

	public getIconURL(): string {
		return this.manifest.icon + '?h=' + this.hash;
	}
}