import { ContextMenu } from '/@sys/ui/context_menu.mjs';
import { Paths } from '/@sys/bridges/filesystem.mjs';
import Window, { CloseBehavior } from '/@sys/ui/window.mjs';
import { ClientClass } from '/@sys/client_core.mjs';
import App from '/@sys/app.mjs';

var Client: ClientClass;

export default class WebViewApp extends App {
	window: Window;
	$app: $Element;
	$iframe: $Element;
	path: string;

	constructor(...args: ConstructorParameters<typeof App>) {
		super(...args);
		Client = ClientClass.get();
		this.window = null;
	}

	async init() {
		// Create window and fetch app body
		this.window = Client.desktop.createWindow(this);
		this.window.setCloseBehavior(CloseBehavior.EXIT_APP);
		this.window.setTitle('WebView');

		let $app = this.window.$window.find('.window-body');
		this.$app = $app;
		$app.addClass('app-webview');

		// Fetch application body
		await this.window.setContentToUrl('/app/webview/main.html');
		
		let fileMenu = ContextMenu.fromDefinition([
			['-Open...', () => { this.showOpenDialog(); }],
			['|'],
			['-Exit', () => { this.window.close(); }]
		]);
	
		$app.find('.file-menu').click((ev: MouseEvent) => {
			Client.desktop.openCtxMenuAt(fileMenu, ev.clientX, ev.clientY);
		});

		this.$iframe = $app.find("iframe");

		this.window.setVisible(true);

		// If launched with a path (opening a file)
		if (this.buildArgs.length > 0) {
			this.setPath(this.buildArgs[0]);
		}
	}

	async showOpenDialog() {
		let app = await Client.runApp('explorer') as any;
		app.asFileSelector('open', 'one');
		let result = await app.waitFileSelection();
		if (!result || !result.length) return;

		let file = result[0];
		this.setPath(Paths.toFSV(file));
	}
	
	setPath(path) {
		this.path = path;
		if (!path) {
			this.window.setTitle('WebView');
			return;
		}

		this.window.setTitle(Paths.file(path));

		if (path.endsWith('.pdf')) {
			let url = this.getPDFViewerURL(path);
			if (url != null) {
				this.$iframe[0].src = url;
				return;
			}
		}

		// Use native viewer for resource
		this.$iframe[0].src = path;	
	}

	getPDFViewerURL(path: string) {
		let viewer: string = Client.config.preferences.pdf_viewer;
		if (!viewer) return null;

		if (viewer.startsWith('pdfjs-')) {
			let [_, version, variant] = viewer.split('-');

			return `/res/lib/pdfjs/${version}-${variant}/web/viewer.html?file=${encodeURIComponent(path)}`;
		}

		return null;
	}
}