import MediaPlayer from "./media_player.mjs";

export abstract class Container {
	protected player: MediaPlayer;
	protected contentUrl: string;
	protected $root: $Element;
	protected enabled: boolean;

	constructor(player: MediaPlayer, $root: $Element) {
		this.player = player;
		this.$root = $root;
	}

	setContentUrl(url: string): void {
		this.contentUrl = url;
	}

	getContentUrl(): string {
		return this.contentUrl;
	}

	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
		this.$root.toggleClass('enabled', enabled);
	}

	isEnabled() {
		return this.isEnabled;
	}

	getRoot() {
		return this.$root;
	}

	abstract unload(): void;

	abstract getMediaElement(): $Element;
}