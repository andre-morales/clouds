import { FilePanel } from './file_panel.mjs';
import ExplorerUploader from './uploader.mjs';
import ExplorerOpenWith from './openwith.mjs';

// App associated with each file extension. In the future will be a user configuration file
const TYPE_ASSOCIATIONS = {
	'mp4': 'sinestesia',
	'webm': 'sinestesia',
	'mkv': 'sinestesia',
	'm4v': 'sinestesia',

	'weba': 'sinestesia',
	'm4a': 'sinestesia',
	'mp3': 'sinestesia',
	'wav': 'sinestesia',
	'ogg': 'sinestesia',
	'opus': 'sinestesia',

	'png': 'sinestesia',
	'jpg': 'sinestesia',
	'jpeg': 'sinestesia',
	'webp': 'sinestesia',

	'json': 'notepad',
	'txt': 'notepad',
	'ini': 'notepad',
	'log': 'notepad',

	'html': 'webview',
	'htm': 'webview'
};

export default class ExplorerApp extends App {
	constructor(...args) {
		super(...args);
		this.window = null;
		this.filesCount = 0;
		this.cwd = null;
		this.favorites = [];
		this.collections = {};
		this.collectionsMap = new Map();
		this.collectionsVisible = [];
		this.closingDeferred = new Deferred();
		this.history = new History();
		this.history.save();
		this.panel = new FilePanel(this);
		this.cancelFetches = true;
		this.canceledFetches = new Map();
	}

	async init() {
		if (this.window) return;

		// Create window and fetch app body
		this.window = Client.desktop.createWindow(this);
		this.window.setTitle('File Explorer');
		this.window.setVisible(true);

		this.window.on('closed', () => this.exit());
		this.window.on('backnav', () => this.goUp());

		this.on('exit', () => {
			this.closingDeferred.resolve();
		});

		let $app = this.window.$window.find('.window-body');
		this.$app = $app;
		$app.addClass('app-explorer');

		// Fetch explorer body
		await this.window.setContentToUrl('/app/explorer/res/main.html');

		// Query DOM
		this.$addressField = $app.find('.address-field');
		this.$favorites = $app.find('.favorites');
		this.$collections = $app.find('.collections');

		// Setup file panel
		this.panel.init();

		// Setup events
		this.$addressField.on('change', () => {
			this.go(this.$addressField.val());
		});
		$app.find('.back-btn').click(() => this.goBack());
		$app.find('.up-btn').click(() => this.goUp());
		$app.find('.refresh-btn').click(() => this.refresh());
		$app.find('.favorites-btn').click(() => {
			$app.find('aside').toggleClass('hidden');
			this.panel.recalculateIcons();
		});
		$app.find('.search-field').on('change', () => this.searchFiles());
		this.window.on('resize', () => this.panel.recalculateIcons());

		// Context menus
		let $filesContainer = $app.find('.files-container');
		Client.desktop.addCtxMenuOn($filesContainer, () => CtxMenu([
			CtxMenu([
				CtxItem('Name', () => this.sortBy('name')),
				CtxItem('Date', () => this.sortBy('date'))
			], "Sort by..."),
			'-',
			CtxItem('Paste', () => this.paste()).setEnabled(this.canPaste()),
			CtxItem('Upload...', () => this.openUploadDialog())
		]));

		let $sidePanel = $app.find('aside');
		Client.desktop.addCtxMenuOn($sidePanel, () => CtxMenu([
			CtxItem('Create collection...', () => this.openCreateCollectionDialog())
		]));

		// Configure touch gestures
		let hammer = new Hammer.Manager(this.$app.find('.body')[0], {
			recognizers: [
				[Hammer.Pinch, {}]
			]
		});

		hammer.on('pinch', (ev) => {
			this.setZoom(ev.scale);
		});

		// Final preparation
		this.loadFavorites().then(() => {
			this.refreshFavorites();
		});
		
		this.loadCollections().then(() => {
			this.recreateCollections();
		});

		// Make the window visible
		this.window.focus();
		this.window.setVisible(true);
		
		// Go to the root directory and save it in history
		await this.goHome();
		this.history.save();
	}

	async openUploadDialog() {
		let uploader = new ExplorerUploader(this);
		uploader.open();
	}

	async openCreateCollectionDialog() {
		let win = Client.desktop.createWindow();
		win.on('closereq', () => win.close());
		
		let $body = win.$window.find('.window-body');
		
		let $input = $('<input>')
		$body.append($input);

		let $save = $('<button>Save</button>')
		$save.click(() => {
			this.createCollection($input.val());
			win.close();
		});
		$body.append($save);

		win.setTitle('Create Collection');
		win.setSize(280, 200);
		win.bringToCenter();
		win.bringToFront();

		win.setVisible(true);
	}

	goBack() {
		let path = this.history.goBack();
		if (path) this.go(path);
	}

