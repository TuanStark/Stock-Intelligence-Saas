import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { SignalDetectorService } from './signal-detector.service';

interface StockProcessingJobPayload {
  instrumentId: string;
  symbol: string;
  quoteId: string;
}

@Processor('stock-processing')
export class StockProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(StockProcessingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly signalDetector: SignalDetectorService,
  ) {
    super();
  }

  async process(job: Job<StockProcessingJobPayload>): Promise<any> {
    const { name, data } = job;

    if (name !== 'process-indicators') {
      this.logger.warn(`Received unknown job name: ${name}. Skipping.`);
      return { skipped: true };
    }

    const { instrumentId, symbol } = data;
    this.logger.log(`Processing technical indicators & signals job for ${symbol}...`);

    try {
      // 1. Fetch the last 100 daily candles to ensure accurate RSI(14) and MACD(12,26,9) baselines
      const candles = await this.prisma.candle.findMany({
        where: {
          instrumentId,
          timeframe: '1D',
        },
        orderBy: {
          timestamp: 'asc',
        },
        take: 100,
      });

      if (candles.length === 0) {
        this.logger.warn(`No historical candles found in DB for ${symbol}. Cannot process indicators.`);
        return { success: false, reason: 'no_candles' };
      }

      // 2. Evaluate quantitative technical signal rules
      await this.signalDetector.detectSignals(instrumentId, symbol, candles);

      return { success: true };
    } catch (err: any) {
      this.logger.error(`Failed to process technical signals for ${symbol}: ${err.message}`, err.stack);
      throw err; // Propagate the error so BullMQ can retry based on backoff config
    }
  }
}
