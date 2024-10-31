import { ClientClass } from "/@sys/client_core.mjs";
import { App } from '/@sys/app.mjs';
import Window, { CloseBehavior } from '/@sys/ui/window.mjs';

export default class AboutApp extends App {
	window: Window;

	constructor(...args: ConstructorParameters<typeof App>) {
		super(...args);
		
		this.window = null;
	}

	async init() {
		this.window = ClientClass.get().desktop.createWindow(this);
		this.window.setTitle('About');
		this.window.setCloseBehavior(CloseBehavior.EXIT_APP);
		
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
		
		let devMem = (navigator as any).deviceMemory;
		if (devMem) {
			let str = (devMem < 1) ? devMem * 1000 + ' MB' : devMem + ' GB';
			$app.find('.dev-memory').text(str);
		}

		let memory = this.getRam();
		if (memory) {
			$app.find('.js-memory').text(`${memory} MiB`);
		}

		$app.find('.pdf-viewer').text(this.isPDFViewingSupported());

		let userAgentStr = navigator.userAgent;
		$app.find('.user-agent').text(userAgentStr);

		// Build modes
		$app.find('.core-build-mode').text(ClientClass.BUILD_MODE);
		$app.find('.apps-build-mode').text(__BUILD_MODE__);

		this.window.setVisible(true);
	}

	getRam(): string {
		let perf: any = performance;
		if (!perf?.memory) return null;

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