/**
 * Given an element, find the range corresponding with the string begin and end positions within
 * the contained nodes.
 */
export function findWithBounds($elem: $Element, begin: number, end: number): Range {
	end--;

	let startNode: Text;
	let startOffset: number;
	let endNode: Text;
	let endOffset: number;

	// The query iteration will always point to the beginning of the current text node
	let qit = 0;
	$elem.contents().each((_, childNode: Node) => {
		// Ignore nodes that aren't other elements or text nodes
		let nType = childNode.nodeType;
		if (nType != Node.TEXT_NODE && nType != Node.ELEMENT_NODE) return true;

		// Get the text node of this node
		let textNode: Text;
		if (nType == Node.TEXT_NODE) {
			textNode = childNode as Text;
		} else {
			textNode = getTextNodeOf(childNode as HTMLElement);
		}

		let text = childNode.textContent;
		if (qit <= begin && qit + text.length >= begin) {
			startNode = textNode;
			startOffset = begin - qit;
		}

		if (qit <= end && qit + text.length >= end) {
			endNode = textNode;
			endOffset = end - qit + 1;
			return false;
		}

		qit += text.length;
		
		return true;
	});

	let range = document.createRange();
	range.setStart(startNode, startOffset);
	range.setEnd(endNode, endOffset);
	return range;
}

export function findWithText($elem: $Element, query: string): Range {
	let startNode: Text;
	let startOffset: number;
	let endNode: Text;
	let endOffset: number;

	let qit = 0;
	$elem.each((_, childNode: Node) => {
		// Ignore nodes that aren't other elements or text nodes
		let nType = childNode.nodeType;
		if (nType != Node.TEXT_NODE && nType != Node.ELEMENT_NODE) return true;

		// Get the text node of this node
		let textNode: Text;
		if (nType == Node.TEXT_NODE) {
			textNode = childNode as Text;
		} else {
			textNode = getTextNodeOf(childNode as HTMLElement);
		}

		// Iterate all characters of this text node trying to find our query string
		let text = childNode.textContent;
		for (let i = 0; i < text.length; i++) {
			// If the text mismatches our query at the current position,
			// reset the query iterator
			if (text[i] !== query[qit]) {
				qit = 0;
				continue;	
			}

			// We found a character that matches, increment the query string iterator
			// and set the starting node and offset into its text
			qit++;
			if (qit == 1) {
				startNode = textNode;
				startOffset = i;
			}

			// If we found the whole query string, mark this node as the end text node,
			// save the offset and terminate the each() iteration
			if (qit >= query.length) {
				endNode = textNode;
				endOffset = i + 1;
				return false;
			}
		}
		
		return true;
	});

	let range = document.createRange();
	range.setStart(startNode, startOffset);
	range.setEnd(endNode, endOffset);
	return range;
}

function getTextNodeOf(element: HTMLElement): Text {
	for (let node of element.childNodes) {
		if (node.nodeType == Node.TEXT_NODE) {
			return node as Text;
		}
	}
	return null;
}

export default { findWithBounds, findWithText };