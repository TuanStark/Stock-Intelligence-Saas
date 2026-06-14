import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

interface MarketTick {
  time: Date;
  symbol: string;
  price: number;
  volume: number;
}

@Injectable()
export class MarketDataBatchIngestor implements OnModuleDestroy {
  private readonly logger = new Logger(MarketDataBatchIngestor.name);
  private tickBuffer: MarketTick[] = [];
  private readonly maxBufferSize = 1000;
  private readonly flushIntervalMs = 2000;
  private flushInterval: NodeJS.Timeout | null = null;
  private isFlushing = false;

  constructor(private readonly prisma: PrismaService) {
    this.startSchedule();
  }

  public pushTick(tick: MarketTick) {
    this.tickBuffer.push(tick);
    if (this.tickBuffer.length >= this.maxBufferSize) {
      this.logger.debug(
        `Buffer reached maximum size (${this.tickBuffer.length}). Flushing immediately.`,
      );
      this.flush();
    }
  }

  private startSchedule() {
    this.flushInterval = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  public async flush() {
    if (this.tickBuffer.length === 0 || this.isFlushing) return;

    this.isFlushing = true;
    const currentBatch = [...this.tickBuffer];
    this.tickBuffer = [];

    try {
      const startTime = Date.now();

      const values: string[] = [];
      const params: any[] = [];

      currentBatch.forEach((tick, index) => {
        const offset = index * 4;
        values.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`,
        );
        params.push(tick.time, tick.symbol, tick.price, tick.volume);
      });

      const sql = `
        INSERT INTO "raw_ticks" ("time", "symbol", "price", "volume") 
        VALUES ${values.join(", ")} 
        ON CONFLICT ("symbol", "time") 
        DO UPDATE SET 
          "volume" = EXCLUDED."volume",
          "price" = EXCLUDED."price"
      `;
      await this.prisma.$executeRawUnsafe(sql, ...params);

      const elapsed = Date.now() - startTime;
      this.logger.log(
        `Bulk inserted ${currentBatch.length} market ticks successfully in ${elapsed}ms!`,
      );
    } catch (err) {
      this.logger.error(
        "Failed to batch insert ticks into database. Dropping batch to prevent OOM memory leak.",
        err,
      );
    } finally {
      this.isFlushing = false;
    }
  }

  onModuleDestroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
  }
}
