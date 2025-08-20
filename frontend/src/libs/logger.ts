import winston from "winston";
import LokiTransport from "winston-loki";

const lokiUrl = import.meta.env.LOKI_URL || process.env.LOKI_URL || "http://localhost:3100";

const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new LokiTransport({
      host: lokiUrl,
      labels: { service: "frontend" },
      json: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf((info) => {
          return JSON.stringify({
            ...info,
            labels: {
              service: "frontend",
              log_type: info.logType || "general",
              level: info.level
            }
          });
        })
      ),
      replaceTimestamp: true,
      onConnectionError: (err: any) => {
        originalConsole.warn("Loki connection error:", err?.message || err);
      }
    })
  ]
});

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogType = 'access' | 'error' | 'cache' | 'api' | 'component' | 'system' | 'general';

interface LogContext {
  [key: string]: any;
  logType?: LogType;
}

class LoggerService {
  private winston: winston.Logger;
  
  constructor(winstonLogger: winston.Logger) {
    this.winston = winstonLogger;
  }

  debug(message: string, context?: LogContext) {
    this.winston.debug(message, this.enrichContext(context));
  }

  info(message: string, context?: LogContext) {
    this.winston.info(message, this.enrichContext(context));
  }

  warn(message: string, context?: LogContext) {
    this.winston.warn(message, this.enrichContext(context));
  }

  error(message: string, error?: Error | any, context?: LogContext) {
    const errorInfo = error instanceof Error 
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;
    
    this.winston.error(message, this.enrichContext({ 
      error: errorInfo,
      logType: 'error',
      ...context 
    }));
  }

  log(message: string, level: LogLevel = 'info', context?: LogContext) {
    this.winston.log(level, message, this.enrichContext(context));
  }

  private enrichContext(context?: LogContext): LogContext {
    return {
      logType: 'general',
      timestamp: new Date().toISOString(),
      ...context
    };
  }

  wrapConsole() {
    console.log = (message: any, ...args: any[]) => {
      const formattedMessage = this.formatConsoleMessage(message, args);
      this.info(formattedMessage.message, formattedMessage.context);
      originalConsole.log(message, ...args);
    };

    console.info = (message: any, ...args: any[]) => {
      const formattedMessage = this.formatConsoleMessage(message, args);
      this.info(formattedMessage.message, formattedMessage.context);
      originalConsole.info(message, ...args);
    };

    console.warn = (message: any, ...args: any[]) => {
      const formattedMessage = this.formatConsoleMessage(message, args);
      this.warn(formattedMessage.message, formattedMessage.context);
      originalConsole.warn(message, ...args);
    };

    console.error = (message: any, ...args: any[]) => {
      const formattedMessage = this.formatConsoleMessage(message, args);
      if (args.length > 0 && args[0] instanceof Error) {
        this.error(formattedMessage.message, args[0], formattedMessage.context);
      } else {
        this.error(formattedMessage.message, undefined, formattedMessage.context);
      }
      originalConsole.error(message, ...args);
    };

    console.debug = (message: any, ...args: any[]) => {
      const formattedMessage = this.formatConsoleMessage(message, args);
      this.debug(formattedMessage.message, formattedMessage.context);
      originalConsole.debug(message, ...args);
    };
  }

  restoreConsole() {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
  }

  private formatConsoleMessage(message: any, args: any[]) {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    const context: LogContext = {};
    
    if (args.length > 0) {
      context.additionalArgs = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      );
    }

    return { message: messageStr, context };
  }
}

const loggerService = new LoggerService(logger);

if (typeof window !== 'undefined') {
  loggerService.wrapConsole();
}

export default loggerService;
export { originalConsole };
export type { LogLevel, LogContext, LogType };