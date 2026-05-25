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

  async publishSignal(symbol: string, signalData: any): Promise<void> {
    const channel = `market:signals:${symbol.toUpperCase()}`;
    await this.client.publish(channel, JSON.stringify({ symbol, ...signalData }));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
