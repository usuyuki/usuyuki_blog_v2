import { SITE_URL } from "~/consts";
import { getFrontendUrl, getGhostApiUrl } from "./env";

export function createProxyImageUrl(originalUrl: string): string {
	const frontendUrl = getFrontendUrl() || SITE_URL;
	const ghostApiUrl = getGhostApiUrl();
	const imageUrlPrefix = `${ghostApiUrl}/content/images/`;

	if (!originalUrl || !ghostApiUrl || !originalUrl.startsWith(imageUrlPrefix)) {
		return originalUrl;
	}

	const imagePath = originalUrl.replace(imageUrlPrefix, "");
	return `${frontendUrl}/api/image-proxy?path=${imagePath}`;
}
