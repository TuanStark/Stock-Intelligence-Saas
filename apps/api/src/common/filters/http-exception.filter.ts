import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const requestId =
            (request.headers['x-request-id'] as string) || 'unknown';
        const timestamp = new Date().toISOString();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let code = 'INTERNAL_ERROR';
        let message = 'An unexpected error occurred';
        let details: unknown = undefined;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exResponse = exception.getResponse();

            if (typeof exResponse === 'string') {
                message = exResponse;
            } else if (typeof exResponse === 'object' && exResponse !== null) {
                const obj = exResponse as Record<string, unknown>;
                message = (obj['message'] as string) || message;
                code = (obj['error'] as string) || code;
                details = obj['details'];
            }

            // Map status to code
            code = this.statusToCode(status, code);
        } else if (exception instanceof Error) {
            message = exception.message;
            // Log unexpected errors
            console.error(
                JSON.stringify({
                    level: 'error',
                    requestId,
                    error: exception.message,
                    stack: exception.stack,
                    timestamp,
                }),
            );
        }

        response.status(status).json({
            success: false,
            error: {
                code,
                message,
                ...(details !== undefined ? { details } : {}),
            },
            meta: {
                requestId,
                timestamp,
            },
        });
    }

    private statusToCode(status: number, fallback: string): string {
        const map: Record<number, string> = {
            400: 'VALIDATION_ERROR',
            401: 'UNAUTHORIZED',
            403: 'FORBIDDEN',
            404: 'NOT_FOUND',
            409: 'CONFLICT',
            429: 'RATE_LIMITED',
            500: 'INTERNAL_ERROR',
            502: 'BAD_GATEWAY',
            503: 'SERVICE_UNAVAILABLE',
        };
        return map[status] || fallback;
    }
}
