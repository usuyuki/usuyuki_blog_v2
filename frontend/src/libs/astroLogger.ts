import loggerService, { type LogContext } from './logger.js';

interface AstroLogContext extends LogContext {
  component?: string;
  route?: string;
  method?: string;
  status?: number;
  duration?: number;
}

class AstroLogger {
  private logger = loggerService;

  info(message: string, context?: AstroLogContext) {
    this.logger.info(message, {
      source: 'astro',
      ...context
    });
  }

  warn(message: string, context?: AstroLogContext) {
    this.logger.warn(message, {
      source: 'astro',
      ...context
    });
  }

  error(message: string, error?: Error | any, context?: AstroLogContext) {
    this.logger.error(message, error, {
      source: 'astro',
      ...context
    });
  }

  debug(message: string, context?: AstroLogContext) {
    this.logger.debug(message, {
      source: 'astro',
      ...context
    });
  }

  requestLog(request: Request, response: { status?: number } = {}, duration?: number) {
    const url = new URL(request.url);
    this.info('Request processed', {
      method: request.method,
      path: url.pathname,
      status: response.status || 200,
      duration,
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
    });
  }

  componentError(componentName: string, error: Error, context?: AstroLogContext) {
    this.error(`Component error: ${componentName}`, error, {
      component: componentName,
      ...context
    });
  }

  apiError(endpoint: string, error: Error, context?: AstroLogContext) {
    this.error(`API error: ${endpoint}`, error, {
      route: endpoint,
      ...context
    });
  }
}

const astroLogger = new AstroLogger();

export default astroLogger;
export type { AstroLogContext };