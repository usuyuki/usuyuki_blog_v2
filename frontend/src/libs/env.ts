function isServer(): boolean {
	return typeof process !== "undefined" && !!process.env;
}

export function getGhostApiUrl(): string | undefined {
	return isServer() ? process.env.GHOST_API_URL : import.meta.env.GHOST_API_URL;
}

export function getGhostContentKey(): string | undefined {
	return isServer()
		? process.env.GHOST_CONTENT_KEY
		: import.meta.env.GHOST_CONTENT_KEY;
}

export function getExternalBlogs(): string | undefined {
	return isServer()
		? process.env.EXTERNAL_BLOGS
		: import.meta.env.EXTERNAL_BLOGS;
}

export function getFrontendUrl(): string | undefined {
	return isServer() ? process.env.FRONTEND_URL : import.meta.env.FRONTEND_URL;
}
export function getGhostFrontUrl(): string | undefined {
	return isServer()
		? process.env.GHOST_FRONT_URL
		: import.meta.env.GHOST_FRONT_URL;
}
