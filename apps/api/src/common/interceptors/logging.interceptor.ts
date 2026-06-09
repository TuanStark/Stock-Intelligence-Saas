import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const requestId = (request.headers['x-request-id'] as string) || 'unknown';
    const method = request.method;
    const url = request.url;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const status = response.statusCode;

          console.log(
            JSON.stringify({
              level: 'info',
              type: 'http',
              requestId,
              method,
              url,
              status,
              durationMs: duration,
              timestamp: new Date().toISOString(),
            }),
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;

          console.error(
            JSON.stringify({
              level: 'error',
              type: 'http',
              requestId,
              method,
              url,
              error: error.message,
              durationMs: duration,
              timestamp: new Date().toISOString(),
            }),
          );
        },
      }),
    );
  }
}
