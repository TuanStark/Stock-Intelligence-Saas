// ─── Structured Logger ────────────────────────────────────
// Lightweight structured logger for all services.
// Outputs JSON in production, pretty-prints in development.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    message: string;
    service?: string;
    requestId?: string;
    traceId?: string;
    timestamp: string;
    [key: string]: unknown;
}

interface LoggerOptions {
    service: string;
    level?: LogLevel;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

export class Logger {
    private readonly service: string;
    private readonly minLevel: number;
    private readonly isProd: boolean;

    constructor(options: LoggerOptions) {
        this.service = options.service;
        this.minLevel = LOG_LEVELS[options.level || 'info'];
        this.isProd = process.env.NODE_ENV === 'production';
    }

    debug(message: string, meta?: Record<string, unknown>) {
        this.log('debug', message, meta);
    }

    info(message: string, meta?: Record<string, unknown>) {
        this.log('info', message, meta);
    }

    warn(message: string, meta?: Record<string, unknown>) {
        this.log('warn', message, meta);
    }

    error(message: string, meta?: Record<string, unknown>) {
        this.log('error', message, meta);
    }

    child(meta: Record<string, unknown>): ChildLogger {
        return new ChildLogger(this, meta);
    }

    private log(
        level: LogLevel,
        message: string,
        meta?: Record<string, unknown>,
    ) {
        if (LOG_LEVELS[level] < this.minLevel) return;

        const entry: LogEntry = {
            level,
            message,
            service: this.service,
            timestamp: new Date().toISOString(),
            ...meta,
        };

        const output = JSON.stringify(entry);

        if (level === 'error') {
            console.error(output);
        } else if (level === 'warn') {
            console.warn(output);
        } else {
            console.log(output);
        }
    }
}

class ChildLogger {
    constructor(
        private readonly parent: Logger,
        private readonly meta: Record<string, unknown>,
    ) {}

    debug(message: string, extra?: Record<string, unknown>) {
        this.parent.debug(message, { ...this.meta, ...extra });
    }

    info(message: string, extra?: Record<string, unknown>) {
        this.parent.info(message, { ...this.meta, ...extra });
    }

    warn(message: string, extra?: Record<string, unknown>) {
        this.parent.warn(message, { ...this.meta, ...extra });
    }

    error(message: string, extra?: Record<string, unknown>) {
        this.parent.error(message, { ...this.meta, ...extra });
    }
}

/**
 * Create a logger instance for a service.
 *
 * ```ts
 * const logger = createLogger({ service: 'api' });
 * logger.info('Server started', { port: 3001 });
 *
 * const reqLogger = logger.child({ requestId: 'abc-123' });
 * reqLogger.info('Processing request');
 * ```
 */
export function createLogger(options: LoggerOptions): Logger {
    return new Logger(options);
}
