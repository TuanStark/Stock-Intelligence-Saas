import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PersonalizationController } from './personalization.controller';
import { PersonalizationService } from './personalization.service';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'activity-tracking',
    }),
  ],
  controllers: [PersonalizationController],
  providers: [PersonalizationService],
  exports: [PersonalizationService],
})
export class PersonalizationModule {}
