import App from "/@sys/app.mjs";
import { ClientClass } from "/@sys/client_core.mjs";
import Window from "/@sys/ui/window.mjs";

var Client: ClientClass;

export default class SystemMonitorApp extends App {
	window: Window;
	currentTab: string;
	netPolling: boolean;
	netPollTimeout: any;
	networkPollInterval: any;
	dead: boolean;
	$app: $Element;

	constructor(...args: ConstructorParameters<typeof App>) {
		super(...args);
		Client = ClientClass.get();
		this.window = null;
		this.currentTab = '';
		this.netPolling = false;
		this.netPollTimeout = null;
	}

	async init() {
		// Create window and fetch app body
		this.window = Client.desktop.createWindow(this);
		this.window.on('closing', () => {
			clearInterval(this.networkPollInterval);
			this.dead = true;
			this.exit();
		});
		this.window.setTitle('System Monitor');

		let $win = this.window.$window;
		this.$app = $win;
		let $app = $win.find('.window-body');
		$app.addClass('app-sysmonitor');

		// Fetch app body
		await this.window.setContentToUrl('/app/systemmonitor/res/main.html');
		let $tabPane = $app.find('ui-tabs');
		$tabPane[0].onTabChanged = (tab) => {
			if (tab == 'resources') {
				this.setupNetworkMonitor();
			} else {
				this.stopNetPolling();
			}
		};

		// Apps tab
		let $appTab = $win.find('.ui-tab[data-tab="apps"]');
		let makeAppEntries = () => {
			$appTab.empty();
			for (let app of Client.runningApps) {
				let $app = $(`<div class='app'>${app.classId}</div>`);
				let $endBtn = $('<button class="button">End</button>');
				$endBtn.click(() => {
					app.exit();
				});
				$app.append($endBtn);
				$appTab.append($app);
			}
		};

		Client.events.on('apps-add', makeAppEntries);
		Client.events.on('apps-rem', makeAppEntries);

		// Windows tab
		let $windowsTab = $win.find('.ui-tab[data-tab="windows"]');
		let makeWindowsEntries = () => {
			$windowsTab.empty();
			for (let win of Client.desktop.windows) {

				let $win = $(`<div class='win'>${win.title}</div>`);

				let $closeBtn = $('<button class="button">Close</button>');
				$closeBtn.click(() => {
					win.close();
				});
				$win.append($closeBtn);

				let $destroyBtn = $('<button class="button">Destroy</button>');
				$destroyBtn.click(() => {
					Client.desktop.destroyWindow(win);
				});
				$win.append($destroyBtn);

				$windowsTab.append($win);
			}
		};

		Client.desktop.events.on('window-created', makeWindowsEntries);
		Client.desktop.events.on('window-destroyed', makeWindowsEntries);

		makeAppEntries();
		makeWindowsEntries();
		this.setupNetworkMonitor();

		// Make the window visible
		this.window.setVisible(true);
	}

	setupNetworkMonitor() {
		if (this.netPolling) return;
		this.netPolling = true;

		let lastWrittenBytes = 0;
		let lastReadBytes = 0;
		let writtenBytesDelta = 0;
		let readBytesDelta = 0;

		let asMbits = (bytes) => {
			let kbits = bytes / 125;
			let mbits = kbits / 1000;

			if (mbits > 1) {
				return mbits.toFixed(1) + ' Mb';
			} else {
				return kbits.toFixed(1) + ' Kb';
			}		
		};

		let asMiB = (bytes) => {
			let kib = bytes / 1024;
			let mib = kib / 1024;
			
			if (mib > 1) {
				return mib.toFixed(1) + " MiB";
			} else {
				return kib.toFixed(1) + " KiB";
			}
		};

		let networkPollCallback = async () => {
			if (this.dead) return;
			if (!this.netPolling) return;

			const dataMul = 2;
			const pollInterval = 500;

			let fres;
			try {
				let freq = await fetch('/stat/net');
				fres = await freq.json();
			} catch(err) {
				this.netPollTimeout = setTimeout(networkPollCallback, 3000);
				return;
			}

			if (lastWrittenBytes != 0) {
				writtenBytesDelta = fres.bytesWritten - lastWrittenBytes;
				readBytesDelta = fres.bytesRead - lastReadBytes;

				this.$app.find('.bytes-received').text(asMbits(writtenBytesDelta * dataMul) + 'ps');
				this.$app.find('.bytes-sent').text(asMbits(readBytesDelta * dataMul) + 'ps');
			}

			lastWrittenBytes = fres.bytesWritten;
			lastReadBytes = fres.bytesRead;

			this.$app.find('.total-bytes-received').text(asMiB(fres.bytesWritten * dataMul));
			this.$app.find('.total-bytes-sent').text(asMiB(fres.bytesRead * dataMul));

			this.netPollTimeout = setTimeout(networkPollCallback, pollInterval);
		}

		this.netPollTimeout = setTimeout(networkPollCallback, 0)
	}

	stopNetPolling() {
		clearTimeout(this.netPollTimeout);
		this.netPolling = false;
	}
}