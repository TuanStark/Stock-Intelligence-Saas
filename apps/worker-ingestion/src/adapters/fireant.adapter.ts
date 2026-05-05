import { Logger } from '@nestjs/common';
import axios from 'axios';
import {
  IMarketDataProvider,
  NormalizedQuote,
  NormalizedCandle,
  NormalizedCompany,
  ProviderError,
} from '@stock-intel/contracts';

export class FireAntAdapter implements IMarketDataProvider {
  readonly name = 'FIREANT';
  private readonly logger = new Logger(FireAntAdapter.name);
  private readonly baseUrl = 'https://restv2.fireant.vn';

  // FireAnt usually requires Bearer token, but some endpoints might be open or we can mock for fallback
  async getQuote(symbol: string): Promise<NormalizedQuote> {
    try {
      const response = await axios.get(`${this.baseUrl}/symbols/${symbol}/quotes`, { timeout: 5000 });
      const data = response.data;

      if (!data || data.length === 0) {
        throw new Error('No quote data from FireAnt');
      }

      const quote = data[0];

      return {
        symbol: symbol,
        price: quote.price || 0,
        change: quote.change || 0,
        changePercent: quote.changePercent || 0,
        open: quote.open || 0,
        high: quote.high || 0,
        low: quote.low || 0,
        previousClose: quote.previousClose || 0,
        volume: quote.volume || 0,
        value: quote.totalValue || 0,
        timestamp: new Date(quote.time || Date.now()),
        asOf: new Date(),
        source: this.name,
      };
    } catch (error) {
      this.logger.error(`Failed to get quote for ${symbol}: ${error}`);
      throw new ProviderError(this.name, `Failed to get quote for ${symbol}`, error);
    }
  }

  async getHistorical(
    symbol: string,
    period1: Date,
    period2: Date,
    resolution: '1D' | '1W' | '1M' | '15m' | '1h'
  ): Promise<NormalizedCandle[]> {
    throw new ProviderError(this.name, 'Historical data not implemented for FireAnt MVP');
  }

  async getCompanyProfile(symbol: string): Promise<NormalizedCompany> {
    throw new ProviderError(this.name, 'Company profile not implemented for FireAnt MVP');
  }
}
