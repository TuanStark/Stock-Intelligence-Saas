import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { MarketGateway } from './market.gateway';

@Module({
  imports: [PrismaModule],
  controllers: [MarketController],
  providers: [MarketService, MarketGateway],
  exports: [MarketService, MarketGateway],
})
export class MarketModule { }
