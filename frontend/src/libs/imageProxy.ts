import { SITE_URL } from "~/consts";

export function createProxyImageUrl(originalUrl: string): string {
	const backendApiUrl = import.meta.env.BACKEND_API_URL || "";
	const imageUrlPrefix = `${backendApiUrl}/content/images/`;

	if (
		!originalUrl ||
		!backendApiUrl ||
		!originalUrl.startsWith(imageUrlPrefix)
	) {
		return originalUrl;
	}

	const encodedUrl = encodeURIComponent(originalUrl);
	return `${SITE_URL}/api/image-proxy?url=${encodedUrl}`;
}
