import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule } from "./prisma/prisma.module";
import { AiSummaryModule } from "./features/ai-summary/ai-summary.module";
import { PersonalizationModule } from "./features/personalization/personalization.module";

@Module({
  imports: [
    PrismaModule,
    AiSummaryModule,
    PersonalizationModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    BullModule.registerQueue({
      name: "ai-summary",
    }),
  ],
})
export class AppModule {}
