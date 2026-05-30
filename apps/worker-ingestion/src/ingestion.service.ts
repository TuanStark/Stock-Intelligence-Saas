import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { Instrument } from '@stock-intel/db';
import { PrismaService } from './prisma/prisma.service';
import { ProviderFallbackService } from './adapters/provider.service';
import { RedisService } from './redis/redis.service';
import { MarketDataBatchIngestor } from './ingestor/market-data-batch.ingestor';

const DEFAULT_VN_SYMBOLS = [
  'VNM', 'VCB', 'FPT', 'MWG', 'HPG',
  'VHM', 'VIC', 'MSN', 'TCB', 'MBB',
];

@Injectable()
export class IngestionService implements OnModuleInit {
  private readonly logger = new Logger(IngestionService.name);

  private isIngesting = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: ProviderFallbackService,
    private readonly redis: RedisService,
    private readonly batchIngestor: MarketDataBatchIngestor,
    @InjectQueue('stock-processing') private readonly processingQueue: Queue,
  ) { }

  // ─── Lifecycle ────────────────────────────────────────────

  async onModuleInit() {
    this.logger.log(' IngestionService initialized. Running initial bootstrap…');
    await this.bootstrapInstruments();
    await this.prewarmHistoricalCandles(); // Run background pre-warming for historical candles
    await this.ingestMarketData();
  }

  // ─── Bootstrap Instruments ────────────────────────────────

  private async bootstrapInstruments(): Promise<void> {
    let exchange = await this.prisma.exchange.findFirst({ where: { code: 'HOSE' } });
    if (!exchange) {
      exchange = await this.prisma.exchange.create({
        data: { code: 'HOSE', name: 'Ho Chi Minh Stock Exchange', market: 'VN' },
      });
      this.logger.log('Created exchange: HOSE');
    }

    for (const symbol of DEFAULT_VN_SYMBOLS) {
      const existing = await this.prisma.instrument.findFirst({ where: { symbol } });
      if (existing) continue;

      try {
        const profile = await this.provider.getCompanyProfile(symbol);
        await this.prisma.instrument.create({
          data: {
            symbol,
            name: profile.name,
            currency: 'VND',
            exchangeId: exchange.id,
            industry: profile.industry || null,
            status: 'ACTIVE',
            tradable: true,
          },
        });
        this.logger.log(`Bootstrapped instrument: ${symbol} (${profile.name})`);
      } catch (error) {
        this.logger.warn(`Could not bootstrap ${symbol}: ${(error as Error).message}`);
      }
    }
  }

  // ─── Cron: Market Data Ingestion ──────────────────────────

  @Cron('*/30 * * * * *')
  async ingestMarketData(): Promise<void> {
    if (this.isIngesting) {
      this.logger.debug(' Previous ingestion cycle still running. Skipping this tick.');
      return;
    }

    this.isIngesting = true;
    const startTime = Date.now();

    try {
      const instruments = await this.prisma.instrument.findMany({
        where: { status: 'ACTIVE' },
      });

      if (instruments.length === 0) {
        this.logger.warn('No active instruments found. Skipping ingestion cycle.');
        return;
      }

      this.logger.log(`Ingesting quotes for ${instruments.length} instruments…`);

      const CONCURRENCY = 5;
      const results = { success: 0, failed: 0 };

      for (let i = 0; i < instruments.length; i += CONCURRENCY) {
        const batch = instruments.slice(i, i + CONCURRENCY);

        const settled = await Promise.allSettled(
          batch.map((inst: Instrument) => this.ingestSingleInstrument(inst.id, inst.symbol)),
        );

        for (const result of settled) {
          if (result.status === 'fulfilled') {
            results.success++;
          } else {
            results.failed++;
          }
        }
      }

      const elapsed = Date.now() - startTime;
      this.logger.log(
        `Ingestion cycle complete in ${elapsed}ms — ` +
        `success: ${results.success}, failed: ${results.failed}`,
      );
    } catch (error) {
      this.logger.error(` Fatal error in ingestion cycle: ${(error as Error).message}`);
    } finally {
      this.isIngesting = false;
    }
  }

  // ─── Single Instrument Pipeline ───────────────────────────

  private async ingestSingleInstrument(instrumentId: string, symbol: string): Promise<void> {
    const quote = await this.provider.getQuote(symbol);

    this.batchIngestor.pushTick({
      time: quote.timestamp,
      symbol,
      price: quote.price,
      volume: Math.round(quote.volume),
    });

    await this.redis.publishTick(symbol, {
      symbol,
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
      volume: quote.volume,
      time: quote.timestamp,
    });

    await this.redis.setLatestQuote(symbol, quote);

    // ─── Real-time Live Candle Ingestion ──────────────────────
    const candleDate = new Date(quote.timestamp);
    candleDate.setUTCHours(0, 0, 0, 0); // Standardize daily timestamp to midnight

    await this.prisma.candle.upsert({
      where: {
        instrumentId_timeframe_timestamp: {
          instrumentId,
          timeframe: '1D',
          timestamp: candleDate,
        },
      },
      update: {
        open: Math.round(quote.open),
        high: Math.round(quote.high),
        low: Math.round(quote.low),
        close: Math.round(quote.price),
        volume: Math.round(quote.volume),
      },
      create: {
        instrumentId,
        timeframe: '1D',
        open: Math.round(quote.open),
        high: Math.round(quote.high),
        low: Math.round(quote.low),
        close: Math.round(quote.price),
        volume: Math.round(quote.volume),
        timestamp: candleDate,
        source: 'INGESTION_REALTIME',
      },
    });

    const existingQuote = await this.prisma.quote.findFirst({
      where: { symbol },
    });

    let createdQuote;
    if (existingQuote) {
      createdQuote = await this.prisma.quote.update({
        where: { id: existingQuote.id },
        data: {
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          open: quote.open,
          high: quote.high,
          low: quote.low,
          previousClose: quote.previousClose,
          volume: quote.volume,
          value: quote.value || 0,
          timestamp: quote.timestamp,
          asOf: new Date(),
          source: quote.source,
        },
      });
    } else {
      createdQuote = await this.prisma.quote.create({
        data: {
          instrumentId,
          symbol,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          open: quote.open,
          high: quote.high,
          low: quote.low,
          previousClose: quote.previousClose,
          volume: quote.volume,
          value: quote.value || 0,
          timestamp: quote.timestamp,
          asOf: new Date(),
          source: quote.source,
        },
      });
    }

    await this.processingQueue.add(
      'process-indicators',
      {
        instrumentId,
        symbol,
        quoteId: createdQuote.id,
      },
      {
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      },
    );
  }

  // ─── Background Pre-warming Candles Engine ─────────────────
  private async prewarmHistoricalCandles(): Promise<void> {
    const instruments = await this.prisma.instrument.findMany({
      where: { status: 'ACTIVE' },
    });
    this.logger.log(`Pre-warming and synchronizing historical candles for ${instruments.length} active instruments asynchronously...`);

    // Execute in a background closure to keep main thread bootstrap unblocked
    (async () => {
      for (const inst of instruments) {
        try {
          const cleanSym = inst.symbol.toUpperCase();
          const toTime = Math.floor(Date.now() / 1000);
          const fromTime = toTime - 120 * 24 * 60 * 60; // Fetch 120 calendar days to comfortably cover 60+ trading days

          const url = `https://dchart-api.vndirect.com.vn/dchart/history?symbol=${cleanSym}&resolution=D&from=${fromTime}&to=${toTime}`;
          
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });

          if (response.ok) {
            const data = (await response.json()) as any;
            if (data && data.s === 'ok' && data.t && data.t.length > 0) {
              const limit = 90;
              const startIndex = Math.max(0, data.t.length - limit);
              const candlesToSave = [];

              for (let idx = startIndex; idx < data.t.length; idx++) {
                candlesToSave.push({
                  instrumentId: inst.id,
                  timeframe: '1D',
                  open: Math.round(data.o[idx] * 1000),
                  high: Math.round(data.h[idx] * 1000),
                  low: Math.round(data.l[idx] * 1000),
                  close: Math.round(data.c[idx] * 1000),
                  volume: data.v[idx] || 0,
                  timestamp: new Date(data.t[idx] * 1000),
                  source: 'VNDIRECT_DCHART_PREWARM',
                });
              }

              for (const item of candlesToSave) {
                await this.prisma.candle.upsert({
                  where: {
                    instrumentId_timeframe_timestamp: {
                      instrumentId: item.instrumentId,
                      timeframe: item.timeframe,
                      timestamp: item.timestamp,
                    },
                  },
                  update: {
                    open: item.open,
                    high: item.high,
                    low: item.low,
                    close: item.close,
                    volume: item.volume,
                  },
                  create: item,
                });
              }
              this.logger.log(` Successfully synchronized ${candlesToSave.length} real historical daily candles for ${cleanSym}`);
            }
          }
        } catch (e) {
          this.logger.error(`Failed to pre-warm historical candles for ${inst.symbol}:`, e);
        }
        // Throttling: 1-second delay between requests to be friendly to public external API rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    })();
  }

  // ─── Cron: Periodic Historical Candles Synchronization ──────
  @Cron('0 */6 * * *')
  async handlePeriodicHistoricalSync(): Promise<void> {
    this.logger.log('⌛ Starting periodic background sync for historical daily candles...');
    await this.prewarmHistoricalCandles();
  }
}
