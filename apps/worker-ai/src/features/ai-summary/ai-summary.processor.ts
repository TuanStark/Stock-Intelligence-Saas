// src/features/ai-summary/ai-summary.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SummaryJobPayload, ProcessedSummaryResult } from './types/ai-summary.types';
import { AiSummaryService } from './ai-summary.service';

@Processor('ai-summary')
export class AiSummaryProcessor extends WorkerHost {
  private readonly logger = new Logger(AiSummaryProcessor.name);

  constructor(private readonly aiSummaryService: AiSummaryService) {
    super();
  }

  async process(job: Job<SummaryJobPayload>): Promise<ProcessedSummaryResult> {
    const { instrumentId, symbol } = job.data;

    this.logger.log(`Processing AI Summary → ${symbol}`);

    try {
      const result = await this.aiSummaryService.processSummary(instrumentId, symbol);
      return result;
    } catch (error) {
      this.logger.error(`Failed processing ${symbol}`, error);
      throw error; // BullMQ sẽ retry theo config
    }
  }
}