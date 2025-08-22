import winston from "winston";
import { LOG_TYPES, type LogType } from "./logTypes";

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

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
	[key: string]: string | number | boolean | object | null | undefined;
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

	error(message: string, error?: Error, context?: LogContext) {
		const errorInfo = error
			? { name: error.name, message: error.message, stack: error.stack }
			: undefined;

		this.winston.error(
			message,
			this.enrichContext({
				error: errorInfo,
				logType: LOG_TYPES.ERROR,
				...context,
			}),
		);
	}

	log(message: string, level: LogLevel = "info", context?: LogContext) {
		this.winston.log(level, message, this.enrichContext(context));
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

const loggerService = new LoggerService(logger);

if (typeof window !== "undefined") {
	loggerService.wrapConsole();
}

export default loggerService;
export { originalConsole };
export type { LogLevel, LogContext };
