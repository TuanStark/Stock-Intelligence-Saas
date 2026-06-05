import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '../env';

@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);
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

    /**
     * Clear cached user assets or authorization status in Redis
     * so that the NestJS API Gateway immediately retrieves their upgraded subscription tier.
     */
    async invalidateUserCache(userId: string): Promise<void> {
        try {
            // Find and delete any cached user watchlists, portfolios, or subscription details using non-blocking SCAN
            const pattern = `si:user:${userId}:*`;
            let cursor = '0';
            let totalDeleted = 0;

            do {
                const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
                cursor = nextCursor;
                if (keys.length > 0) {
                    await this.client.del(...keys);
                    totalDeleted += keys.length;
                }
            } while (cursor !== '0');

            if (totalDeleted > 0) {
                this.logger.log(`Đã xóa ${totalDeleted} cache keys cho User ${userId}`);
            }
        } catch (err: any) {
            this.logger.error(`Lỗi khi dọn dẹp cache cho User ${userId}: ${err.message}`);
        }
    }

    async onModuleDestroy() {
        await this.client.quit();
    }
}
