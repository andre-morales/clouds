import { StackAnalyzer } from "/@sys/utils/errors/stack_analyzer.mjs";
import ErrorFormatter from '../../utils/errors/formatter.mjs'
import { UITabs } from "./tabs.mjs";

export class UIErrorDisplay extends HTMLElement {
	private $rawTraceTab: $Element;
	private $originalTraceTab: $Element;
	private $mappedTraceTab: $Element;

	constructor() {
		super();
	}

	private connectedCallback() {
		let $self = $(this);
		let tabs = $("<ui-tabs>").appendTo($self)[0] as UITabs;

		this.$mappedTraceTab = tabs.createTab("mapped", "Mapped");
		this.$mappedTraceTab.append("<header>Loading source maps...</header>");

		this.$originalTraceTab = tabs.createTab("original", "Original");
		this.$rawTraceTab = tabs.createTab("raw", "Raw");
		tabs.setActiveTab('original');
	}

	public async setError(error: Error) {
		// Raw trace
		this.$rawTraceTab.html(ErrorFormatter.formatRawAsHTML(error));

		// Original trace
		let stackList = StackAnalyzer.analyze(error);
		let html = ErrorFormatter.formatAsHTML(stackList);
		this.$originalTraceTab.html(html);

		// Mapped traces
		await stackList.resolveSourceMaps();
		html = ErrorFormatter.formatAsHTML(stackList);
		this.$mappedTraceTab.html(html);
	}
}

