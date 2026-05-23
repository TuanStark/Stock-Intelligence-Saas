import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { ActivityTrackingProcessor } from './activity-tracking.processor';
import { RecommendationEngineService } from './recommendation-engine.service';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'activity-tracking',
    }),
  ],
  providers: [
    ActivityTrackingProcessor,
    RecommendationEngineService,
  ],
  exports: [
    RecommendationEngineService,
  ],
})
export class PersonalizationModule {}
