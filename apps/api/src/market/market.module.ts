import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';

@Module({
  imports: [PrismaModule],
  controllers: [MarketController],
  providers: [MarketService],
})
export class MarketModule { }
