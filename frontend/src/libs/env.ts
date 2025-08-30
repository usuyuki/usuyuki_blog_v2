import loggerService from "./logger.ts";

function isServer(): boolean {
	return typeof process !== "undefined" && !!process.env;
}

export function getGhostApiUrl(): string {
	const url = isServer()
		? process.env.GHOST_API_URL
		: import.meta.env.GHOST_API_URL;
	if (!url) {
		loggerService.error("GHOST_API_URL environment variable is required");
		throw new Error("GHOST_API_URL environment variable is required");
	}
	return url;
}

export function getGhostContentKey(): string {
	const key = isServer()
		? process.env.GHOST_CONTENT_KEY
		: import.meta.env.GHOST_CONTENT_KEY;
	if (!key) {
		loggerService.error("GHOST_CONTENT_KEY environment variable is required");
		throw new Error("GHOST_CONTENT_KEY environment variable is required");
	}
	return key;
}

export function getExternalBlogs(): string | undefined {
	return isServer()
		? process.env.EXTERNAL_BLOGS
		: import.meta.env.EXTERNAL_BLOGS;
}

export function getFrontendUrl(): string {
	const url = isServer()
		? process.env.FRONTEND_URL
		: import.meta.env.FRONTEND_URL;
	if (!url) {
		loggerService.error("FRONTEND_URL environment variable is required");
		throw new Error("FRONTEND_URL environment variable is required");
	}
	return url;
}
export function getGhostFrontUrl(): string {
	const url = isServer()
		? process.env.GHOST_FRONT_URL
		: import.meta.env.GHOST_FRONT_URL;
	if (!url) {
		loggerService.error("GHOST_FRONT_URL environment variable is required");
		throw new Error("GHOST_FRONT_URL environment variable is required");
	}
	return url;
}
