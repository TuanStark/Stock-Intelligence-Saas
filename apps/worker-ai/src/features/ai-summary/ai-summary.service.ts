// src/features/ai-summary/ai-summary.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ProcessedSummaryResult } from './types/ai-summary.types';
import { AiSummaryRepository } from './ai-summary.repository';
import { PromptBuilder } from './templates/prompt.builder';
import { FallbackProvider } from './helper/fallback.provider';
import { LlmClientService } from './helper/llm-client.service';
import { MarkdownGeneratorService } from './helper/markdown-generator.service';
import { EmbeddingIngesterService } from './helper/embedding-ingester.service';
import { HybridRetrieverService } from './helper/hybrid-retriever.service';

@Injectable()
export class AiSummaryService {
  private readonly logger = new Logger(AiSummaryService.name);
  private readonly CACHE_HOURS = 6;

  constructor(
    private readonly repository: AiSummaryRepository,
    private readonly promptBuilder: PromptBuilder,
    private readonly fallbackProvider: FallbackProvider,
    private readonly llmClient: LlmClientService,
    private readonly markdownGenerator: MarkdownGeneratorService,
    private readonly hybridRetriever: HybridRetrieverService,
    private readonly embeddingIngester: EmbeddingIngesterService,
  ) {}

  async processSummary(
    instrumentId: string,
    symbol: string,
  ): Promise<ProcessedSummaryResult> {
    const cleanSym = symbol.toUpperCase().trim();
    const cached = await this.repository.findValidCache(instrumentId, this.CACHE_HOURS);
    if (cached) {
      this.logger.log(`Cache hit for ${cleanSym}`);
      return { status: 'skipped', reason: 'cached', summaryId: cached.id };
    }

    try {
      const context = await this.repository.gatherContextData(instrumentId);
      
      // 0. Tự động đồng bộ hóa hồ sơ doanh nghiệp và tin tức gần đây vào Vector DB (Self-Healing)
      try {
        this.logger.log(`[RAG Engine] Self-healing embeddings check for ${cleanSym}...`);
        await this.embeddingIngester.ingestCompanyProfileEmbedding(instrumentId, cleanSym);
        
        if (context.recentNews && context.recentNews.length > 0) {
          await Promise.all(
            context.recentNews.map(async (news) => {
              try {
                await this.embeddingIngester.ingestNewsArticleEmbedding(news.id);
              } catch (newsErr) {
                this.logger.warn(`Failed to auto-ingest news embedding for news ID ${news.id}: ${newsErr}`);
              }
            })
          );
        }
      } catch (ingestErr) {
        this.logger.warn(
          `[RAG Engine] Embedding self-healing failed for ${cleanSym} (will continue anyway): ${ingestErr}`,
        );
      }

      let prompt: string;
      try {
        this.logger.log(`[RAG Engine] Generating structured report and retrieving qualitative chunks for ${cleanSym}...`);
        
        // 1. Tạo Markdown Report chứa số liệu tài chính định lượng cứng chính xác 100%
        const markdownReport = await this.markdownGenerator.generateMarkdownReport(instrumentId, cleanSym);

        // 2. Lấy các chunks tin tức/mô tả định tính mềm thông qua Hybrid Search + Recency decay
        const searchQuery = `tin tức hoạt động doanh nghiệp, sự kiện hỗ trợ và báo cáo tài chính của mã ${cleanSym}`;
        const qualitativeChunks = await this.hybridRetriever.retrieve(cleanSym, searchQuery, {
          limit: 5,
          alpha: 0.7,
          lambdaDecay: 0.05,
        });

        // 3. Biên soạn Prompt Hybrid RAG chất lượng cao cho LLM
        prompt = this.promptBuilder.build(cleanSym, context, {
          markdownReport,
          qualitativeChunks,
        });
      } catch (ragError) {
        this.logger.warn(
          `[RAG Engine] Hybrid RAG retrieval failed for ${cleanSym}, falling back to legacy direct context: ${ragError}`,
        );
        // Fallback sang cấu trúc prompt gốc nếu hệ thống RAG gặp lỗi bất ngờ
        prompt = this.promptBuilder.build(cleanSym, context);
      }

      const aiResponse = await this.llmClient.generate(prompt, cleanSym);

      const summary = await this.repository.createSummary(
        instrumentId,
        aiResponse,
        'gpt-4o-mini',
        this.CACHE_HOURS,
      );

      this.logger.log(`AI Summary created for ${cleanSym} (ID: ${summary.id})`);
      return { status: 'success', summaryId: summary.id };

    } catch (error) {
      this.logger.warn(`LLM analysis failed for ${cleanSym}, using fallback provider`, error);

      // Lấy dữ liệu giả lập tài chính định tính chất lượng cao bằng tiếng Việt của FallbackProvider
      const fallbackResponse = this.fallbackProvider.getFallbackData(cleanSym);

      const fallback = await this.repository.createSummary(
        instrumentId,
        fallbackResponse,
        'system-simulation-fallback-v1',
        this.CACHE_HOURS,
      );

      return { status: 'success', summaryId: fallback.id, fallback: true };
    }
  }
}