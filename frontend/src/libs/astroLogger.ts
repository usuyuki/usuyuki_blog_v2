import loggerService, { type LogContext } from './logger.js';
import { LOG_TYPES, type LogType } from './logTypes.js';

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
      logType: LOG_TYPES.ACCESS,
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
      logType: LOG_TYPES.COMPONENT,
      component: componentName,
      ...context
    });
  }

  apiError(endpoint: string, error: Error, context?: AstroLogContext) {
    this.error(`API error: ${endpoint}`, error, {
      logType: LOG_TYPES.API,
      route: endpoint,
      ...context
    });
  }

  cacheLog(action: string, key: string, hit: boolean, context?: AstroLogContext) {
    this.info(`Cache ${action}: ${key}`, {
      logType: LOG_TYPES.CACHE,
      cacheAction: action,
      cacheKey: key,
      cacheHit: hit,
      ...context
    });
  }

  systemLog(message: string, context?: AstroLogContext) {
    this.info(message, {
      logType: LOG_TYPES.SYSTEM,
      ...context
    });
  }
}

const astroLogger = new AstroLogger();

export default astroLogger;
export type { AstroLogContext };