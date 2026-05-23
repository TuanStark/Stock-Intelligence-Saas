import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CandleAggregatorService {
  private readonly logger = new Logger(CandleAggregatorService.name);
  private isRunning = false;

  constructor(private readonly prisma: PrismaService) {}

  // Run 5 seconds after each minute (e.g. 12:01:05) to ensure all ticks of the previous minute are flushed
  @Cron('5 * * * * *')
  async aggregateCandles() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      this.logger.log('📊 Running 1-minute candle aggregation cycle...');
      const startTime = Date.now();

      // Idempotent aggregate query using PostgreSQL array_agg for high performance
      const query = `
        INSERT INTO "candles" ("id", "instrument_id", "timeframe", "open", "high", "low", "close", "volume", "timestamp", "source")
        SELECT 
            gen_random_uuid()::text as "id",
            i.id as "instrument_id",
            '1m' as "timeframe",
            (array_agg(r.price ORDER BY r.time ASC))[1] as "open",
            max(r.price) as "high",
            min(r.price) as "low",
            (array_agg(r.price ORDER BY r.time DESC))[1] as "close",
            CAST(sum(r.volume) AS decimal(24,8)) as "volume",
            date_trunc('minute', r.time) as "timestamp",
            'aggregation' as "source"
        FROM "raw_ticks" r
        JOIN "instruments" i ON i.symbol = r.symbol
        WHERE r.time >= date_trunc('minute', NOW() - INTERVAL '3 minute')
          AND r.time < date_trunc('minute', NOW())
        GROUP BY date_trunc('minute', r.time), i.id
        ON CONFLICT ("instrument_id", "timeframe", "timestamp") 
        DO UPDATE SET
            "open" = EXCLUDED."open",
            "high" = EXCLUDED."high",
            "low" = EXCLUDED."low",
            "close" = EXCLUDED."close",
            "volume" = EXCLUDED."volume";
      `;

      await this.prisma.$executeRawUnsafe(query);
      
      const elapsed = Date.now() - startTime;
      this.logger.log(`✅ 1m candle aggregation completed in ${elapsed}ms!`);

      // Rollup 5m candles from 1m candles for enhanced chart zooming
      await this.rollupHigherTimeframes();
    } catch (err) {
      this.logger.error('❌ Failed to aggregate candles:', err);
    } finally {
      this.isRunning = false;
    }
  }

  private async rollupHigherTimeframes() {
    try {
      // 5-minute aggregation from 1m candles
      const query5m = `
        INSERT INTO "candles" ("id", "instrument_id", "timeframe", "open", "high", "low", "close", "volume", "timestamp", "source")
        SELECT 
            gen_random_uuid()::text as "id",
            "instrument_id",
            '5m' as "timeframe",
            (array_agg("open" ORDER BY "timestamp" ASC))[1] as "open",
            max("high") as "high",
            min("low") as "low",
            (array_agg("close" ORDER BY "timestamp" DESC))[1] as "close",
            sum("volume") as "volume",
            -- Floor timestamp to 5 minutes
            to_timestamp(floor(extract(epoch from "timestamp") / 300) * 300) as "timestamp",
            'rollup' as "source"
        FROM "candles"
        WHERE "timeframe" = '1m'
          AND "timestamp" >= NOW() - INTERVAL '15 minutes'
        GROUP BY floor(extract(epoch from "timestamp") / 300), "instrument_id"
        ON CONFLICT ("instrument_id", "timeframe", "timestamp") 
        DO UPDATE SET
            "open" = EXCLUDED."open",
            "high" = EXCLUDED."high",
            "low" = EXCLUDED."low",
            "close" = EXCLUDED."close",
            "volume" = EXCLUDED."volume";
      `;

      await this.prisma.$executeRawUnsafe(query5m);
      this.logger.debug('Rolled up 5m candles successfully');
    } catch (err) {
      this.logger.error('❌ Failed rolling up higher timeframe candles:', err);
    }
  }
}
