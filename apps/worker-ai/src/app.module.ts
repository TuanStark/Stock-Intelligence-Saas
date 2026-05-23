import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { AiSummaryProcessor } from './processors/ai-summary.processor';

@Module({
    imports: [
        PrismaModule,
        BullModule.forRoot({
            connection: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379', 10),
                password: process.env.REDIS_PASSWORD || undefined,
            },
        }),
        BullModule.registerQueue({
            name: 'ai-summary',
        }),
    ],
    providers: [
        AiSummaryProcessor,
    ],
})
export class AppModule { }
