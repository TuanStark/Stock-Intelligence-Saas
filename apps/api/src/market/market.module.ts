import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { MarketGateway } from './market.gateway';
import { BullModule } from '@nestjs/bullmq';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    BullModule.registerQueue({
      name: 'ai-summary',
    }),
  ],
  controllers: [MarketController],
  providers: [MarketService, MarketGateway],
  exports: [MarketService, MarketGateway],
})
export class MarketModule { }