	goUp() {
		let path = this.getNavPath('..');
		this.go(path);
		this.history.save(path);
	}

	refresh() {
		this.navigate('.');
	}

	searchFiles() {
		let query = this.window.$window.find('.search-field').val();
		if (query.length == 0) {
			this.panel.filter("");
			return;
		}

		this.panel.filter(query.toLowerCase());
	}

	sortBy(what) {
		this.sorting = what;
		this.setFilePanelContent(this.files);
	}

	asFileSelector(mode, selectionMode) {
		this.panel.selectionMode = selectionMode;
		let $win = this.window.$window;

		if (mode == 'open') {
			$win.find('.choose-options').removeClass('d-none');
			$win.find('.select').click(() => {
				this.doneClicked = true;
				this.window.close();
				this.exit();
			});
		}
		if (mode == 'save') {
			$win.find('.save-options').removeClass('d-none');
			$win.find('.save').click(() => {
				let fileName = $win.find('.name-field').val();
				
				this.panel.selectedFiles = [this.cwd + fileName];
				this.doneClicked = true;
				this.window.close();
				this.exit();
			});
		}
	}

	async waitFileSelection() {
		await this.closingDeferred.promise;

		if (this.doneClicked) return this.panel.selectedFiles;
		return null;
	}

	getNavPath(path) {
		if (path == '.') return this.cwd;

		let p = Paths.join(this.cwd, path);
		if (p == '/..') return '/';
		return p;
	}

	async navigate(path) {
		this.go(this.getNavPath(path));
	}

	async go(path) {
		// If cancel fetches is enabled, remove src attribute of every image
		// but save the sources in another attribute in case the navigation fails.
		if (this.cancelFetches) {
			this.panel.$files.find('img').each((i, el) => {
				let src = el.getAttribute('src');;
				el.dataset.haltSrc = src;
				el.setAttribute('src', '');
			});
		}
		//this.$files.empty();
		
		if (path.startsWith('$')) {
			this.openCollection(path.substring(1));
			return;
		}

		this.$addressField.val(path);

		// Fetching and fetch error handling
		let fres = await fetch('/fsv' + path);
		if (fres.status != 200) {
			let code = fres.status;
			let msg = '';
			switch (code) {
				case 400:
					msg = "No mapping."; break;
				case 404:
					msg = "Could't find."; break;
				case 403:
					msg = "Not allowed to access."; break;
				case 500:
					msg = "Failed to query."; break;
			}

			Dialogs.showError(this, "Explorer", `${msg}\nPath: "${path}"`);
			this.$addressField.val(this.cwd);

			// If cancel fetches was enabled, restore thumb image sources on navigation failure
			if (this.cancelFetches) {
				this.panel.$files.find('img').each((i, el) => {
					let src = el.dataset.haltSrc;
					el.setAttribute('src', src);
				});
			}
			return code;
		}

		console.log('result');
		this.cwd = path;
		
		// UI changes		
		this.refreshCollections();

		if (path == '/') {
			this.window.setTitle('File Explorer');
		} else {
			let fname = path;
			if (path.endsWith('/')) fname = path.slice(0, -1)

			fname = fname.slice(fname.lastIndexOf('/') + 1);
			this.window.setTitle(fname);
		}

		let files = await fres.json();
		this.panel.setContent(files);
	}

	async goHome() {
		this.history.save('/');
		await this.go('/');
	}

	async openHandler(path) {
		// If it's a folder
		if (path.endsWith('/')) {
			this.go(path);
			this.history.save(path);
			return;
		}

		let fsPath = '/fsv' + path;

		// Query file extension if it has one
		let i = path.lastIndexOf('.');
		if (i != -1) {
			// Find the app associated based on the extension
			let ext = path.substring(i + 1);
			let appId = TYPE_ASSOCIATIONS[ext];

			if (appId) {
				let app = await Client.runApp(appId, [fsPath]);
				
				// If the app launch failed, do nothing, as the user will already be notified of any errors
				if (!app) return;

				// If the app launched with a main window, bring it to front
				if (!app.mainWindow) return;
				app.mainWindow.bringToFront();
				app.mainWindow.focus();
				return;
			}
		}

		// If there was no extension or no app associated with this file, open it externally
		this.openFileExt(path);	
	}

	// Favorites 
	addFavorite(path) {
		this.favorites.push(path);

		this.saveFavorites();
		this.refreshFavorites();
	}

	removeFavorite(path) {
		arrErase(this.favorites, path);

		this.saveFavorites();
		this.refreshFavorites();
	}
	
	refreshFavorites() {
		this.$favorites.empty();

		for (let path of this.favorites) {
			let fname = Paths.file(path).replace('/', '');
			let $item = $('<li>' + fname + '</li>');
			$item.click(() => {
				this.openHandler(path);
			});
			Client.desktop.addCtxMenuOn($item, () => CtxMenu([
				CtxItem('Remove', () => this.removeFavorite(path))
			]));
			this.$favorites.append($item);
		}
	}

