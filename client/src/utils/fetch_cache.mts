export class FetchCache {
	cache: Map<string, Promise<CachedResponse>>;
	
	constructor() {
		this.cache = new Map();
	}
	
	fetch(url: URL): Promise<CachedResponse> {
		try {
			// If the fetch() was performed in the past, return the same promise as the first one.
			let cached = this.cache.get(url.toString());
			if (cached)
				return cached;

			// No fetch has been done for this URL. Execute a fetch and save
			// the promise for this fetch.
			let promise = fetch(url, { credentials: 'same-origin' })
			.then(res => {
				return res.blob();
			}).then(blob => {
				return new CachedResponse(blob);
			});

			// Save the promise for this fetch url
			this.cache.set(url.toString(), promise);
			return promise;
		} catch(err) {
			console.log('SYC ERR', err)
		}
	}
}

class CachedResponse {
	private readonly data: Blob;

	constructor(data: Blob) {
		this.data = data;
	}

	public async text(): Promise<string> {
		return this.data.text();
	}

	public async blob() {
		return this.data;
	}

	public async json() {
		return JSON.parse(await this.data.text());
	}
}