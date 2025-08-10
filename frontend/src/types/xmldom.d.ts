// xmldom module type declaration
declare module "xmldom" {
	export class DOMParser {
		parseFromString(source: string, mimeType: string): Document;
	}
}

// DOM Element types for better typing
type DOMElement = Element | null;
type DOMNodeList = NodeListOf<Element> | Element[];
type DOMTextContent = string;
