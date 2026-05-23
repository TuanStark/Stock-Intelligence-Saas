import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { MarketModule } from './market/market.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { WatchlistModule } from './watchlist/watchlist.module';
import { AlertModule } from './alerts/alerts.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { BullModule } from '@nestjs/bullmq';

@Module({
    imports: [
        PrismaModule,
        RedisModule,
        AuthModule,
        HealthModule,
        MarketModule,
        SubscriptionModule,
        WatchlistModule,
        AlertModule,
        BullModule.forRoot({
            connection: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379', 10),
                password: process.env.REDIS_PASSWORD || undefined,
            },
        }),
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(RequestIdMiddleware).forRoutes('*');
    }
}

