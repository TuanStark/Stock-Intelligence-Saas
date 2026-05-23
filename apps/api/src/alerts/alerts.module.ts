import { Module } from '@nestjs/common';
import { AlertController } from './alerts.controller';
import { AlertService } from './alerts.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [AlertController],
    providers: [AlertService],
    exports: [AlertService],
})
export class AlertModule {}
