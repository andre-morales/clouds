export default class AboutApp extends App {
	constructor(...args) {
		super(...args);

		this.window = null;
	}

	async init() {
		this.window = Client.desktop.createWindow(this);
		this.window.setTitle('About');
		this.window.setSize(380, 270);
		let $app = this.window.$window.find('.window-body');
		$app.addClass('app-about');
		await this.window.setContentToUrl('/app/about/body.html');

		// Tab pane behavior
		let $tabPane = $app.find('.tabpane');
		$tabPane.find('button').click((ev) => {
			let tab = ev.target.getAttribute('data-tab');
			$tabPane.find('.header .button').removeClass('selected');
			$tabPane.find('.tab').removeClass('visible');

			ev.target.classList.add('selected');
			$tabPane.find(`.tab[data-tab='${tab}']`).addClass('visible');
		});

		// Client Tab
		let clientStr = `Version ${Client.BUILD_STRING}`;
		$app.find('.version').text(clientStr);

		let serverStr = `KAPI ${Client.API_VERSION}`;
		$app.find('.api-version').text(serverStr);

		// Platform tab
		let userAgentStr = navigator.userAgent;
		$app.find('.user-agent').text("User Agent: " + userAgentStr);
		
		let ram = performance.memory.jsHeapSizeLimit / 1024 / 1024;
		let memoryStr = `Max JS RAM: ${ram.toFixed(0)} MiB`;
		$app.find('.memory').text(memoryStr);

		$app.find('.pdfs').text(this.isPDFViewingSupported());

		this.window.setVisible(true);
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