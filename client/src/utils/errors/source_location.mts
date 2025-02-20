export class SourceLocation {
	public readonly isDummy: boolean;
	public readonly description: string;
	public readonly functionName: string;
	public readonly file: string;
	public readonly lineNo: number;
	public readonly columnNo: number;

	constructor(rootLine: string, fnName: string, file: string, lineNo: number, columnNo: number) {
		this.description = rootLine;
		if (fnName !== undefined) {
			this.isDummy = false;
			this.functionName = fnName;
			this.file = file;
			this.lineNo = lineNo;
			this.columnNo = columnNo;
		} else {
			this.isDummy = true;
		}
	}

	public getShortFilename() {
		try {
			let fileStr = new URL(this.file).pathname.split('/');
			let lastElement = fileStr.pop();
			if (lastElement.length == 0) {
				lastElement = (fileStr.pop() ?? '') + '/';
			}
	
			return lastElement;
		} catch (err) {
			return this.file;
		}
	}

	toString() {
		return `${this.functionName}@${this.file}:${this.lineNo}:${this.columnNo}`
	}
}

export default SourceLocation;