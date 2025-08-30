import { SITE_URL } from "~/consts";

export function createProxyImageUrl(originalUrl: string): string {
	if (
		!originalUrl ||
		!originalUrl.startsWith("https://blogapi.usuyuki.net/content/images/")
	) {
		return originalUrl;
	}

	const encodedUrl = encodeURIComponent(originalUrl);
	return `${SITE_URL}/api/image-proxy?url=${encodedUrl}`;
}
