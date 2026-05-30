import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { env } from './env';

// Features
import { IndicatorCalculatorService } from './features/indicator-calculator.service';
import { SignalDetectorService } from './features/signal-detector.service';
import { StockProcessingProcessor } from './features/stock-processing.processor';

@Module({
    imports: [
        PrismaModule,
        RedisModule,
        BullModule.forRoot({
            connection: {
                host: env.REDIS_HOST,
                port: env.REDIS_PORT,
                password: env.REDIS_PASSWORD || undefined,
            },
        }),
        BullModule.registerQueue({
            name: 'stock-processing',
        }),
    ],
    providers: [
        IndicatorCalculatorService,
        SignalDetectorService,
        StockProcessingProcessor,
    ],
})
export class AppModule {}
