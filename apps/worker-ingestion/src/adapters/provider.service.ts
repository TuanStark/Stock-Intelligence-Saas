import { Injectable, Logger } from '@nestjs/common';
import { IMarketDataProvider, NormalizedQuote, NormalizedCandle, NormalizedCompany } from '@stock-intel/contracts';
import { VnStockAdapter } from './vnstock.adapter';
import { FireAntAdapter } from './fireant.adapter';

@Injectable()
export class ProviderFallbackService {
  private readonly logger = new Logger(ProviderFallbackService.name);
  
  // The chain of responsibility
  private readonly quoteProviders: IMarketDataProvider[];
  private readonly historicalProviders: IMarketDataProvider[];

  constructor() {
    const vnstock = new VnStockAdapter();
    const fireant = new FireAntAdapter();
    
    // Ordered by priority
    this.quoteProviders = [vnstock, fireant];
    this.historicalProviders = [vnstock]; // FireAnt not implemented yet
  }

  async getQuote(symbol: string): Promise<NormalizedQuote> {
    for (let i = 0; i < this.quoteProviders.length; i++) {
      const provider = this.quoteProviders[i];
      try {
        const quote = await provider.getQuote(symbol);
        return quote;
      } catch (error) {
        this.logger.warn(`Provider ${provider.name} failed to get quote for ${symbol}. ${i < this.quoteProviders.length - 1 ? 'Falling back to next provider...' : 'No more providers available.'}`);
        if (i === this.quoteProviders.length - 1) {
          throw new Error(`All providers failed to get quote for ${symbol}`);
        }
      }
    }
    throw new Error('No providers configured for getQuote');
  }

  async getHistorical(symbol: string, period1: Date, period2: Date, resolution: '1D' | '1W' | '1M' | '15m' | '1h'): Promise<NormalizedCandle[]> {
    for (let i = 0; i < this.historicalProviders.length; i++) {
      const provider = this.historicalProviders[i];
      try {
        const candles = await provider.getHistorical(symbol, period1, period2, resolution);
        return candles;
      } catch (error) {
        this.logger.warn(`Provider ${provider.name} failed to get historical data for ${symbol}. ${i < this.historicalProviders.length - 1 ? 'Falling back...' : 'No more providers.'}`);
        if (i === this.historicalProviders.length - 1) {
          throw new Error(`All providers failed to get historical for ${symbol}`);
        }
      }
    }
    throw new Error('No providers configured for getHistorical');
  }

  async getCompanyProfile(symbol: string): Promise<NormalizedCompany> {
    const provider = this.historicalProviders[0]; // Currently only vnstock
    return provider.getCompanyProfile(symbol);
  }
}
