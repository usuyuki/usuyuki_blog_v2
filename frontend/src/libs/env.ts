export function getGhostApiUrl(): string | undefined {
	return import.meta.env.GHOST_API_URL;
}

export function getGhostContentKey(): string | undefined {
	return import.meta.env.GHOST_CONTENT_KEY;
}

export function getExternalBlogs(): string | undefined {
	return import.meta.env.EXTERNAL_BLOGS;
}

export function getFrontendUrl(): string | undefined {
	return import.meta.env.FRONTEND_URL;
}
