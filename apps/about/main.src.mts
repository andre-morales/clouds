import { ClientClass } from "/@sys/client_core.mjs";
import { App } from '/@sys/app.mjs';
import Window  from '/@sys/ui/window.mjs';

export default class AboutApp extends App {
	window: Window;

	constructor(...args: ConstructorParameters<typeof App>) {
		super(...args);
		
		this.window = null;
	}

	async init() {
		this.window = ClientClass.get().desktop.createWindow(this);
		this.window.setTitle('About');
		this.window.setCloseBehavior('exit');
		
		let $app = this.window.$window.find('.window-body');
		$app.addClass('app-about');
		await this.window.setContentToUrl('/app/about/body.html');

		// Client Tab
		let clientStr = `Version ${ClientClass.BUILD_STRING}`;
		$app.find('.version').text(clientStr);

		let serverStr = `KAPI ${ClientClass.API_VERSION}`;
		$app.find('.api-version').text(serverStr);

		// Platform tab
		let secure = window.isSecureContext;
		$app.find('.secure-ctx').text((secure) ? 'Yes' : 'No');
		
		let devmem = (navigator as any).deviceMemory;
		if (devmem) {
			let str = (devmem < 1) ? devmem * 1000 + ' MB' : devmem + ' GB';
			$app.find('.dev-memory').text('Device Memory: ' + str);
		}

		let memory = this.getRam();
		let memoryStr = `Max JS Memory: ${memory} MiB`;
		$app.find('.js-memory').text(memoryStr);

		$app.find('.pdfs').text(this.isPDFViewingSupported());

		let userAgentStr = navigator.userAgent;
		$app.find('.user-agent').text("User Agent: " + userAgentStr);

		this.window.setVisible(true);
	}

	getRam() {
		let perf : any = performance;
		if (!perf || !perf.memory) return '?';

		let ram = perf.memory.jsHeapSizeLimit / 1024 / 1024;
		return ram.toFixed(0);
	}

	isPDFViewingSupported() {
		if (navigator.pdfViewerEnabled) return 'Yes';

		for (let i = 0; i < navigator.plugins.length; i++) {
			if (navigator.plugins[i].name.toLowerCase().includes('pdf'))
				return 'Maybe';
		}

		return 'No';
	}
}