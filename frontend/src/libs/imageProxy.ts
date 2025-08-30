import { SITE_URL } from "~/consts";
import { getFrontendUrl, getGhostFrontUrl } from "./env";

export function createProxyImageUrl(originalUrl: string): string {
	const frontendUrl = getFrontendUrl() || SITE_URL;
	const ghostFrontUrl = getGhostFrontUrl();
	const imageUrlPrefix = `${ghostFrontUrl}/content/images/`;

	if (!originalUrl || !ghostFrontUrl) {
		return originalUrl;
	}

	if (originalUrl.startsWith(imageUrlPrefix)) {
		const imagePath = originalUrl.replace(imageUrlPrefix, "");
		return `${frontendUrl}/image-proxy/${imagePath}`;
	}

	return originalUrl;
}
