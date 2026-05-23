import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { IngestionService } from './ingestion.service';
import { PrismaModule } from './prisma/prisma.module';
import { ProviderFallbackService } from './adapters/provider.service';
import { RedisModule } from './redis/redis.module';
import { MarketDataBatchIngestor } from './ingestor/market-data-batch.ingestor';
import { CandleAggregatorService } from './aggregator/candle-aggregator.service';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        PrismaModule,
        RedisModule,
        BullModule.forRoot({
            connection: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379', 10),
                password: process.env.REDIS_PASSWORD || undefined,
            },
        }),
        BullModule.registerQueue({
            name: 'stock-processing',
        }),
    ],
    providers: [
        IngestionService,
        ProviderFallbackService,
        MarketDataBatchIngestor,
        CandleAggregatorService,
    ],
})
export class AppModule { }
