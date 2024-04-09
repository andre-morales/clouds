import { FileSystem, Paths } from '/res/js/filesystem.mjs';

export default class ExplorerUploader {
	constructor(explorer) {
		this.explorer = explorer;
	}

	async open() {
		let helperWin = Client.desktop.createWindow(this.explorer);
		helperWin.setOwner(this.explorer.window);
		
		await helperWin.setContentToUrl('/app/explorer/res/upload-win.html');
		helperWin.setTitle('Upload to: ' + Paths.file(this.explorer.cwd));
		helperWin.setSize(380, 270);
		helperWin.bringToCenter();
		helperWin.bringToFront();

		let $win = helperWin.$window.find(".window-body");
		this.$win = $win;
		$win.addClass("fileupload-helper");
		
		let $progressBar = $win.find('progress');
		let $uploadStatus = $win.find('.status');
		$win.find('.ok-btn').click(() => {
			this.clearFiles();
			this.setStep('choose');
		});
		
		let $form = $win.find('form');
		this.$formSelect = $form.find(".form-select");
		this.$formSelect.on("change", () => this.doFileSelect());
		
		$win.find('.clear-btn').click(() => {
			this.clearFiles();
			this.doFileSelect();
		});
		
		$win.find('.upload-btn').click(() => {
			// Pretend the submit button was clicked
			$form.find(".form-submit").click();
		});
		
		$win.find('.select-btn').click(() => {
			// Select button emulated a click
			this.$formSelect.click();
		});
		
		$form.on('submit', (ev) => {
			let uploadPath = this.explorer.cwd;
			FileSystem.writeUploadForm(uploadPath, $form[0], (req) => {
				req.addEventListener('loadend', () => {
					this.setStep('finish');
					this.explorer.refresh();
				});

				req.upload.addEventListener('progress', (ev) => {
					$progressBar.val(1.0 * ev.loaded / ev.total);
				});

				req.upload.addEventListener('load', () => {
					$uploadStatus.text("Transfer complete.");
				});

				req.upload.addEventListener('error', () => {
					$uploadStatus.text("Transfer failed!");
				});

				req.upload.addEventListener('abort', () => {
					$uploadStatus.text("Transfer canceled!");
				});
			});

			$uploadStatus.text("Uploading...");

			this.setStep('progress');
	    	ev.preventDefault();
		});

		$form.on('')
		helperWin.setVisible(true);
	}

	doFileSelect() {
		let files = this.$formSelect[0].files;

		if (files.length > 0) {
			this.setStep('upload');
		} else {
			this.setStep('choose');
		}
	}

	clearFiles() {
		this.$win.find(".form-select")[0].value = null;
	}

	setStep(name) {
		this.$win.find('.step').addClass('d-none');
		this.$win.find(`.${name}-step`).removeClass('d-none');
	}
}