import type ExplorerApp from './explorer.mjs';
import { FileSystem, Paths } from '/@sys/drivers/filesystem.mjs';
import { ClientClass } from '/@sys/client_core.mjs';

var Client: ClientClass;

enum UploadStep {
	CHOOSE = 'choose',
	CONFIRM = 'confirm',
	PROGRESS = 'progress',
	FINISH = 'finish'
}

enum UploadResult {
	NONE, SUCCESSFUL, FAILED, ABORTED
}

export default class ExplorerUploader {
	private explorer: ExplorerApp;
	private currentRequest: XMLHttpRequest;
	private $win: $Element;
	private $formSelect: $Element;

	constructor(explorer: ExplorerApp) {
		Client = ClientClass.get();
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

		let $win = this.$win = helperWin.$window.find(".window-body");
		$win.addClass("fileupload-helper");
		
		let $form = $win.find('form');
		this.$formSelect = $form.find(".form-select");
		this.$formSelect.on("change", () => this.doFileSelect());
		
		// Upload select step
		$win.find('.select-btn').click(() => {
			// Select button emulated a click
			this.$formSelect.click();
		});

		// Upload confirm step
		$win.find('.clear-btn').click(() => {
			this.clearFiles();
			this.doFileSelect();
		});
		
		$win.find('.upload-btn').click(() => {
			// Pretend the submit button was clicked
			$form.find(".form-submit").click();
		});
		
		// Progress step
		$win.find('.cancel-btn').click(() => {
			if (this.currentRequest)
				this.currentRequest.abort();
		});

		// Progress finished
		$win.find('.ok-btn').click(() => {
			this.clearFiles();
			this.setStep(UploadStep.CHOOSE);
		});
		
		$form.on('submit', (ev) => {
			let uploadPath = this.explorer.cwd;
			this.performUpload(uploadPath);
	    	ev.preventDefault();
		});

		helperWin.setVisible(true);
	}

	performUpload(uploadPath: string) {
		const $win = this.$win;
		const $form = $win.find('form');
		const $progressBar = $win.find('progress');
		const $progressText = $win.find('.progress-text');
		const $uploadStatus = $win.find('.status');
		let status = UploadResult.NONE;

		$progressBar.val(0);
		$progressText.text('');
		FileSystem.writeUploadForm(uploadPath, $form[0], (req) => {
			this.currentRequest = req;
			
			req.addEventListener('loadend', () => {
				this.setStep(UploadStep.FINISH);
				this.explorer.refresh();
				this.currentRequest = null;
				
				if (status == UploadResult.NONE) {
					$uploadStatus.text("ERROR: Transfer ended unexpectedly!");
				}
			});

			req.upload.addEventListener('progress', (ev) => {
				$progressBar.val(1.0 * ev.loaded / ev.total);
				$progressText.text(toProgressString(ev.loaded, ev.total));
			});

			req.upload.addEventListener('load', () => {
				$uploadStatus.text("Transfer successful!");
				status = UploadResult.SUCCESSFUL;
			});

			req.upload.addEventListener('error', () => {
				$uploadStatus.text("ERROR: Transfer failed!");
				status = UploadResult.FAILED;
			});

			req.upload.addEventListener('abort', () => {
				$uploadStatus.text("ERROR: Transfer canceled!");
				status = UploadResult.ABORTED;
			});
		});

		this.setStep(UploadStep.PROGRESS);
		$uploadStatus.text("Uploading...");
	}

	doFileSelect() {
		let files = this.$formSelect[0].files;

		if (files.length > 0) {
			this.setStep(UploadStep.CONFIRM);
		} else {
			this.setStep(UploadStep.CHOOSE);
		}
	}

	clearFiles() {
		this.$win.find(".form-select")[0].value = null;
	}

	setStep(step: UploadStep) {
		this.$win.find('.step').addClass('d-none');
		this.$win.find(`.${step}-step`).removeClass('d-none');
	}
}

function toProgressString(x: number, total: number) {
	const units = ['KB', 'MB', 'GB'];

	let unit: string;
	const val = () => `${x.toFixed(2)} / ${total.toFixed(2)} ${unit}`;

	for(let u of units) {
		unit = u;
		x /= 1024;
		total /= 1024;

		if (total < 2048) break;	
	}

	return val();
}