import astroLogger from "./astroLogger.js";
import type { AstroLogContext } from "./astroLogger.js";

interface ErrorContext extends AstroLogContext {
	userId?: string;
	sessionId?: string;
	requestId?: string;
	stack?: string;
	request?: Request;
}

class ErrorHandler {
	private logger = astroLogger;

	handleError(error: Error, context?: ErrorContext): void {
		const errorMessage = error.message;
		const errorStack = error.stack;

		if (context?.request) {
			this.logger.requestError(errorMessage, context.request, error, {
				...context,
				stack: errorStack,
				timestamp: new Date().toISOString(),
			});
		} else {
			this.logger.error(errorMessage, error, {
				...context,
				stack: errorStack,
				timestamp: new Date().toISOString(),
			});
		}
	}

	handleApiError(endpoint: string, error: Error, context?: ErrorContext): void {
		if (context?.request) {
			this.logger.apiRequestError(endpoint, context.request, error, {
				...context,
				timestamp: new Date().toISOString(),
			});
		} else {
			this.logger.apiError(endpoint, error, {
				...context,
				timestamp: new Date().toISOString(),
			});
		}
	}

	handleComponentError(
		componentName: string,
		error: Error,
		context?: ErrorContext,
	): void {
		this.logger.componentError(componentName, error, {
			...context,
			timestamp: new Date().toISOString(),
		});
	}

	handleValidationError(
		message: string,
		validationErrors: Record<string, string[]>,
		context?: ErrorContext,
	): void {
		this.logger.warn(`Validation error: ${message}`, {
			...context,
			validationErrors,
			timestamp: new Date().toISOString(),
		});
	}

	handleNetworkError(url: string, error: Error, context?: ErrorContext): void {
		this.handleError(error, {
			...context,
			url,
			type: "network_error",
			timestamp: new Date().toISOString(),
		});
	}

	async wrapAsync<T>(
		fn: () => Promise<T>,
		errorContext?: ErrorContext,
	): Promise<T | null> {
		try {
			return await fn();
		} catch (error) {
			this.handleError(error as Error, errorContext);
			return null;
		}
	}

	wrapSync<T>(fn: () => T, errorContext?: ErrorContext): T | null {
		try {
			return fn();
		} catch (error) {
			this.handleError(error as Error, errorContext);
			return null;
		}
	}
}

const errorHandler = new ErrorHandler();

export default errorHandler;
export type { ErrorContext };
