class Files {
	static getPath(path) {
		return '/fs/q' + path;
	}

	static async getJson(path) {
		let res = await fetch(Files.getPath(path));
		return await res.json();
	}

	static async getText(path) {
		let res = await fetch(Files.getPath(path));
		return await res.text();
	}

	static upPath(path) {
		return '/fs/ud' + path;
	}

	static async upText(path, text) {
		await fetch(Files.upPath(path), {
			method: 'POST',
			body: text,
			headers: {
				'Content-Type': 'text/plain'
			}
		});
	}
}