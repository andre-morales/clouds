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
		
		let filesChangedFn = () => {
			let files = $formSelect[0].files;
			
			$chooseStep.toggleClass("d-none", !!files.length);
			$uploadStep.toggleClass("d-none", !files.length);
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
			FileSystem.writeUploadForm(uploadPath, $form[0]);
			
	    	ev.preventDefault();
		});
		helperWin.setVisible(true);
	}
}