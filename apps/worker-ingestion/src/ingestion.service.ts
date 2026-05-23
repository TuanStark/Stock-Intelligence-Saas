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

    // 1. Ghi gom cụm ticks vào raw_ticks (TimescaleDB hypertable) phục vụ biểu đồ và phân tích
    this.batchIngestor.pushTick({
      time: quote.timestamp,
      symbol,
      price: quote.price,
      volume: Math.round(quote.volume),
    });

    // 2. Xuất bản tick lên Redis Pub/Sub phục vụ WebSocket Gateways thời gian thực
    await this.redis.publishTick(symbol, {
      symbol,
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
      volume: quote.volume,
      time: quote.timestamp,
    });

    // 3. Đồng bộ giá Latest Quote vào Redis Hash Cache phục vụ truy vấn Dashboard cực nhanh
    await this.redis.setLatestQuote(symbol, quote);

    // 4. Đồng bộ vào PostgreSQL table 'quotes' theo cơ chế single-row cache (duy nhất 1 hàng mỗi symbol)
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

    // 5. Đẩy tác vụ xử lý các chỉ số kỹ thuật vào BullMQ hàng đợi bất đồng bộ
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
}