	async saveFavorites() {
		await FileSystem.writeJson('/usr/favorites.json', this.favorites);
	}

	async loadFavorites() {
		try {
			this.favorites = await FileSystem.readJson('/usr/favorites.json');
		} catch (err) {
			this.favorites = [];
		}
	}

	// Collections
	createCollection(name) {
		this.collections[name] = {};

		this.saveCollections();
		this.recreateCollections();
	}

	destroyCollection(name) {
		delete this.collections[name];

		this.saveCollections();
		this.recreateCollections();
	}
	
	refreshCollections() {
		this.collectionsVisible.length = 0;
		for (let [name, $item] of this.collectionsMap.entries()) {
			let coll = this.collections[name];

			let visible = !coll.exclusive || coll.exclusive == this.cwd;
			$item.toggleClass('hidden_', !visible);
			if (visible) this.collectionsVisible.push(name);
		}
	}

	recreateCollections() {
		let self = this;

		this.$collections.empty();
		this.collectionsMap.clear();

		for (let [name, coll] of Object.entries(this.collections)) {
			let $item = $('<li class="hidden_">' + name + '</li>');
			this.collectionsMap.set(name, $item);

			$item.click(() => {
				this.openCollection(name);
			});

			Client.desktop.addCtxMenuOn($item, () => {
				return CtxMenu([
					CtxCheck('Only show here', (c) => {
						coll.exclusive = (c) ? self.cwd : null;
						this.saveCollections();
					}, coll.exclusive == this.cwd),
					CtxItem('Remove', () => this.destroyCollection(name))
				]);
			});
			this.$collections.append($item);
		}

		this.refreshCollections();
	}

	async saveCollections() {
		let data = JSON.stringify(this.collections);

		await fetch('/fs/ud/usr/collections.json', {
			method: 'POST',
			body: data,
			headers: {
				'Content-Type': 'text/plain'
			}
		})
	}

	async loadCollections() {
		let freq = await fetch('/fs/q/usr/collections.json');
		if (freq.status == 404) {
			this.collections = {};
			return;
		}

		let data = await freq.text();
		this.collections = JSON.parse(data);
	}

	openCollection(cname) {
		let col = this.collections[cname];
		if (!col) return;

		this.window.setTitle(`[${cname}]`);
		this.setFilePanelContent(col.files);

		this.cwd = '$' + cname;
		this.history.save(this.cwd);
		this.$addressField.val(this.cwd);
	}

	addFileToCollection(cname, file) {
		let coll = this.collections[cname];
		if (!coll.files) coll.files = [];

		if (coll.files.includes(file)) return;
		
		coll.files.push(file);
		this.saveCollections();
	}

	copy(path) {
		LocalClipboard.saveObject('path', { 
			operation: "copy",
			path: path
		});
	}

	cut(path) {
		LocalClipboard.saveObject('path', { 
			operation: "cut",
			path: path
		});
	}

	// Returns whether there is a copy/cut operation in the clipboard
	canPaste() {
		let type = LocalClipboard.type;
		if (type != 'path') return false;

		let op = LocalClipboard.object;
		return op.operation == 'cut' || op.operation == 'copy';
	}

	async paste() {
		if (!this.canPaste()) return;

		let obj = LocalClipboard.object;
		let from = obj.path;
		let to = this.cwd + Paths.file(from);

		let op = obj.operation;
		if (op == 'cut') {
			LocalClipboard.clear();

			await FileSystem.rename(from, to);
		} else if (op == 'copy') {
			await FileSystem.copy(from, to);
		}

		this.refresh();
	}

	async erase(path) {
		let file = Paths.file(path);
		let msg;
		if (path.endsWith('/')) {
			msg = `This will permanently delete the folder:\n"${file}"\n and everything inside of it.\n\nAre you sure?`;
		} else {
			msg = `This will permanently delete:\n"${file}".\n\nAre you sure?`;
		}

		let [win, prom] = Dialogs.showOptions(this, "Erase", msg, ['Yes', 'No'], {
			icon: 'warning'
		});

		let opt = await prom;
		if (opt === 0) {
			await FileSystem.erase(path);
			this.refresh();
		}
	}

	async openFileWith(path) {
		let openWith = new ExplorerOpenWith(this);
		openWith.open(path);
	}

	openFileExt(path) {
		window.open(Paths.toFSV(path), '_blank').focus();
	}

	closePromise() {
		return this.closingDeferred.promise;
	}
}	

class History {
	constructor() {
		this.log = [];
		this.logIndex = -1;		
	}

	save(entry) {
		this.logIndex++;

		if (this.logIndex == this.log.length) {
			this.log.push(entry);
		} else {
			this.log[this.logIndex] = entry;
			this.log.length = this.logIndex+1;
		}
	}

	goBack() {
		if (this.logIndex <= 0) return null;

		return this.log[--this.logIndex];
	}
}