import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';
import * as fs from 'fs';

// ─── Structured Logger ────────────────────────────────────
// Production-grade logger for all services in Monorepo.
// Outputs JSON in production, pretty-prints in development.
// Automatically rotates and compresses (.gz) log files to prevent disk usage overflow.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
    service: string;
    level?: LogLevel;
    logDir?: string;
}

export class Logger {
    private readonly winstonLogger: winston.Logger;
    private readonly service: string;

    constructor(options: LoggerOptions) {
        this.service = options.service;
        const level = options.level || 'info';
        
        // Đường dẫn thư mục logs: ưu tiên cấu hình, mặc định log ở folder ./logs tại root thư mục chạy
        const logDir = options.logDir || path.join(process.cwd(), 'logs');

        // Lớp bảo vệ: Tự động khởi tạo thư mục log nếu chưa tồn tại
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        const isProd = process.env.NODE_ENV === 'production';

        // 1. Định nghĩa format Log cho Production (dạng JSON có timestamp)
        const prodFormat = winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        );

        // 2. Định nghĩa format Log cho Development (dạng màu sắc trực quan, dễ đọc)
        const devFormat = winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
                const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                return `[${timestamp}] [${service || 'app'}] ${level}: ${message}${metaStr}`;
            })
        );

        const transports: winston.transport[] = [];

        // A. Cấu hình Console Transport (Luôn bật)
        transports.push(
            new winston.transports.Console({
                format: isProd ? prodFormat : devFormat,
            })
        );

        // Helper tạo transport ghi log ra file có xoay vòng (Log Rotation) và nén zip
        const createRotateFileTransport = (filename: string, fileLevel?: string) => {
            return new DailyRotateFile({
                dirname: logDir,
                filename: `${filename}-%DATE%.log`,
                datePattern: 'YYYY-MM-DD',
                zippedArchive: true, // BẬT NÉN: Tự động nén thành file .gz sau khi xoay vòng
                maxSize: '20m',      // GIỚI HẠN DUNG LƯỢNG: Rotate khi log đạt 20MB
                maxFiles: '14d',     // GIỚI HẠN THỜI GIAN: Lưu giữ tối đa trong 14 ngày
                level: fileLevel || level,
                format: prodFormat,  // File logs luôn ghi dạng JSON để phân tích tự động
            });
        };

        // B. Cấu hình File Transports (Ghi log ra file trên cả Dev & Prod để dễ tra cứu local)
        // 1. Ghi toàn bộ logs (application-YYYY-MM-DD.log)
        transports.push(createRotateFileTransport('application'));
        
        // 2. Ghi riêng lỗi nghiêm trọng (error-YYYY-MM-DD.log)
        transports.push(createRotateFileTransport('error', 'error'));

        this.winstonLogger = winston.createLogger({
            level,
            defaultMeta: { service: this.service },
            transports,
        });
    }

    debug(message: string, meta?: Record<string, unknown>) {
        this.winstonLogger.debug(message, meta);
    }

    info(message: string, meta?: Record<string, unknown>) {
        this.winstonLogger.info(message, meta);
    }

    warn(message: string, meta?: Record<string, unknown>) {
        this.winstonLogger.warn(message, meta);
    }

    error(message: string, meta?: Record<string, unknown>) {
        this.winstonLogger.error(message, meta);
    }

    child(meta: Record<string, unknown>): ChildLogger {
        return new ChildLogger(this, meta);
    }
}

export class ChildLogger {
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

export function createLogger(options: LoggerOptions): Logger {
    return new Logger(options);
}
