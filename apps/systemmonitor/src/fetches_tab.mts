import SystemMonitorApp from "./core.mjs";
import { ClientClass } from "/@sys/client_core.mjs";
import Strings from "/@sys/utils/strings.mjs";
import { FetchEvent } from "/@sys/watson/watson_tools.mjs";

export default class FetchesTab {
	private app: SystemMonitorApp;
	private $networkTab: $Element;

	constructor(app: SystemMonitorApp) {
		this.app = app;
		let $app = app.$app;
		this.$networkTab = $app.find('.fetches-tab');
		this.setup();
	}

	private setup() {
		const Watson = ClientClass.get().watson;
		for (let ev of Watson.fetchHistory) {
			this.trackFetchCall(ev);
		}
		Watson.events.on('fetch', (ev) => {
			this.trackFetchCall(ev);
		});
	}

	private trackFetchCall(ev: FetchEvent) {
		const $requests = this.$networkTab.find('tbody');

		let $req = $("<tr></tr>");

		let $status = $("<td>...</td>");
		let $method = $(`<td>${ev.request.method}</td>`);
		let $resource = $(`<td>${new URL(ev.request.url).pathname}</td>`);
		let $time = $("<td></td>").appendTo($req);
		let $size = $("<td>-</td>").appendTo($req);
		
		($req as any).append([$status, $method, $resource, $time, $size]);

		ev.promise.then(res => {
			$status.text(res.status.toString());
			$time.text((ev.getEndTime() - ev.timeStamp) + ' ms');
			$size.text(this.sizeToText(ev.getResponseSize()));
		})	
		
		// If the content in the table is scrolled to the bottom, we will auto-scroll it again with
		// the new content
		let scroll;
		let cont: HTMLElement = this.$networkTab[0];
		if (cont.scrollTop + cont.offsetHeight >= cont.scrollHeight - 2) {
			scroll = true;
		}
		
		// Add the new line and scroll the table if needed
		$requests.append($req);
		if (scroll) {
			cont.scrollTo(cont.scrollLeft, cont.scrollHeight);
		}
	}

	private sizeToText(size: number): string {
		if (Number.isNaN(size)) return '-';

		return Strings.fromDataSize(size);
	}
}