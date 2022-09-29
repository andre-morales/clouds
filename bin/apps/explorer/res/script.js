window.ExplorerApp = class ExplorerApp extends App {
	constructor(webSys, args) {
		super(webSys, args);
		this.window = null;
		this.$files = null;
		this.cwd = null;
	}

	async init() {
		if (this.window) return;

		// Require resources
		await this.requireStyle('/app/explorer/res/style.css');

		// Create window and fetch app body
		this.window = this._sys.desktop.createWindow();
		this.window.icon = '/res/img/ftypes/folder128.png';
		this.window.onCloseRequest = () => {
			this.window.close();
			this.close();
		}
		this.window.backButton = () => {
			this.navigate('..');
		};
		this.window.setTitle('File Explorer');
		let $win = this.window.$window;

		// Fetch explorer body
		await this.window.setContentToUrl('/app/explorer/res/main.html');

		// Query DOM
		this.$files = $win.find('.files');
		this.$addressField = $win.find('.address-field');
		
		// Setup events
		this.$addressField.on('change', () => {
			this.go(this.$addressField.val());
		});
		$win.find('.back-btn').click(() => {
			this.navigate('..');
		});
		$win.find('.upload-btn').click(async () => {
			let helperWin = webSys.desktop.createWindow();
			helperWin.onCloseRequest = helperWin.close;
			
			await helperWin.setContentToUrl('/app/explorer/res/upload-helper.html');
			helperWin.setTitle('Upload to: ' + this.cwd);
			helperWin.setSize(280, 200);
			helperWin.bringToCenter();
			helperWin.bringToFront();

			let uploadPath = this.cwd;
			let url = '/fs/u' + uploadPath;
			let $form = helperWin.$window.find('form');
			$form.submit(function(ev) {
			    $.ajax({
			        url: url,
			        type: 'POST',
			        data: new FormData(this),
			        processData: false,
			        contentType: false,
			    });

		    	ev.preventDefault();
			});
			helperWin.setVisible(true);
		});

		// Go to home page
		await this.goHome();

		/*if (this.initArgs.includes('--choose')) {
			$win.find('.choose-options').addClass('.visible');
		}*/

		/*$win.find('.select').click(() => {
			if (this.chooseCallback) {
				return this.selectedFiles;
			}
		});*/

		// Make the window visible
		this.window.setVisible(true);
	}

	/*getChoosenPath() {
		if (this.chooseCallback) throw new Error('Already awaiting for choice.');

		return new Promise((resolve, reject) => {
			this.chooseCallback = resolve;
		});
	}*/

	async navigate(path) {
		this.go(pathJoin(this.cwd, path));
	}

	async go(path) {
		this.$addressField.val(path);

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

			this._sys.showErrorDialog(`${msg}\nPath: "${path}"`);
			this.$addressField.val(this.cwd);
			return code;
		}

		if (path == '/') {
			this.window.setTitle('File Explorer');
		} else {
			let fname = path;
			if (path.endsWith('/')) fname = path.slice(0, -1)

			fname = fname.slice(fname.lastIndexOf('/') + 1);
			this.window.setTitle(fname);
		}

		this.cwd = path;
		this.$files.empty();
		this.$files.css('display', 'none');

		let files = await fres.json();

		let val = (e) => {
			if (e.endsWith('/')) return 1;
			if (e.endsWith('*i')) return -1;
			return 0;
		};
		files.sort((a, b) => {
			let A = val(a);
			let B = val(b);
			if (A == B) return a.localeCompare(b);
			return B - A;
		});

		for (let file of files) {
			let $ic = this.makeFileIcon(file);
			$ic.appendTo(this.$files);
		}	

		this.$files.css('display', 'block');
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
				let app = await webSys.runApp('sinestesia');
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
		let fcode = sp[1];

		let _desktop = this._sys.desktop;

		let fname = fpath;
		let absPath = pathJoin(this.cwd, fname);
		let classes = '';
		let ic = '';

		let isDir = fpath.endsWith('/');
		if (isDir) {
			classes += ' dir';
			fname = fpath.slice(0, -1);
		}
		if (fcode == 'i') {
			classes += ' blocked';
		}
		
		if (this._doFileExtRequestThumbs(fpath)) {
			ic = `<img src='/fs/thumb${absPath}'>`
			classes += ' thumbbed';
		} else {
			let cl = this._getFileClassByExt(fpath);
			if (cl) classes += ' ' + cl;
		}

		let $ic = $(`<div class='file${classes}'><i>${ic}</i><span>${fname}</span></div>`);
		$ic.click(() => {
			if (_desktop.contextMenuOpen) return;

			this.openHandler(absPath);
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
					let app = await webSys.runApp('explorer');
					app.go(absPath);
				}],
			);
		} else {
			menu.push(
				['Open outside', () => this.openFileExt(absPath)],
				['Download', () => webSys.downloadUrl(qPath)]
			);
		}

		if (FileTypes.isPicture(absPath)) {
			menu.push(['Set as background', () => {
				webSys.desktop.setBackground(qPath, true);
			}]);
		}

		menu.push(
			'-',
			['Copy', () => copyTextToClipboard(qPath)],
			['Delete', null]
		);
		return menu;
	}

	openFileExt(path) {
		window.open('/fs/q' + path, '_blank').focus();
	}

	/* Checks if a string path represents a file (image or video) that
	can have a thumbnail. */
	_doFileExtRequestThumbs(path) {
		let extensions = ['.mp4', '.webm', '.mkv', '.png', '.jpg', '.jpeg', '.webp'];

		for (let ext of extensions) {
			if (path.endsWith(ext)) return true;
		}

		return false;
	}

	_getFileClassByExt(file) {
		if (FileTypes.isAudio(file)) return 'audio';
		return null;
	}
}