export default class ExplorerUploader {
	constructor(explorer) {
		this.explorer = explorer;
	}

	async open() {
		let helperWin = Client.desktop.createWindow(this.explorer);
		helperWin.setOwner(this.explorer.window);
		
		await helperWin.setContentToUrl('/app/explorer/res/upload-helper.html');
		helperWin.setTitle('Upload to: ' + this.explorer.cwd);
		helperWin.setSize(380, 270);
		helperWin.bringToCenter();
		helperWin.bringToFront();

		let uploadPath = this.explorer.cwd;
		
		let $win = helperWin.$window.find(".window-body");
		$win.addClass("fileupload-helper");
		
		let $chooseStep = $win.find(".choose-step");
		let $uploadStep = $win.find(".upload-step");
		let $progressStep = $win.find('.progress-step');
		let $progressBar = $progressStep.find('progress');
		let $uploadStatus = $progressStep.find('.status');

		let filesChangedFn = () => {
			let files = $formSelect[0].files;

			let chosen = files.length > 0;
			$chooseStep.toggleClass("d-none", chosen);
			$uploadStep.toggleClass("d-none", !chosen);	
			$progressStep.toggleClass("d-none", chosen);
		};
		
		let $form = $win.find('form');
		let $formSelect = $form.find(".form-select");
		let $formSubmit = $form.find(".form-submit");
		$formSelect.on("change", filesChangedFn);
		
		$win.find('.clear-btn').click(() => {
			$formSelect[0].value = null;
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

			$chooseStep.toggleClass("d-none", true);
			$uploadStep.toggleClass("d-none", true);	
			$progressStep.toggleClass("d-none", false);

	    	ev.preventDefault();
		});

		$form.on('')
		helperWin.setVisible(true);
	}
}