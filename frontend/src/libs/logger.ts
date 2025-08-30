import { LOG_TYPES, type LogType } from "./logTypes";

const originalConsole = {
	log: console.log,
	info: console.info,
	warn: console.warn,
	error: console.error,
	debug: console.debug,
};

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
	[key: string]: string | number | boolean | object | null | undefined;
	logType?: LogType;
}

class LoggerService {
	private isClient = typeof window !== "undefined";

	async debug(message: string, context?: LogContext) {
		if (this.isClient) {
			return;
		}

		try {
			const winston = await import("winston");
			const logger = this.createWinstonLogger(winston);
			logger.debug(message, this.enrichContext(context));
		} catch (_error) {
			// Server-only logging, no fallback needed
		}
	}

	async info(message: string, context?: LogContext) {
		if (this.isClient) {
			return;
		}

		try {
			const winston = await import("winston");
			const logger = this.createWinstonLogger(winston);
			logger.info(message, this.enrichContext(context));
		} catch (_error) {
			// Server-only logging, no fallback needed
		}
	}

	async warn(message: string, context?: LogContext) {
		if (this.isClient) {
			return;
		}

		try {
			const winston = await import("winston");
			const logger = this.createWinstonLogger(winston);
			logger.warn(message, this.enrichContext(context));
		} catch (_error) {
			// Server-only logging, no fallback needed
		}
	}

	async error(message: string, error?: Error, context?: LogContext) {
		const errorInfo = error
			? { name: error.name, message: error.message, stack: error.stack }
			: undefined;

		if (this.isClient) {
			return;
		}

		try {
			const winston = await import("winston");
			const logger = this.createWinstonLogger(winston);
			logger.error(
				message,
				this.enrichContext({
					error: errorInfo,
					logType: LOG_TYPES.ERROR,
					...context,
				}),
			);
		} catch (_err) {
			// Server-only logging, no fallback needed
		}
	}

	async log(message: string, level: LogLevel = "info", context?: LogContext) {
		if (this.isClient) {
			return;
		}

		try {
			const winston = await import("winston");
			const logger = this.createWinstonLogger(winston);
			logger.log(level, message, this.enrichContext(context));
		} catch (_error) {
			// Server-only logging, no fallback needed
		}
	}

	private createWinstonLogger(winston: typeof import("winston")) {
		return winston.createLogger({
			level: "info",
			format: winston.format.combine(
				winston.format.timestamp(),
				winston.format.json(),
			),
			transports: [
				new winston.transports.Console({
					format: winston.format.combine(
						winston.format.colorize(),
						winston.format.simple(),
					),
				}),
			],
		});
	}

	private enrichContext(context?: LogContext): LogContext {
		return {
			logType: LOG_TYPES.GENERAL,
			timestamp: new Date().toISOString(),
			...context,
		};
	}

	wrapConsole() {
		console.log = (message: string, ...args: string[]) => {
			const formattedMessage = this.formatConsoleMessage(message, args);
			this.info(formattedMessage.message, formattedMessage.context);
			originalConsole.log(message, ...args);
		};

		console.info = (message: string, ...args: string[]) => {
			const formattedMessage = this.formatConsoleMessage(message, args);
			this.info(formattedMessage.message, formattedMessage.context);
			originalConsole.info(message, ...args);
		};

		console.warn = (message: string, ...args: string[]) => {
			const formattedMessage = this.formatConsoleMessage(message, args);
			this.warn(formattedMessage.message, formattedMessage.context);
			originalConsole.warn(message, ...args);
		};

		console.error = (message: string, ...args: (string | Error)[]) => {
			const formattedMessage = this.formatConsoleMessage(message, args);
			if (args.length > 0 && args[0] instanceof Error) {
				this.error(formattedMessage.message, args[0], formattedMessage.context);
			} else {
				this.error(
					formattedMessage.message,
					undefined,
					formattedMessage.context,
				);
			}
			originalConsole.error(message, ...args);
		};

		console.debug = (message: string, ...args: string[]) => {
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

	private formatConsoleMessage(message: string, args: (string | Error)[]) {
		const messageStr = message;
		const context: LogContext = {};

		if (args.length > 0) {
			context.additionalArgs = args.map((arg) =>
				arg instanceof Error ? arg.message : arg,
			);
		}

		return { message: messageStr, context };
	}
}

const loggerService = new LoggerService();

export default loggerService;
export { originalConsole };
export type { LogLevel, LogContext };
