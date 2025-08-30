import { SITE_URL } from "~/consts";

export function createProxyImageUrl(originalUrl: string): string {
	const frontendUrl = process.env.FRONTEND_URL || SITE_URL;
	const ghostApiUrl = process.env.GHOST_API_URL || "";
	const imageUrlPrefix = `${ghostApiUrl}/content/images/`;

	if (!originalUrl || !ghostApiUrl || !originalUrl.startsWith(imageUrlPrefix)) {
		return originalUrl;
	}

	const imagePath = originalUrl.replace(imageUrlPrefix, "");
	return `${frontendUrl}/api/image-proxy?path=${imagePath}`;
}
