import { Controller, Get, Post, Param, Query, NotFoundException } from '@nestjs/common';
import { MarketService } from './market.service';

@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) { }

  @Get('overview')
  async getMarketOverview() {
    return this.marketService.getOverview();
  }

  @Get('signals')
  async getSignals(@Query('type') type?: string, @Query('strength') strength?: string) {
    return this.marketService.getSignals(type, strength);
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

  @Get('instruments/:symbol/candles')
  async getInstrumentCandles(@Param('symbol') symbol: string) {
    const candles = await this.marketService.getCandles(symbol);
    if (!candles) {
      throw new NotFoundException(`Instrument ${symbol} candles not found`);
    }
    return candles;
  }

  @Get('instruments/:symbol/financials')
  async getInstrumentFinancials(@Param('symbol') symbol: string) {
    const financials = await this.marketService.getOrFetchFinancials(symbol);
    if (!financials) {
      throw new NotFoundException(`Instrument ${symbol} financials not found`);
    }
    return financials;
  }

  @Post('instruments/:symbol/ai-summary')
  async triggerAiSummary(@Param('symbol') symbol: string) {
    const result = await this.marketService.triggerAiSummary(symbol);
    if (!result) {
      throw new NotFoundException(`Instrument ${symbol} not found`);
    }
    return result;
  }
}
