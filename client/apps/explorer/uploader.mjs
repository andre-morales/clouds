export default class ExplorerUploader {
	constructor(explorer) {
		this.explorer = explorer;
	}

	async open() {
		let helperWin = Client.desktop.createWindow(this.explorer);
		helperWin.setOwner(this.explorer.window);
		
		await helperWin.setContentToUrl('/app/explorer/res/upload-helper.html');
		helperWin.setTitle('Upload to: ' + Paths.file(this.explorer.cwd));
		helperWin.setSize(380, 270);
		helperWin.bringToCenter();
		helperWin.bringToFront();

		let uploadPath = this.explorer.cwd;
		
		let $win = helperWin.$window.find(".window-body");
		this.$win = $win;
		$win.addClass("fileupload-helper");
		
		let $progressBar = $win.find('progress');
		let $uploadStatus = $win.find('.status');
		$win.find('.ok-btn').click(() => {
			this.clearFiles();
			this.setStep('choose');
			this.explorer.refresh();
		});

		let filesChangedFn = () => {
			let files = $formSelect[0].files;

			if (files.length > 0) {
				this.setStep('upload');
			} else {
				this.setStep('choose');
			}
		};
		
		let $form = $win.find('form');
		let $formSelect = $form.find(".form-select");
		let $formSubmit = $form.find(".form-submit");
		$formSelect.on("change", filesChangedFn);
		
		$win.find('.clear-btn').click(() => {
			this.clearFiles();
			filesChangedFn();
		});
		
		$win.find('.upload-btn').click(() => {
			$formSubmit.click();
		});
		
		$win.find('.select-btn').click(() => {
			$formSelect.click();
		});
		
		$form.on('submit', (ev) => {
			FileSystem.writeUploadForm(uploadPath, $form[0], (req) => {
				req.addEventListener('loadend', (ev) => {
					this.setStep('finish');
				});
				req.upload.addEventListener('progress', (ev) => {
					$progressBar.val(1.0 * ev.loaded / ev.total);
				});
				req.upload.addEventListener('load', (ev) => {
					$uploadStatus.text("Transfer complete.");
				});
				req.upload.addEventListener('error', (ev) => {
					$uploadStatus.text("Transfer failed!");
				});
				req.upload.addEventListener('abort', (ev) => {
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

	clearFiles() {
		this.$win.find(".form-select")[0].value = null;
	}

	setStep(name) {
		this.$win.find('.step').addClass('d-none');
		this.$win.find(`.${name}-step`).removeClass('d-none');
	}
}