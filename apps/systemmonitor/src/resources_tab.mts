import SystemMonitorApp from "./core.mjs";

export default class FetchesTab {
	private app: SystemMonitorApp;
	private $tab: $Element;
	private socket: WebSocket;

	constructor(app: SystemMonitorApp) {
		this.app = app;
		this.$tab = app.$app.find('.resources-tab');
	}

	focus() {
		if (this.socket) return;
		
		let wsURL = new URL('/stat/ws', window.location.href);
		wsURL.protocol = 'ws';
		this.socket = new WebSocket(wsURL);

		let lastWrittenBytes = 0;
		let lastReadBytes = 0;
		let writtenBytesDelta = 0;
		let readBytesDelta = 0;

		let asMbits = (bytes: number) => {
			let kbits = bytes / 125;
			let mbits = kbits / 1000;

			if (mbits > 1) {
				return mbits.toFixed(1) + ' Mb';
			} else {
				return kbits.toFixed(1) + ' Kb';
			}		
		};

		let asMiB = (bytes: number) => {
			let kib = bytes / 1024;
			let mib = kib / 1024;
			
			if (mib > 1) {
				return mib.toFixed(1) + " MiB";
			} else {
				return kib.toFixed(1) + " KiB";
			}
		};

		this.socket.onclose = () => {
			this.socket = null;
		}

		this.socket.onmessage = (ev) => {
			let fRes = JSON.parse(ev.data);

			if (lastWrittenBytes != 0) {
				writtenBytesDelta = fRes.bytesWritten - lastWrittenBytes;
				readBytesDelta = fRes.bytesRead - lastReadBytes;

				this.$tab.find('.bytes-received').text(asMbits(writtenBytesDelta) + 'ps');
				this.$tab.find('.bytes-sent').text(asMbits(readBytesDelta) + 'ps');
			}

			lastWrittenBytes = fRes.bytesWritten;
			lastReadBytes = fRes.bytesRead;

			this.$tab.find('.total-bytes-received').text(asMiB(fRes.bytesWritten));
			this.$tab.find('.total-bytes-sent').text(asMiB(fRes.bytesRead));
		}
	}

	unfocus() {
		if (this.socket) {
			this.socket.close();
			this.socket = null;
		}
	}

	exit() {
		this.unfocus();
	}
}