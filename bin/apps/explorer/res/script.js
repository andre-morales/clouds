window.ExplorerApp = class ExplorerApp extends App {
	constructor(webSys) {
		super(webSys);
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
			        success: function(result){
			            console.log(result);
			        }
			    });

		    	ev.preventDefault();
			});
			helperWin.setVisible(true);
		});

		// Go to home page
		await this.goHome();

		// Make the window visible
		this.window.setVisible(true);
	}

	async navigate(path) {
		this.go(pathJoin(this.cwd, path));
	}

	async go(path) {
		this.$addressField.val(path);

		let fres = await fetch('/fs/ls' + path);
		if (fres.status == 404) {
			this._sys.showErrorDialog("Can't find '" + path + "'");
			this.$addressField.val(this.cwd);
			return 404;
		}

		this.cwd = path;
		this.$files.empty();
		this.$files.css('display', 'none');

		let files = await fres.json();

		files.sort((a, b) => {
			let A = a.endsWith('/');
			let B = b.endsWith('/');

			if (A == B) return a.localeCompare(b);
			
			if (A) return -1;
			if (B) return 1;
			
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

	makeFileIcon(fpath, callback) {
		let _desktop = this._sys.desktop;

		let fname = fpath;
		let absPath = pathJoin(this.cwd, fpath);
		let isDir = fpath.endsWith('/');

		let classes = 'file';
		let ic = '';
		if (isDir) {
			classes += ' dir';
			fname = fpath.slice(0, -1);
		} else if (this._doFileExtRequestThumbs(fpath)) {
			ic = `<img src='/fs/thumb${absPath}'>`
			classes += ' thumbbed';
		} else {
			let cl = this._getFileClassByExt(fpath);
			if (cl) classes += ' ' + cl;
		}
		let $ic = $(`<div class='${classes}'><i>${ic}</i><span>${fname}</span></div>`);
		$ic.click(() => {
			if (_desktop.contextMenuOpen) return;

			if(isDir) this.go(absPath);
			else {
				this.openFileExt(absPath);
			}
		});

		let menu;
		if (isDir) {
			menu = [
				['Open', () => this.go(absPath)]
			];
		} else {
			menu = [
				['Open', () => this.openFileExt(absPath)],
				['Download', () => this.downloadFile(absPath)],
				'-',
				['Delete', null]
			];
		}
		_desktop.addContextMenuOn($ic, menu);
		return $ic;
	}

	openFileExt(path) {
		window.open('/fs/q' + path, '_blank').focus();
	}

	downloadFile(path) {
		let link = document.createElement('a');
		link.style.display = 'none';
		link.href = '/fs/q' + path;
		link.download = '';
		document.body.appendChild(link);
		link.click();
		link.remove();
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
		let extensions = ['.mp3', '.m4a'];

		for (let ext of extensions) {
			if (file.endsWith(ext)) return 'audio';
		}
	}
}