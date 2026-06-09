import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  NotFoundException,
  Req,
  UseGuards,
  Res,
} from '@nestjs/common';
import { MarketService } from './market.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RateLimiterGuard } from '../common/guards/rate-limiter.guard';
import { SignatureGuard } from '../common/guards/signature.guard';
import { encryptPayload } from '../common/helpers/crypto.helper';

@Controller('market')
@UseGuards(RateLimiterGuard)
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('overview')
  async getMarketOverview() {
    return this.marketService.getOverview();
  }

  @Get('signals')
  @UseGuards(SignatureGuard)
  async getSignals(
    @Query('type') type?: string,
    @Query('strength') strength?: string,
    @Res({ passthrough: true }) res?: any,
  ) {
    const rawData = await this.marketService.getSignals(type, strength);
    const encrypted = encryptPayload(rawData);
    res?.header('x-encrypted', 'true');
    return encrypted;
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
  @UseGuards(OptionalJwtAuthGuard, SignatureGuard)
  async triggerAiSummary(
    @Param('symbol') symbol: string,
    @Req() req: any,
    @Res({ passthrough: true }) res?: any,
  ) {
    const user = req.user || null;
    const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const rawData = await this.marketService.triggerAiSummary(symbol, user, ip);
    if (!rawData) {
      throw new NotFoundException(`Instrument ${symbol} not found`);
    }
    const encrypted = encryptPayload(rawData);
    res?.header('x-encrypted', 'true');
    return encrypted;
  }
}
