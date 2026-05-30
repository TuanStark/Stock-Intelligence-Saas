import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { MarketGateway } from './market.gateway';
import { BullModule } from '@nestjs/bullmq';
import { RedisModule } from '../redis/redis.module';
import { FinancialDirectIngestor } from './financial-direct.ingestor';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    BullModule.registerQueue({
      name: 'ai-summary',
    }),
    BullModule.registerQueue({
      name: 'financial-ingestion',
    }),
  ],
  controllers: [MarketController],
  providers: [MarketService, MarketGateway, FinancialDirectIngestor],
  exports: [MarketService, MarketGateway, FinancialDirectIngestor],
})
export class MarketModule { }
