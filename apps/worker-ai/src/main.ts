import './env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    console.log('🚀 Worker AI is running');

    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
        process.on(signal, async () => {
            console.log(`Received ${signal}, shutting down...`);
            await app.close();
            process.exit(0);
        });
    }
}

bootstrap();
