import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '../env';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async setLatestQuote(symbol: string, quoteData: any): Promise<void> {
    const key = `stock:quote:${symbol.toUpperCase()}`;
    await this.client.hset(key, {
      price: quoteData.price.toString(),
      change: quoteData.change.toString(),
      changePercent: quoteData.changePercent.toString(),
      open: quoteData.open.toString(),
      high: quoteData.high.toString(),
      low: quoteData.low.toString(),
      previousClose: quoteData.previousClose.toString(),
      volume: quoteData.volume.toString(),
      value: (quoteData.value || 0).toString(),
      timestamp: quoteData.timestamp.toISOString ? quoteData.timestamp.toISOString() : new Date(quoteData.timestamp).toISOString(),
      asOf: new Date().toISOString(),
      source: quoteData.source,
    });
  }

  async publishTick(symbol: string, tickData: any): Promise<void> {
    const channel = `market:pubsub:${symbol.toUpperCase()}`;
    await this.client.publish(channel, JSON.stringify(tickData));
  }

  async addTickToStream(symbol: string, tickData: any): Promise<void> {
    const streamKey = 'market:ticks:stream';
    await this.client.xadd(streamKey, '*', 
      'symbol', symbol.toUpperCase(),
      'price', tickData.price.toString(),
      'volume', tickData.volume.toString(),
      'time', tickData.time.toISOString ? tickData.time.toISOString() : new Date(tickData.time).toISOString()
    );
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
