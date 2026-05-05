import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { IngestionService } from './ingestion.service';

@Module({
    imports: [ScheduleModule.forRoot()],
    providers: [IngestionService],
})
export class AppModule { }
