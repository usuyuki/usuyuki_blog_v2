import astroLogger from "./astroLogger";

let envLogged = false;

function isServer(): boolean {
	return typeof process !== "undefined" && !!process.env;
}

function logEnvVarsOnce(): void {
	if (envLogged) return;
	envLogged = true;

	const serverSide = isServer();
	astroLogger.systemLog(
		`Environment variables loaded (${serverSide ? "server" : "client"} side)`,
		{
			GHOST_API_URL: serverSide
				? !!process.env.GHOST_API_URL
				: !!import.meta.env.GHOST_API_URL,
			GHOST_CONTENT_KEY: serverSide
				? !!process.env.GHOST_CONTENT_KEY
				: !!import.meta.env.GHOST_CONTENT_KEY,
			EXTERNAL_BLOGS: serverSide
				? !!process.env.EXTERNAL_BLOGS
				: !!import.meta.env.EXTERNAL_BLOGS,
			FRONTEND_URL: serverSide
				? !!process.env.FRONTEND_URL
				: !!import.meta.env.FRONTEND_URL,
		},
	);
}

export function getGhostApiUrl(): string | undefined {
	logEnvVarsOnce();
	return isServer() ? process.env.GHOST_API_URL : import.meta.env.GHOST_API_URL;
}

export function getGhostContentKey(): string | undefined {
	logEnvVarsOnce();
	return isServer()
		? process.env.GHOST_CONTENT_KEY
		: import.meta.env.GHOST_CONTENT_KEY;
}

export function getExternalBlogs(): string | undefined {
	logEnvVarsOnce();
	return isServer()
		? process.env.EXTERNAL_BLOGS
		: import.meta.env.EXTERNAL_BLOGS;
}

export function getFrontendUrl(): string | undefined {
	logEnvVarsOnce();
	return isServer() ? process.env.FRONTEND_URL : import.meta.env.FRONTEND_URL;
}
