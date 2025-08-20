import astroLogger from './astroLogger.js';
import { type AstroLogContext } from './astroLogger.js';

interface ErrorContext extends AstroLogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  stack?: string;
}

class ErrorHandler {
  private logger = astroLogger;

  handleError(error: Error | any, context?: ErrorContext): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.logger.error(errorMessage, error, {
      ...context,
      stack: errorStack,
      timestamp: new Date().toISOString(),
    });
  }

  handleApiError(endpoint: string, error: Error | any, context?: ErrorContext): void {
    this.logger.apiError(endpoint, error instanceof Error ? error : new Error(String(error)), {
      ...context,
      timestamp: new Date().toISOString(),
    });
  }

  handleComponentError(componentName: string, error: Error | any, context?: ErrorContext): void {
    this.logger.componentError(
      componentName,
      error instanceof Error ? error : new Error(String(error)),
      {
        ...context,
        timestamp: new Date().toISOString(),
      }
    );
  }

  handleValidationError(message: string, validationErrors: any, context?: ErrorContext): void {
    this.logger.warn(`Validation error: ${message}`, {
      ...context,
      validationErrors,
      timestamp: new Date().toISOString(),
    });
  }

  handleNetworkError(url: string, error: Error | any, context?: ErrorContext): void {
    this.handleError(error, {
      ...context,
      url,
      type: 'network_error',
      timestamp: new Date().toISOString(),
    });
  }

  wrapAsync<T>(
    fn: () => Promise<T>,
    errorContext?: ErrorContext
  ): Promise<T | null> {
    return fn().catch((error) => {
      this.handleError(error, errorContext);
      return null;
    });
  }

  wrapSync<T>(
    fn: () => T,
    errorContext?: ErrorContext
  ): T | null {
    try {
      return fn();
    } catch (error) {
      this.handleError(error, errorContext);
      return null;
    }
  }
}

const errorHandler = new ErrorHandler();

export default errorHandler;
export type { ErrorContext };