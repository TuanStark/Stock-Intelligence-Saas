import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // ─── Global Prefix ────────────────────────────────────
    app.setGlobalPrefix('api/v1');

    // ─── Security ─────────────────────────────────────────
    app.use(helmet());
    app.use(cookieParser());

    // ─── CORS ─────────────────────────────────────────────
    app.enableCors({
        origin: process.env.WEB_URL || 'http://localhost:3000',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    });

    // ─── Global Pipes, Filters, Interceptors ──────────────
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new LoggingInterceptor());

    // ─── Start ────────────────────────────────────────────
    const port = process.env.PORT ?? 3001;
    await app.listen(port);

    console.log(`🚀 API server running on http://localhost:${port}/api/v1`);
    console.log(`📋 Health check: http://localhost:${port}/api/v1/health`);
}

bootstrap();
