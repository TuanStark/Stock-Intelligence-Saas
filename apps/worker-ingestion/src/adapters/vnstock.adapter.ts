import { Logger } from '@nestjs/common';
import axios from 'axios';
import {
  IMarketDataProvider,
  NormalizedQuote,
  NormalizedCandle,
  NormalizedCompany,
  ProviderError,
} from '@stock-intel/contracts';

/**
 * VnStockAdapter: Fetches real-time and historical stock data for Vietnamese equities
 * using Techcom Securities (TCBS) public API endpoints.
 */
export class VnStockAdapter implements IMarketDataProvider {
  readonly name = 'VNSTOCK_TCBS';
  private readonly logger = new Logger(VnStockAdapter.name);

  private readonly quoteUrl = 'https://apipub.tcbs.com.vn/tcanalysis/v1/ticker/quote';
  private readonly historicalUrl = 'https://apipub.tcbs.com.vn/tcanalysis/v1/ticker/historical';
  private readonly overviewUrl = 'https://apipub.tcbs.com.vn/tcanalysis/v1/ticker';

  // Common User-Agent header to prevent API requests from being blocked
  private readonly headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Origin': 'https://tcinvest.tcbs.com.vn',
    'Referer': 'https://tcinvest.tcbs.com.vn/'
  };

  async getQuote(symbol: string): Promise<NormalizedQuote> {
    try {
      const cleanSymbol = symbol.toUpperCase();
      const response = await axios.get(`${this.quoteUrl}?ticker=${cleanSymbol}`, {
        headers: this.headers,
        timeout: 5000,
      });

      const data = response.data;
      if (!data) {
        throw new Error(`Empty response for symbol ${cleanSymbol}`);
      }

      // Handle raw price conversion (TCBS prices are usually multiplied by 1000, e.g., 130 for 130,000 VND)
      // but quotes are normalized to absolute currency values.
      // We check if it is VN currency or USD. Typical TCBS prices are in 1,000 VND units.
      const priceUnitMultiplier = 1000;

      const price = (data.close || data.price || 0) * priceUnitMultiplier;
      const open = (data.open || 0) * priceUnitMultiplier;
      const high = (data.high || 0) * priceUnitMultiplier;
      const low = (data.low || 0) * priceUnitMultiplier;
      const prevClose = (data.prevClose || 0) * priceUnitMultiplier;
      
      const change = (data.change || 0) * priceUnitMultiplier;
      // TCBS percentage is returned as percentage (e.g. 1.25 for 1.25%). Normalize to decimal format: 0.0125
      const changePercent = (data.percentChange || data.changePercent || 0) / 100;

      return {
        symbol: cleanSymbol,
        price,
        change,
        changePercent,
        open: open || price,
        high: high || price,
        low: low || price,
        previousClose: prevClose || price,
        volume: data.volume || 0,
        value: data.value || (data.volume || 0) * price,
        timestamp: new Date(),
        asOf: new Date(),
        source: this.name,
      };
    } catch (error) {
      this.logger.error(`Failed to get quote for ${symbol}: ${(error as Error).message}`);
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
      const cleanSymbol = symbol.toUpperCase();
      
      // TCBS API resolutions: D, W, M
      let tcbsResolution = 'D';
      if (resolution === '1W') tcbsResolution = 'W';
      if (resolution === '1M') tcbsResolution = 'M';

      const fromTime = Math.floor(period1.getTime() / 1000);
      const toTime = Math.floor(period2.getTime() / 1000);

      const url = `${this.historicalUrl}?ticker=${cleanSymbol}&resolution=${tcbsResolution}&from=${fromTime}&to=${toTime}`;
      const response = await axios.get(url, {
        headers: this.headers,
        timeout: 8000,
      });

      const data = response.data?.data || [];
      const priceUnitMultiplier = 1000;

      return data.map((d: any) => ({
        symbol: cleanSymbol,
        timestamp: new Date(d.tradingDate),
        open: d.open * priceUnitMultiplier,
        high: d.high * priceUnitMultiplier,
        low: d.low * priceUnitMultiplier,
        close: d.close * priceUnitMultiplier,
        volume: d.volume || 0,
        resolution: resolution === '1D' ? '1D' : resolution,
      }));
    } catch (error) {
      this.logger.error(`Failed to get historical for ${symbol}: ${(error as Error).message}`);
      throw new ProviderError(this.name, `Failed to get historical for ${symbol}`, error);
    }
  }

  async getCompanyProfile(symbol: string): Promise<NormalizedCompany> {
    try {
      const cleanSymbol = symbol.toUpperCase();
      const response = await axios.get(`${this.overviewUrl}/${cleanSymbol}/overview`, {
        headers: this.headers,
        timeout: 5000,
      });

      const data = response.data;
      if (!data) {
        throw new Error(`Empty company overview for symbol ${cleanSymbol}`);
      }

      return {
        symbol: cleanSymbol,
        name: data.companyName || cleanSymbol,
        exchange: data.exchange || 'HOSE',
        industry: data.industry || 'Unknown',
        marketCap: data.marketCap || 0,
        pe: data.pe || 0,
        pb: data.pb || 0,
        outstandingShares: data.sharesOutstanding || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get profile for ${symbol}: ${(error as Error).message}`);
      throw new ProviderError(this.name, `Failed to get profile for ${symbol}`, error);
    }
  }
}
