import loggerService, { type LogContext } from "./logger.js";
import { LOG_TYPES } from "./logTypes.js";

interface AstroLogContext extends LogContext {
	component?: string;
	route?: string;
	method?: string;
	status?: number;
	duration?: number;
	url?: string;
	headers?: Record<string, string>;
	userAgent?: string;
	referer?: string;
}

class AstroLogger {
	private logger = loggerService;

	async info(message: string, context?: AstroLogContext) {
		await this.logger.info(message, {
			source: "astro",
			...context,
		});
	}

	async warn(message: string, context?: AstroLogContext) {
		await this.logger.warn(message, {
			source: "astro",
			...context,
		});
	}

	async error(message: string, error?: Error, context?: AstroLogContext) {
		await this.logger.error(message, error, {
			source: "astro",
			...context,
		});
	}

	async requestError(
		message: string,
		request: Request,
		error?: Error,
		context?: AstroLogContext,
	) {
		const url = new URL(request.url);
		const headers: Record<string, string> = {};
		request.headers.forEach((value, key) => {
			headers[key] = value;
		});

		await this.error(message, error, {
			method: request.method,
			url: request.url,
			path: url.pathname,
			headers,
			userAgent: request.headers.get("user-agent") ?? undefined,
			referer: request.headers.get("referer") ?? undefined,
			...context,
		});
	}

	async debug(message: string, context?: AstroLogContext) {
		await this.logger.debug(message, {
			source: "astro",
			...context,
		});
	}

	async requestLog(
		request: Request,
		response: { status?: number } = {},
		duration?: number,
	) {
		const url = new URL(request.url);
		await this.info("Request processed", {
			logType: LOG_TYPES.ACCESS,
			method: request.method,
			path: url.pathname,
			status: response.status || 200,
			duration,
			userAgent: request.headers.get("user-agent") ?? undefined,
			referer: request.headers.get("referer") ?? undefined,
		});
	}

	async componentError(
		componentName: string,
		error: Error,
		context?: AstroLogContext,
	) {
		await this.error(`Component error: ${componentName}`, error, {
			logType: LOG_TYPES.COMPONENT,
			component: componentName,
			...context,
		});
	}

	async apiError(endpoint: string, error: Error, context?: AstroLogContext) {
		await this.error(`API error: ${endpoint}`, error, {
			logType: LOG_TYPES.API,
			route: endpoint,
			...context,
		});
	}

	async apiRequestError(
		endpoint: string,
		request: Request,
		error: Error,
		context?: AstroLogContext,
	) {
		const url = new URL(request.url);
		const headers: Record<string, string> = {};
		request.headers.forEach((value, key) => {
			headers[key] = value;
		});

		await this.error(`API error: ${endpoint}`, error, {
			logType: LOG_TYPES.API,
			route: endpoint,
			method: request.method,
			url: request.url,
			path: url.pathname,
			headers,
			userAgent: request.headers.get("user-agent") ?? undefined,
			referer: request.headers.get("referer") ?? undefined,
			...context,
		});
	}

	async cacheLog(
		action: string,
		key: string,
		hit: boolean,
		context?: AstroLogContext,
	) {
		await this.info(`Cache ${action}: ${key}`, {
			logType: LOG_TYPES.CACHE,
			cacheAction: action,
			cacheKey: key,
			cacheHit: hit,
			...context,
		});
	}

	async systemLog(message: string, context?: AstroLogContext) {
		await this.info(message, {
			logType: LOG_TYPES.SYSTEM,
			...context,
		});
	}
}

const astroLogger = new AstroLogger();

export default astroLogger;
export type { AstroLogContext };
