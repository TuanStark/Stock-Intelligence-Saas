import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class EmbeddingIngesterService {
  private readonly logger = new Logger(EmbeddingIngesterService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tạo vector embedding cho một chuỗi văn bản sử dụng OpenAI Embeddings API.
   */
  async getEmbedding(text: string): Promise<number[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.LITELLM_API_BASE || 'https://api.openai.com/v1';

    if (!apiKey || apiKey.includes('REPLACE')) {
      this.logger.warn('API Key not configured, returning mock zero vector');
      return new Array(1536).fill(0);
    }

    try {
      const response = await fetch(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding API returned ${response.status}`);
      }

      const data = await response.json();
      const embedding = data.data?.[0]?.embedding;
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Empty embedding from API response');
      }

      return embedding;
    } catch (err: any) {
      this.logger.error(`Failed to get embedding from OpenAI: ${err.message}`);
      throw err;
    }
  }

  /**
   * Đồng bộ hóa mô tả công ty (Company Profile Description) vào Vector DB.
   */
  async ingestCompanyProfileEmbedding(instrumentId: string, symbol: string): Promise<void> {
    const cleanSym = symbol.toUpperCase().trim();
    const profile = await this.prisma.companyProfile.findUnique({
      where: { instrumentId },
    });

    if (!profile || !profile.description) {
      this.logger.warn(`No profile found for ${cleanSym}. Ingestion skipped.`);
      return;
    }

    const content = `Mã cổ phiếu: ${cleanSym}. Công ty hoạt động trong lĩnh vực ${profile.industry}. Giới thiệu chung: ${profile.description}`;
    const embedding = await this.getEmbedding(content);

    await this.prisma.marketKnowledgeChunk.upsert({
      where: {
        // Tận dụng tìm kiếm theo symbol + type để làm khóa duy nhất cho profile description
        id: `profile-desc-${cleanSym}`,
      },
      update: {
        instrumentId,
        symbol: cleanSym,
        content,
        embedding,
        type: 'profile_description',
        updatedAt: new Date(),
      },
      create: {
        id: `profile-desc-${cleanSym}`,
        instrumentId,
        symbol: cleanSym,
        content,
        embedding,
        type: 'profile_description',
      },
    });

    this.logger.log(`[RAG Ingestion] Successfully upserted profile embedding for ${cleanSym}`);
  }

  /**
   * Đồng bộ hóa tin tức liên quan vào Vector DB.
   */
  async ingestNewsArticleEmbedding(newsId: string): Promise<void> {
    const article = await this.prisma.newsArticle.findUnique({
      where: { id: newsId },
      include: { newsInstruments: { include: { instrument: true } } },
    });

    if (!article || !article.headline) {
      this.logger.warn(`News article ${newsId} not found. Ingestion skipped.`);
      return;
    }

    const symbolStr = article.newsInstruments.map(ni => ni.instrument.symbol).join(', ') || 'Chưa rõ';
    const instrumentId = article.newsInstruments[0]?.instrumentId || null;
    const symbol = article.newsInstruments[0]?.instrument.symbol || null;

    const content = `Bản tin chứng khoán [Ngày ${new Date(article.publishedAt).toLocaleDateString('vi-VN')}]. Mã liên quan: ${symbolStr}. Tiêu đề: ${article.headline}. Tóm tắt nội dung: ${article.summary || article.content || 'Không có mô tả chi tiết.'}`;
    const embedding = await this.getEmbedding(content);

    await this.prisma.marketKnowledgeChunk.upsert({
      where: {
        id: `news-${newsId}`,
      },
      update: {
        instrumentId,
        symbol,
        content,
        embedding,
        type: 'news',
        metadata: {
          source: article.source,
          publishedAt: article.publishedAt,
          sentiment: article.sentiment,
        },
        updatedAt: new Date(),
      },
      create: {
        id: `news-${newsId}`,
        instrumentId,
        symbol,
        content,
        embedding,
        type: 'news',
        metadata: {
          source: article.source,
          publishedAt: article.publishedAt,
          sentiment: article.sentiment,
        },
      },
    });

    this.logger.log(`[RAG Ingestion] Successfully upserted news article embedding (ID: news-${newsId})`);
  }
}
