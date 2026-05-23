import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiSummaryProcessor } from './ai-summary.processor';
import { AiSummaryService } from './ai-summary.service';
import { AiSummaryRepository } from './ai-summary.repository';
import { PromptBuilder } from './templates/prompt.builder';
import { FallbackProvider } from './helper/fallback.provider';
import { LlmClientService } from './helper/llm-client.service';

@Module({
  imports: [PrismaModule],
  providers: [
    AiSummaryProcessor,
    AiSummaryService,
    AiSummaryRepository,
    PromptBuilder,
    FallbackProvider,
    LlmClientService,
  ],
  exports: [AiSummaryService],
})
export class AiSummaryModule { }
