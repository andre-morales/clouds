/**
 * Wraps fullscreen sub-system and allows using partial implementations of older browsers
 */
export default class FullscreenDriver {
	private static document = document as any;
	private static body = document.body as any;
	
	public static requestFullscreen = 
		this.body.requestFullscreen?.bind(this.body)
	 || this.body.webkitRequestFullscreen?.bind(this.body);

	public static exitFullscreen = 
		this.document.exitFullscreen?.bind(this.document)
	 || this.document.webkitExitFullscreen?.bind(this.document)

	public static get fullscreenElement() {
		return document.fullscreenElement || (document as any).webkitFullscreenElement;
	}	

	public static onFullscreenChange(callback: () => void) {
		if (document.body.requestFullscreen) {
			document.addEventListener('fullscreenchange', callback);
		} else if (this.body.webkitRequestFullscreen) {
			document.addEventListener('webkitfullscreenchange', callback );
		}
	}

	public static isSupported() {
		return this.requestFullscreen && this.exitFullscreen;
	}
}
