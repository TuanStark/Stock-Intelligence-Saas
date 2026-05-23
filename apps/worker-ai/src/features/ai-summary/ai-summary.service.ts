// src/features/ai-summary/ai-summary.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ProcessedSummaryResult } from './types/ai-summary.types';
import { AiSummaryRepository } from './ai-summary.repository';
import { PromptBuilder } from './templates/prompt.builder';
import { FallbackProvider } from './helper/fallback.provider';
import { LlmClientService } from './helper/llm-client.service';

@Injectable()
export class AiSummaryService {
  private readonly logger = new Logger(AiSummaryService.name);
  private readonly CACHE_HOURS = 6;

  constructor(
    private readonly repository: AiSummaryRepository,
    private readonly promptBuilder: PromptBuilder,
    private readonly fallbackProvider: FallbackProvider,
    private readonly llmClient: LlmClientService,
  ) { }

  async processSummary(
    instrumentId: string,
    symbol: string,
  ): Promise<ProcessedSummaryResult> {

    const cached = await this.repository.findValidCache(instrumentId, this.CACHE_HOURS);
    if (cached) {
      this.logger.log(`Cache hit for ${symbol}`);
      return { status: 'skipped', reason: 'cached', summaryId: cached.id };
    }

    try {
      const context = await this.repository.gatherContextData(instrumentId);
      const prompt = this.promptBuilder.build(symbol, context);

      const aiResponse = await this.llmClient.generate(prompt, symbol);

      const summary = await this.repository.createSummary(
        instrumentId,
        aiResponse,
        'gpt-4o-mini',
        this.CACHE_HOURS
      );

      this.logger.log(`AI Summary created for ${symbol} (ID: ${summary.id})`);
      return { status: 'success', summaryId: summary.id };

    } catch (error) {
      this.logger.warn(`LLM failed for ${symbol}, using fallback`, error);

      const fallbackData = this.fallbackProvider.getFallbackData(symbol);
      const fallback = await this.repository.createSummary(
        instrumentId,
        fallbackData,
        'simulated-fallback-v1',
        this.CACHE_HOURS
      );

      return { status: 'success', summaryId: fallback.id, fallback: true };
    }
  }
}