import { Paths } from "/@sys/drivers/filesystem.mjs";
import { FileSystem } from "/@sys/drivers/filesystem.mjs";
import Deferred from '/@comm/deferred.mjs';

export enum FileOperationKind {
	COPY, CUT, ERASE
}

export class FileOperation {
	/** The kind of file operation being executed */
	kind: FileOperationKind;

	/** Absolute path of all the source files involved in this operation. */
	sources: string[];

	/** The destination directory of this operation (copy/cut). */
	destination: string;

	/** A promise for each sub-operation. */
	promises: Promise<void>[];

	/** A promise for the whole operation. */
	wholePromise: Promise<void[]>;

	/** The number of sub-operations completed so far. */
	completedOperations: number;

	/** A percentage of sub-operations completed. */
	progress: number;

	onProgress: (value: number) => void;

	constructor(absolutePaths: string[]) {
		this.sources = absolutePaths;
		this.promises = [];
		this.completedOperations = 0;
	}

	/**
	 * Copy the source files to a directory
	 * @param directory An absolute path to a directory in the VFS.
	 */
	copyTo(directory: string) {
		this.kind = FileOperationKind.COPY;
		this.destination = directory;

		for (let path of this.sources) {
			let dest = directory + Paths.file(path);
			let promise = FileSystem.copy(path, dest);
			this.promises.push(promise);
		}

		this.#createPromises();
	}

	cutTo(directory: string) {
		this.kind = FileOperationKind.CUT;
		this.destination = directory;

		for (let path of this.sources) {
			let dest = directory + Paths.file(path);
			let promise = FileSystem.rename(path, dest);
			this.promises.push(promise);
		}

		this.#createPromises();
	}

	erase() {
		this.kind = FileOperationKind.ERASE;
		for (let path of this.sources) {
			let promise = FileSystem.erase(path);
			this.promises.push(promise);
		}

		this.#createPromises();
	}

	/**
	 * Obtain a promise that resolves when the entire operation has been completed.
	 * @param timeout An optional non-negative timeout for the promise. If the specified amount of milliseconds
	 * has passed and the operation still hasn't completed, the promise is rejected.
	 */
	getCompletionPromise(timeout?: number): Promise<void> {
		let deferred = new Deferred();
		this.wholePromise.then(deferred.resolve);
		if (typeof timeout == 'number' && timeout >= 0) {
			setTimeout(deferred.reject, timeout);
		}
		return deferred.promise;
	}

	#createPromises()  {
		for (let prom of this.promises) {
			prom.then(() => {
				this.completedOperations++;
				this.progress = this.completedOperations / this.sources.length;
				if (this.onProgress) this.onProgress(this.progress);
			});
		}

		this.wholePromise = Promise.all(this.promises);
	}
}