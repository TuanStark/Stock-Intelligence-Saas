import { Logger } from "@nestjs/common";
import axios from "axios";
import YahooFinance from "yahoo-finance2";
import {
  IMarketDataProvider,
  NormalizedQuote,
  NormalizedCandle,
  NormalizedCompany,
  ProviderError,
} from "@stock-intel/contracts";

/**
 * VnStockAdapter: Fetches real-time and historical stock data for Vietnamese equities.
 * Primary: VNDIRECT DChart public TradingView API.
 * Secondary/Fallback/Profile: Yahoo Finance (using .VN ticker suffix).
 */
export class VnStockAdapter implements IMarketDataProvider {
  readonly name = "VNSTOCK_VNDIRECT";
  private readonly logger = new Logger(VnStockAdapter.name);
  private readonly yf = new YahooFinance();

  private readonly dchartUrl =
    "https://dchart-api.vndirect.com.vn/dchart/history";

  // Common User-Agent header to prevent requests from being blocked
  private readonly headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };

  async getQuote(symbol: string): Promise<NormalizedQuote> {
    const cleanSymbol = symbol.toUpperCase();

    // --- 1. PRIMARY: VNDIRECT DChart API ---
    try {
      const to = Math.floor(Date.now() / 1000);
      // Fetch last 5 days to ensure we cover weekends/holidays and always get active trading days
      const from = to - 5 * 24 * 60 * 60;
      const url = `${this.dchartUrl}?symbol=${cleanSymbol}&resolution=D&from=${from}&to=${to}`;

      const response = await axios.get(url, {
        headers: this.headers,
        timeout: 8000,
      });

      const data = response.data;
      if (data && data.s === "ok" && data.c && data.c.length > 0) {
        const len = data.c.length;
        const price = data.c[len - 1] * 1000;
        const open = data.o[len - 1] * 1000;
        const high = data.h[len - 1] * 1000;
        const low = data.l[len - 1] * 1000;

        let previousClose = price;
        let change = 0;
        let changePercent = 0;

        if (len > 1) {
          previousClose = data.c[len - 2] * 1000;
          change = price - previousClose;
          changePercent = change / previousClose;
        }

        const volume = data.v[len - 1] || 0;

        return {
          symbol: cleanSymbol,
          price,
          change,
          changePercent,
          open,
          high,
          low,
          previousClose,
          volume,
          value: volume * price,
          timestamp: new Date(data.t[len - 1] * 1000),
          asOf: new Date(),
          source: "VNDIRECT_DCHART",
        };
      }
    } catch (error: any) {
      this.logger.warn(
        `VNDIRECT DChart failed to get quote for ${symbol}: ${error.message}. Falling back to Yahoo Finance...`,
      );
    }

    // --- 2. FALLBACK: Yahoo Finance ---
    try {
      const yahooSymbol = `${cleanSymbol}.VN`;
      const quote = await this.yf.quote(yahooSymbol);

      if (!quote) {
        throw new Error(`Empty Yahoo Finance quote for ${yahooSymbol}`);
      }

      const price = quote.regularMarketPrice || 0;
      const open = quote.regularMarketOpen || price;
      const high = quote.regularMarketDayHigh || price;
      const low = quote.regularMarketDayLow || price;
      const previousClose = quote.regularMarketPreviousClose || price;
      const change = quote.regularMarketChange || 0;
      const changePercent = (quote.regularMarketChangePercent || 0) / 100;
      const volume = quote.regularMarketVolume || 0;

      return {
        symbol: cleanSymbol,
        price,
        change,
        changePercent,
        open,
        high,
        low,
        previousClose,
        volume,
        value: quote.marketCap || volume * price,
        timestamp: quote.regularMarketTime
          ? new Date(quote.regularMarketTime)
          : new Date(),
        asOf: new Date(),
        source: "YAHOO_FINANCE",
      };
    } catch (error: any) {
      this.logger.error(
        `Yahoo Finance fallback also failed for ${symbol}: ${error.message}`,
      );
      throw new ProviderError(
        this.name,
        `Failed to get quote for ${symbol}`,
        error,
      );
    }
  }

  async getHistorical(
    symbol: string,
    period1: Date,
    period2: Date,
    resolution: "1D" | "1W" | "1M" | "15m" | "1h",
  ): Promise<NormalizedCandle[]> {
    const cleanSymbol = symbol.toUpperCase();

    // Resolution mapping for TradingView UDF (VNDIRECT)
    let vndResolution = "D";
    if (resolution === "1W") vndResolution = "W";
    if (resolution === "1M") vndResolution = "M";
    if (resolution === "15m") vndResolution = "15";
    if (resolution === "1h") vndResolution = "60";

    const fromTime = Math.floor(period1.getTime() / 1000);
    const toTime = Math.floor(period2.getTime() / 1000);

    // --- 1. PRIMARY: VNDIRECT DChart API ---
    try {
      const url = `${this.dchartUrl}?symbol=${cleanSymbol}&resolution=${vndResolution}&from=${fromTime}&to=${toTime}`;
      const response = await axios.get(url, {
        headers: this.headers,
        timeout: 10000,
      });

      const data = response.data;
      if (data && data.s === "ok" && data.t && data.t.length > 0) {
        return data.t.map((timestamp: number, idx: number) => ({
          symbol: cleanSymbol,
          timestamp: new Date(timestamp * 1000),
          open: data.o[idx] * 1000,
          high: data.h[idx] * 1000,
          low: data.l[idx] * 1000,
          close: data.c[idx] * 1000,
          volume: data.v[idx] || 0,
          resolution,
        }));
      }
    } catch (error: any) {
      this.logger.warn(
        `VNDIRECT DChart failed to get historical for ${symbol}: ${error.message}. Falling back to Yahoo Finance...`,
      );
    }

    // --- 2. FALLBACK: Yahoo Finance (Only daily, weekly, monthly resolutions) ---
    try {
      const yahooSymbol = `${cleanSymbol}.VN`;
      let interval: "1d" | "1wk" | "1mo" = "1d";
      if (resolution === "1W") interval = "1wk";
      if (resolution === "1M") interval = "1mo";

      const results = await this.yf.historical(yahooSymbol, {
        period1,
        period2,
        interval,
      });

      return results.map((candle: any) => ({
        symbol: cleanSymbol,
        timestamp: new Date(candle.date),
        open: candle.open || candle.close,
        high: candle.high || candle.close,
        low: candle.low || candle.close,
        close: candle.close,
        volume: candle.volume || 0,
        resolution,
      }));
    } catch (error: any) {
      this.logger.error(
        `Yahoo Finance historical fallback failed for ${symbol}: ${error.message}`,
      );
      throw new ProviderError(
        this.name,
        `Failed to get historical for ${symbol}`,
        error,
      );
    }
  }

  async getCompanyProfile(symbol: string): Promise<NormalizedCompany> {
    const cleanSymbol = symbol.toUpperCase();
    const yahooSymbol = `${cleanSymbol}.VN`;

    try {
      const summary = await this.yf.quoteSummary(yahooSymbol, {
        modules: ["summaryProfile", "defaultKeyStatistics", "price"],
      });

      if (!summary) {
        throw new Error(`Empty Yahoo Finance quoteSummary for ${yahooSymbol}`);
      }

      const p = (summary.price || {}) as any;
      const sp = (summary.summaryProfile || {}) as any;
      const ks = (summary.defaultKeyStatistics || {}) as any;

      return {
        symbol: cleanSymbol,
        name: p.longName || p.shortName || cleanSymbol,
        exchange: p.exchange || "HOSE",
        industry: sp.industry || "Capital Markets",
        marketCap: p.marketCap || ks.enterpriseValue || 0,
        pe:
          sp.trailingPE ||
          (p.regularMarketPrice && ks.trailingEps
            ? p.regularMarketPrice / ks.trailingEps
            : 0),
        pb: ks.priceToBook || 0,
        eps: ks.trailingEps || 0,
        outstandingShares: ks.sharesOutstanding || p.sharesOutstanding || 0,
      };
    } catch (error: any) {
      this.logger.error(
        `Yahoo Finance getCompanyProfile failed for ${symbol}: ${error.message}`,
      );

      // Secondary fallback: Return a generic basic profile to prevent bootstrap failures
      this.logger.warn(
        `Returning basic mock profile as final safety measure for ${cleanSymbol}`,
      );
      return {
        symbol: cleanSymbol,
        name: `${cleanSymbol} Joint Stock Company`,
        exchange: "HOSE",
        industry: "Financial Services",
        marketCap: 0,
        pe: 0,
        pb: 0,
        outstandingShares: 0,
      };
    }
  }
}
