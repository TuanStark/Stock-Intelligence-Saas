import { NormalizedQuote, NormalizedCandle, NormalizedCompany } from './index';

export interface IMarketDataProvider {
  /**
   * Unique name of the provider (e.g. 'VNSTOCK', 'FIREANT')
   */
  readonly name: string;

  /**
   * Fetch latest quote for a symbol
   */
  getQuote(symbol: string): Promise<NormalizedQuote>;

  /**
   * Fetch historical candles
   */
  getHistorical(symbol: string, period1: Date, period2: Date, resolution: '1D' | '1W' | '1M' | '15m' | '1h'): Promise<NormalizedCandle[]>;

  /**
   * Fetch basic company profile and fundamental indicators
   */
  getCompanyProfile(symbol: string): Promise<NormalizedCompany>;
}

export class ProviderError extends Error {
  constructor(public providerName: string, message: string, public originalError?: any) {
    super(`[Provider:${providerName}] ${message}`);
    this.name = 'ProviderError';
  }
}

export class RateLimitError extends ProviderError {
  constructor(providerName: string, message: string = 'Rate limit exceeded', originalError?: any) {
    super(providerName, message, originalError);
    this.name = 'RateLimitError';
  }
}

export class DataFormatError extends ProviderError {
  constructor(providerName: string, message: string = 'Unexpected data format received', originalError?: any) {
    super(providerName, message, originalError);
    this.name = 'DataFormatError';
  }
}
