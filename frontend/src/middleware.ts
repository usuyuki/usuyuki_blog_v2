import type { MiddlewareHandler } from "astro";
import astroLogger from "./libs/astroLogger.js";

export const onRequest: MiddlewareHandler = async (context, next) => {
	const startTime = Date.now();

	try {
		const response = await next();
		const duration = Date.now() - startTime;

		if (context.url.pathname.startsWith("/_image") && response.status >= 400) {
			await astroLogger.error(
				`Image processing failed: ${context.url.pathname}`,
				undefined,
				{
					url: context.url.toString(),
					status: response.status,
					duration,
					userAgent: context.request.headers.get("user-agent") ?? undefined,
				},
			);
		} else if (response.status >= 400) {
			await astroLogger.warn(`Request failed: ${context.url.pathname}`, {
				url: context.url.toString(),
				status: response.status,
				duration,
				userAgent: context.request.headers.get("user-agent") ?? undefined,
			});
		}

		return response;
	} catch (error) {
		const duration = Date.now() - startTime;

		await astroLogger.requestError(
			"Unhandled request error",
			context.request,
			error instanceof Error ? error : new Error(String(error)),
			{ duration },
		);

		throw error;
	}
};
