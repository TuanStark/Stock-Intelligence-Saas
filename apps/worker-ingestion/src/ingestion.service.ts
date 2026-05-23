import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { Instrument } from '@stock-intel/db';
import { PrismaService } from './prisma/prisma.service';
import { ProviderFallbackService } from './adapters/provider.service';

/**
 * Default Vietnamese blue-chip symbols to bootstrap on first run.
 * After initial seed, the service dynamically reads active instruments from the database.
 */
const DEFAULT_VN_SYMBOLS = [
  'VNM', 'VCB', 'FPT', 'MWG', 'HPG',
  'VHM', 'VIC', 'MSN', 'TCB', 'MBB',
];

@Injectable()
export class IngestionService implements OnModuleInit {
  private readonly logger = new Logger(IngestionService.name);

  /**
   * Guard flag to prevent overlapping cron runs.
   * If the previous cycle hasn't finished when a new cron tick fires,
   * the new tick is silently skipped to avoid duplicate data & API rate-limit hits.
   */
  private isIngesting = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: ProviderFallbackService,
    @InjectQueue('stock-processing') private readonly processingQueue: Queue,
  ) { }

  // ─── Lifecycle ────────────────────────────────────────────

  async onModuleInit() {
    this.logger.log('🚀 IngestionService initialized. Running initial bootstrap…');
    await this.bootstrapInstruments();
    // Trigger one immediate ingestion cycle so data is available right away
    await this.ingestMarketData();
  }

  // ─── Bootstrap Instruments ────────────────────────────────

  /**
   * Ensures the default VN watch-list exists in the database.
   * Idempotent: skips symbols that already exist.
   */
  private async bootstrapInstruments(): Promise<void> {
    // Upsert the HOSE exchange
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
        this.logger.log(`✅ Bootstrapped instrument: ${symbol} (${profile.name})`);
      } catch (error) {
        this.logger.warn(`⚠️ Could not bootstrap ${symbol}: ${(error as Error).message}`);
      }
    }
  }

  // ─── Cron: Market Data Ingestion ──────────────────────────

  /**
   * Runs every 30 seconds in development.
   * In production, adjust to a sensible interval (e.g. every 5 minutes) to respect API limits.
   */
  @Cron('*/30 * * * * *')
  async ingestMarketData(): Promise<void> {
    // Overlap guard – skip this tick if the previous one is still running
    if (this.isIngesting) {
      this.logger.debug('⏭️ Previous ingestion cycle still running. Skipping this tick.');
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

      this.logger.log(`📥 Ingesting quotes for ${instruments.length} instruments…`);

      // ─── Concurrent ingestion with concurrency limit ─────
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
        `✅ Ingestion cycle complete in ${elapsed}ms — ` +
        `success: ${results.success}, failed: ${results.failed}`,
      );
    } catch (error) {
      this.logger.error(`❌ Fatal error in ingestion cycle: ${(error as Error).message}`);
    } finally {
      this.isIngesting = false;
    }
  }

  // ─── Single Instrument Pipeline ───────────────────────────

  /**
   * Fetches the latest quote for a single instrument from the provider chain,
   * persists it into the database, and dispatches a processing job to BullMQ
   * so that `worker-processing` can compute technical indicators asynchronously.
   */
  private async ingestSingleInstrument(instrumentId: string, symbol: string): Promise<void> {
    // 1. Fetch normalized quote via the fallback provider chain
    const quote = await this.provider.getQuote(symbol);

    // 2. Persist the raw quote
    const createdQuote = await this.prisma.quote.create({
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

    // 3. Dispatch job to worker-processing for technical indicator computation
    await this.processingQueue.add(
      'process-indicators',
      {
        instrumentId,
        symbol,
        quoteId: createdQuote.id,
      },
      {
        removeOnComplete: 100, // Keep last 100 completed jobs for debugging
        removeOnFail: 200,     // Keep last 200 failed jobs for inspection
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,         // 3s → 6s → 12s
        },
      },
    );
  }
}
