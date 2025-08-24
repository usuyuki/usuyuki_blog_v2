interface ImageDimensions {
	width: number;
	height: number;
}

export function optimizeGhostImageUrl(
	originalUrl: string,
	dimensions: ImageDimensions,
	quality = 80,
): string {
	if (!originalUrl) return originalUrl;
	
	// Ghost CMS doesn't support URL query parameters for image optimization
	// The image optimization should be handled at the Ghost theme level
	// or through Astro's Image component which will handle the optimization
	return originalUrl;
}

export function getResponsiveImageSizes(baseWidth: number, baseHeight: number) {
	const aspectRatio = baseHeight / baseWidth;

	return {
		small: {
			width: Math.min(baseWidth, 400),
			height: Math.min(baseHeight, 400 * aspectRatio),
		},
		medium: {
			width: Math.min(baseWidth, 800),
			height: Math.min(baseHeight, 800 * aspectRatio),
		},
		large: {
			width: Math.min(baseWidth, 1200),
			height: Math.min(baseHeight, 1200 * aspectRatio),
		},
	};
}
