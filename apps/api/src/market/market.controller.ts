import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { MarketService } from './market.service';

@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) { }

  @Get('overview')
  async getMarketOverview() {
    return this.marketService.getOverview();
  }

  @Get('instruments/search')
  async searchInstruments(@Query('q') query: string) {
    if (!query) return { success: true, data: [] };
    return this.marketService.searchInstruments(query);
  }

  @Get('instruments/:symbol')
  async getInstrumentDetail(@Param('symbol') symbol: string) {
    const detail = await this.marketService.getInstrumentDetail(symbol);
    if (!detail) {
      throw new NotFoundException(`Instrument ${symbol} not found`);
    }
    return detail;
  }
}
