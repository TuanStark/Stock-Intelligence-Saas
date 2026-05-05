import { Logger } from '@nestjs/common';
import yahooFinanceRaw from 'yahoo-finance2';
import {
  IMarketDataProvider,
  NormalizedQuote,
  NormalizedCandle,
  NormalizedCompany,
  ProviderError,
} from '@stock-intel/contracts';

// Instantiate yahooFinance since v3 requires it
const YF = (yahooFinanceRaw as any).default || yahooFinanceRaw;
const yahooFinance = new YF({ suppressNotices: ['yahooSurvey'] });

/**
 * MVP Adapter: Due to IP blocking on VN broker APIs (TCBS/VNDirect) from cloud instances,
 * we temporarily wrap Yahoo Finance (which supports VN stocks via .VN suffix) inside the VnStockAdapter.
 * This proves the Adapter Pattern architecture. Later we can swap the internal implementation to
 * a Python microservice without affecting any product logic.
 */
export class VnStockAdapter implements IMarketDataProvider {
  readonly name = 'VNSTOCK_MVP';
  private readonly logger = new Logger(VnStockAdapter.name);

  // Helper to append .VN for Yahoo Finance
  private getProviderSymbol(symbol: string): string {
    return symbol.includes('.') ? symbol : `${symbol}.VN`;
  }

  async getQuote(symbol: string): Promise<NormalizedQuote> {
    try {
      const providerSymbol = this.getProviderSymbol(symbol);
      const data: any = await yahooFinance.quote(providerSymbol);
      
      if (!data || !data.regularMarketPrice) {
        throw new Error('Invalid quote data');
      }

      return {
        symbol: symbol,
        price: data.regularMarketPrice,
        change: data.regularMarketChange || 0,
        changePercent: data.regularMarketChangePercent || 0,
        open: data.regularMarketOpen || data.regularMarketPrice,
        high: data.regularMarketDayHigh || data.regularMarketPrice,
        low: data.regularMarketDayLow || data.regularMarketPrice,
        previousClose: data.regularMarketPreviousClose || data.regularMarketPrice,
        volume: data.regularMarketVolume || 0,
        value: (data.regularMarketVolume || 0) * data.regularMarketPrice,
        timestamp: data.regularMarketTime || new Date(),
        asOf: new Date(),
        source: this.name,
      };
    } catch (error) {
      const e = error as Error;
      this.logger.error(`Failed to get quote for ${symbol}: ${e.message}`);
      throw new ProviderError(this.name, `Failed to get quote for ${symbol}`, error);
    }
  }

  async getHistorical(
    symbol: string,
    period1: Date,
    period2: Date,
    resolution: '1D' | '1W' | '1M' | '15m' | '1h'
  ): Promise<NormalizedCandle[]> {
    try {
      const providerSymbol = this.getProviderSymbol(symbol);
      const data: any[] = await yahooFinance.historical(providerSymbol, {
        period1: period1.toISOString().split('T')[0],
        period2: period2.toISOString().split('T')[0],
        interval: '1d', // simplified for MVP
      });
      
      return data.map((d: any) => ({
        symbol,
        timestamp: new Date(d.date),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
        resolution: '1D',
      }));
    } catch (error) {
      throw new ProviderError(this.name, `Failed to get historical for ${symbol}`, error);
    }
  }

  async getCompanyProfile(symbol: string): Promise<NormalizedCompany> {
    try {
      const providerSymbol = this.getProviderSymbol(symbol);
      const quote: any = await yahooFinance.quote(providerSymbol);

      return {
        symbol,
        name: quote.longName || quote.shortName || symbol,
        exchange: quote.exchange || 'HOSE',
        industry: quote.industry || 'Unknown',
        marketCap: quote.marketCap,
        pe: quote.forwardPE || quote.trailingPE,
        pb: quote.priceToBook,
        outstandingShares: quote.sharesOutstanding,
      };
    } catch (error) {
      throw new ProviderError(this.name, `Failed to get profile for ${symbol}`, error);
    }
  }
}
