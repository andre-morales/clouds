window.ExplorerApp = class ExplorerApp extends App {
	constructor(args) {
		super(args);
		this.window = null;
		this.filesCount = 0;
		this.$files = null;
		this.cwd = null;
		this.selectionMode = 'default';
		this.selectedFiles = [];
		this.selectedElems = [];
		this.closingDeferred = new Deferred();
	}

	async init() {
		if (this.window) return;

		// Require resources
		this.requireStyle('/app/explorer/res/style.css');

		// Create window and fetch app body
		this.window = WebSys.desktop.createWindow();
		this.window.icon = '/res/img/ftypes/folder128.png';
		this.window.setTitle('File Explorer');
		this.window.on('closereq', () => this.close());
		this.window.on('backnav', () => this.navigate('..'));

		let $win = this.window.$window;
		$win.find('.body').addClass('app-explorer');

		// Fetch explorer body
		await this.window.setContentToUrl('/app/explorer/res/main.html');

		// Query DOM
		this.$files = $win.find('.files');
		this.$addressField = $win.find('.address-field');
		this.$favorites = $win.find('.favorites');

		// Setup events
		this.$addressField.on('change', () => {
			this.go(this.$addressField.val());
		});
		$win.find('.back-btn').click(() => this.navigate('..'));
		$win.find('.refresh-btn').click(() => this.navigate('.'));
		$win.find('.favorites-btn').click(() => {
			$win.find('.favorites').toggleClass('hidden');
			this.recalculateIcons();
		});
		$win.find('.search-field').on('change', () => this.searchFiles());
		this.window.on('resize', () => this.recalculateIcons());

		let $filesContainer = $win.find('.files-container');
		WebSys.desktop.addContextMenuFnOn($filesContainer, () => [
			['Upload...', () => this.openUploadDialog()]
		]);

		// Final preparation
		this.refreshFavorites();

		// Make the window visible
		this.window.bringToCenter();
		this.window.focus();
		this.restoreAppWindowState(this.window);
		this.window.setVisible(true);
		
		await this.goHome();
	}

	async openUploadDialog() {
		let helperWin = WebSys.desktop.createWindow();
		helperWin.on('closereq', () => helperWin.close());
		
		await helperWin.setContentToUrl('/app/explorer/res/upload-helper.html');
		helperWin.setTitle('Upload to: ' + this.cwd);
		helperWin.setSize(280, 200);
		helperWin.bringToCenter();
		helperWin.bringToFront();

		let uploadPath = this.cwd;
		let url = '/fs/u' + uploadPath;
		let $form = helperWin.$window.find('form');
		$form.submit((ev) => {
			fetch(url, {
		    	method: 'POST',
		    	body: new FormData($form[0])
		    });

	    	ev.preventDefault();
		});
		helperWin.setVisible(true);
	}

	recalculateIcons() {
		let iw = 128;

		let w = this.$files.width();
		let icons = Math.floor(w / iw); // How many icons fit vertically
		let tm = w - icons * iw - 2;    // Remaining space
		let m = tm / icons / 2;         // Divide remaining space as margin
		this.$files.css('--icon-border', m + 'px');
	}

	searchFiles() {
		let query = this.window.$window.find('.search-field').val();
		if (query.length == 0) {
			this.$files.children().removeClass('hidden');
			return;
		}

		query = query.toLowerCase();
		this.$files.children().each((i, el) => {
			let $el = $(el);
			let fname = $el.find('span').text().toLowerCase();
			if (fname.includes(query)) {
				$el.removeClass('hidden')
			} else {
				$el.addClass('hidden');
			}
		});
	}

	asFileSelector(mode, selectionMode) {
		this.selectionMode = selectionMode;
		let $win = this.window.$window;

		if (mode == 'open') {
			$win.find('.choose-options').addClass('d-block');
			$win.find('.ribbon').addClass('d-none');
			$win.find('.select').click(() => {
				this.doneClicked = true;
				this.close();
			});
		}
	}

	async waitFileSelection() {
		await this.closingDeferred.promise;
		if (this.doneClicked) return this.selectedFiles;
		return null;
	}

	async navigate(path) {
		this.go(pathJoin(this.cwd, path));
	}

	async go(path) {
		this.$addressField.val(path);

		// Fetching and fetch error handling
		let fres = await fetch('/fs/ls' + path);
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

			WebSys.showErrorDialog(`${msg}\nPath: "${path}"`);
			this.$addressField.val(this.cwd);
			return code;
		}
		this.cwd = path;

		// UI changes
		this.$files.addClass('d-none');
		this.$files.empty();
		
		if (path == '/') {
			this.window.setTitle('File Explorer');
		} else {
			let fname = path;
			if (path.endsWith('/')) fname = path.slice(0, -1)

			fname = fname.slice(fname.lastIndexOf('/') + 1);
			this.window.setTitle(fname);
		}

		// Sort files
		let files = await fres.json();
		this.filesCount = files.length;

		let val = (e) => {
			if (e.endsWith('/')) return 1;
			return 0;
		};
		files.sort((a, b) => {
			let A = val(a.split('*')[0]);
			let B = val(b.split('*')[0]);
			if (A == B) return a.localeCompare(b);
			return B - A;
		});

		// Make icons
		for (let file of files) {
			let $ic = this.makeFileIcon(file);
			$ic.appendTo(this.$files);
		}	

		// Make the panel visible
		this.$files.removeClass('d-none');
		this.recalculateIcons();
	}

	async goHome() {
		await this.go('/');
	}

	async openHandler(path) {
		let qPath = '/fs/q' + path;

		if (path.endsWith('/')) {
			this.go(path)
		} else {
			if (FileTypes.isMedia(path)) {
				let app = await WebSys.runApp('sinestesia');
				app.playFile(qPath);
				app.window.bringToFront();
				app.window.focus();
			} else {
				this.openFileExt(path);
			}
		}
	}

	makeFileIcon(fcodes, callback) {
		let sp = fcodes.split('*');
		let fpath = sp[0];
		let ftags_ = sp[1];
		let ftags = [];
		if (ftags_) ftags = ftags_.split("");

		let _desktop = WebSys.desktop;

		let fname = fpath;
		let absPath = pathJoin(this.cwd, fname);
		let classes = '';
		let ic = '';

		let isDir = fpath.endsWith('/');
		if (isDir) {
			classes += ' dir';
			fname = fpath.slice(0, -1);
		}
		if (ftags.includes('i')) {
			classes += ' blocked';
		}
		if (ftags.includes('s')) {
			classes += ' symbolic';
		}

		let hasThumb = FileTypes.isVideo(fname) || FileTypes.isPicture(fname);
		if (hasThumb) {
			ic = `<img src='/fs/thumb${absPath}'>`
			classes += ' thumbbed';
		} else {
			let cl = this._getFileClassByExt(fpath);
			if (cl) classes += ' ' + cl;
		}

		let $ic = $(`<div class='file${classes}'><i>${ic}</i><span>${fname}</span></div>`);
		$ic.click(() => {
			if (_desktop.contextMenuOpen) return;
			if (this.selectionMode == 'default') {
				this.openHandler(absPath);
				return;
			}

			switch(this.selectionMode) {
			case 'one':
				if ($ic.hasClass('selected')) {
					this.selectedFiles = [];
					this.selectedElems = [];
				} else {
					for (let $el of this.selectedElems) {
						$el.removeClass('selected');
					};	
					this.selectedFiles = [absPath];
					this.selectedElems = [$ic];
				}
				break;
			case 'many':
				let i = this.selectedFiles.indexOf(absPath);
				if (i == -1) {
					this.selectedFiles.push(absPath);
					this.selectedElems.push($ic);
				} else {
					this.selectedFiles.splice(i, 1);
					this.selectedElems.splice(i, 1);
				}
				break;
			}
			$ic.toggleClass('selected');
		});
		$ic.dblclick(() => {
			if (this.selectionMode != 'default') {
				this.openHandler(absPath);
			}
		});
		_desktop.addContextMenuFnOn($ic, () => this.makeFileMenu(absPath));
		return $ic;
	}

	makeFileMenu(absPath) {
		let isDir = absPath.endsWith('/');
		let qPath = '/fs/q' + absPath;

		let menu = [
			['Open', () => this.openHandler(absPath)],
		];

		if (isDir) {
			menu.push(
				['Open in another window', async () => {
					let app = await WebSys.runApp('explorer');
					app.go(absPath);
				}],
				['Add to favorites', () => {
					this.addFavorite(absPath)
				}]
			);
		} else {
			menu.push(
				['Open outside', () => this.openFileExt(absPath)],
				['Download', () => WebSys.downloadUrl(qPath)]
			);
		}

		if (FileTypes.isPicture(absPath)) {
			menu.push(['Set as background', () => {
				WebSys.desktop.setBackground(qPath, true);
			}]);
		}

		menu.push(
			'-',
			['Copy', () => copyTextToClipboard(qPath)],
			['Delete', null]
		);
		return menu;
	}

	addFavorite(path) {
		let favorites = [];

		let it = localStorage.getItem('favorites');
		if (it) {
			favorites = JSON.parse(it);
		}

		favorites.push(path);

		localStorage.setItem('favorites', JSON.stringify(favorites));
		this.refreshFavorites();
	}

	removeFavorite(path) {
		let favorites = [];

		let it = localStorage.getItem('favorites');
		if (it) {
			favorites = JSON.parse(it);
		}

		arrErase(favorites, path);

		localStorage.setItem('favorites', JSON.stringify(favorites));
		this.refreshFavorites();
	}

	clearFavorites() {
		localStorage.removeItem('favorites');
		this.refreshFavorites();
	}

	refreshFavorites() {
		this.$favorites.empty();

		let favorites = [];

		let it = localStorage.getItem('favorites');
		if (it) {
			favorites = JSON.parse(it);
		}

		for (let path of favorites) {
			let fname = this._getFileName(path);
			let $item = $('<li>' + fname + '</li>');
			$item.click(() => {
				this.openHandler(path);
			});
			WebSys.desktop.addContextMenuFnOn($item, () => [
				['Remove', () => this.removeFavorite(path)]
			]);
			this.$favorites.append($item);
		}
	}

	openFileExt(path) {
		window.open('/fs/q' + path, '_blank').focus();
	}

	onClose() {
		this.saveAppWindowState(this.window);
		this.window.close();
		this.closingDeferred.resolve();
	}

	closePromise() {
		return this.closingDeferred.promise;
	}

	_getFileName(path) {
		if (path.endsWith('/')) {
			path = path.slice(0, -1);
		}

		let sl = path.lastIndexOf('/');
		if (sl == -1) return path;
		return path.slice(sl + 1);
	}

	_getFileClassByExt(file) {
		if (FileTypes.isAudio(file)) return 'audio';
		return null;
	}
}