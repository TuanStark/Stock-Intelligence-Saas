import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { MarketModule } from './market/market.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

@Module({
    imports: [
        PrismaModule,
        RedisModule,
        AuthModule,
        HealthModule,
        MarketModule,
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(RequestIdMiddleware).forRoutes('*');
    }
}
