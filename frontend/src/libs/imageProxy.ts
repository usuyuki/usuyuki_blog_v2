import { SITE_URL } from "~/consts";
import { getFrontendUrl, getGhostFrontUrl } from "./env";

export function createProxyImageUrl(originalUrl: string): string {
	const frontendUrl = getFrontendUrl() || SITE_URL;
	const ghostFrontUrl = getGhostFrontUrl(); // 外向きのURLがimageのパスに入っているのでこっちを採用
	const imageUrlPrefix = `${ghostFrontUrl}/content/images/`;

	if (
		!originalUrl ||
		!ghostFrontUrl ||
		!originalUrl.startsWith(imageUrlPrefix)
	) {
		return originalUrl;
	}

	const imagePath = originalUrl.replace(imageUrlPrefix, "");
	return `${frontendUrl}/api/image-proxy?path=${imagePath}`;
}
