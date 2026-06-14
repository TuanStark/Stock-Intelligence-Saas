import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { env } from "./env";

// Features & Processors
import { PaymentProcessor } from "./features/payment.processor";
import { SubscriptionSchedulerService } from "./features/subscription-scheduler.service";

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
      },
    }),
    BullModule.registerQueue({
      name: "payment-process",
    }),
  ],
  providers: [PaymentProcessor, SubscriptionSchedulerService],
})
export class AppModule {}
