import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmbeddingIngesterService } from './embedding-ingester.service';

export interface RetrievedChunk {
  id: string;
  instrumentId: string | null;
  symbol: string | null;
  content: string;
  type: string;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
  vectorSimilarity: number;
  keywordScore: number;
  decayedScore: number;
  finalScore: number;
}

@Injectable()
export class HybridRetrieverService implements OnModuleInit {
  private readonly logger = new Logger(HybridRetrieverService.name);
  private hasPgVector = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingIngester: EmbeddingIngesterService,
  ) {}

  async onModuleInit() {
    // Kiểm tra xem pgvector extension có sẵn trong Postgres không
    try {
      await this.prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');
      this.hasPgVector = true;
      this.logger.log('[HybridRetriever] pgvector extension detected and enabled successfully.');
    } catch (err: any) {
      this.logger.warn(
        `[HybridRetriever] pgvector extension NOT available or could not be loaded: ${err.message}. Falling back to in-memory vector calculations.`,
      );
      this.hasPgVector = false;
    }
  }

  /**
   * Tính toán khoảng cách Cosine trong bộ nhớ TypeScript (Phòng hờ trường hợp không có pgvector)
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Truy vấn tìm kiếm Vector (Dense Search)
   */
  private async denseSearch(
    symbol: string,
    queryEmbedding: number[],
    limit: number,
  ): Promise<Array<{ id: string; similarity: number }>> {
    const cleanSym = symbol.toUpperCase().trim();

    if (this.hasPgVector) {
      try {
        // Sử dụng toán tử <=> của pgvector (1 - khoảng cách cosine = cosine similarity)
        // Cần truyền mảng số thực dưới dạng chuỗi định dạng vector: '[v1,v2,...]'
        const vectorString = `[${queryEmbedding.join(',')}]`;
        const results = await this.prisma.$queryRawUnsafe<any[]>(
          `
          SELECT 
            id,
            (1 - (embedding::vector <=> $1::vector))::double precision AS similarity
          FROM market_knowledge_chunks
          WHERE symbol = $2
          ORDER BY similarity DESC
          LIMIT $3
          `,
          vectorString,
          cleanSym,
          limit,
        );

        return results.map((r) => ({
          id: r.id,
          similarity: Number(r.similarity) || 0,
        }));
      } catch (err: any) {
        this.logger.error(`[HybridRetriever] pgvector query failed: ${err.message}. Falling back to in-memory vector search.`);
      }
    }

    // In-memory fallback
    const chunks = await this.prisma.marketKnowledgeChunk.findMany({
      where: { symbol: cleanSym },
      select: { id: true, embedding: true },
    });

    const similarities = chunks
      .map((c) => {
        const sim = this.cosineSimilarity(c.embedding, queryEmbedding);
        return { id: c.id, similarity: sim };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return similarities;
  }

  /**
   * Truy vấn tìm kiếm từ khóa FTS (Sparse Search)
   */
  private async sparseSearch(
    symbol: string,
    queryText: string,
    limit: number,
  ): Promise<Array<{ id: string; score: number }>> {
    const cleanSym = symbol.toUpperCase().trim();
    if (!queryText.trim()) return [];

    try {
      // Sử dụng FTS của PostgreSQL với từ khóa đơn giản hoặc ts_rank
      // Phù hợp cho cả tiếng Việt không dấu và có dấu nhờ to_tsquery / @@
      const results = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT 
          id,
          ts_rank_cd(to_tsvector('simple', content), plainto_tsquery('simple', $1))::double precision AS rank_score
        FROM market_knowledge_chunks
        WHERE symbol = $2 AND to_tsvector('simple', content) @@ plainto_tsquery('simple', $3)
        ORDER BY rank_score DESC
        LIMIT $4
        `,
        queryText,
        cleanSym,
        queryText,
        limit,
      );

      return results.map((r) => ({
        id: r.id,
        score: Number(r.rank_score) || 0,
      }));
    } catch (err: any) {
      this.logger.warn(`[HybridRetriever] PostgreSQL FTS failed: ${err.message}. Falling back to ILIKE text search.`);
      
      // Fallback: Tìm kiếm chứa chữ ILIKE đơn giản
      const chunks = await this.prisma.marketKnowledgeChunk.findMany({
        where: {
          symbol: cleanSym,
          content: { contains: queryText, mode: 'insensitive' },
        },
        take: limit,
      });

      return chunks.map((c) => ({
        id: c.id,
        score: 1.0, // Điểm số bằng phẳng cho các kết quả khớp từ khóa
      }));
    }
  }

  /**
   * Hệ thống tìm kiếm lai (Hybrid Search) tích hợp Vector Dense + FTS Sparse + Time-decay Recency
   */
  async retrieve(
    symbol: string,
    queryText: string,
    options: { limit?: number; alpha?: number; lambdaDecay?: number } = {},
  ): Promise<RetrievedChunk[]> {
    const limit = options.limit || 5;
    const alpha = options.alpha !== undefined ? options.alpha : 0.7; // Tỷ trọng Vector search (Dense)
    const lambdaDecay = options.lambdaDecay !== undefined ? options.lambdaDecay : 0.05; // Hệ số suy giảm tin tức theo ngày

    const cleanSym = symbol.toUpperCase().trim();
    this.logger.log(`[HybridRetriever] Retrieving chunks for ${cleanSym} with query: "${queryText}"`);

    // 1. Lấy vector query embedding
    let queryEmbedding: number[];
    try {
      queryEmbedding = await this.embeddingIngester.getEmbedding(queryText);
    } catch (err) {
      this.logger.error(`[HybridRetriever] Failed to get embedding for query, returning empty chunks: ${err}`);
      return [];
    }

    // 2. Chạy song song Dense Search và Sparse Search
    const [denseResults, sparseResults] = await Promise.all([
      this.denseSearch(cleanSym, queryEmbedding, limit * 2),
      this.sparseSearch(cleanSym, queryText, limit * 2),
    ]);

    const denseMap = new Map<string, number>(denseResults.map((r) => [r.id, r.similarity]));
    const sparseMap = new Map<string, number>(sparseResults.map((r) => [r.id, r.score]));

    // Lấy tất cả các ID xuất hiện trong cả hai kết quả để truy vấn chi tiết
    const allIds = Array.from(new Set([...denseMap.keys(), ...sparseMap.keys()]));
    if (allIds.length === 0) return [];

    const dbChunks = await this.prisma.marketKnowledgeChunk.findMany({
      where: { id: { in: allIds } },
    });

    const now = new Date();

    const scoredChunks: RetrievedChunk[] = dbChunks.map((chunk) => {
      const vectorSimilarity = denseMap.get(chunk.id) || 0;
      const keywordScore = sparseMap.get(chunk.id) || 0;

      // Tính toán Time-decay Recency Bias
      // Tin tức (news) sẽ suy giảm theo thời gian.
      // Mô tả công ty (profile_description) và tóm tắt tín hiệu (technical_signals_summary) có giá trị lâu dài nên lambda = 0
      let lambda = lambdaDecay;
      if (chunk.type === 'profile_description' || chunk.type === 'technical_signals_summary') {
        lambda = 0.0;
      }

      // Delta t tính bằng số ngày kể từ khi tạo/xuất bản chunk
      let publishedDate = chunk.createdAt;
      if (chunk.type === 'news' && chunk.metadata && (chunk.metadata as any).publishedAt) {
        publishedDate = new Date((chunk.metadata as any).publishedAt);
      }
      const diffTime = Math.abs(now.getTime() - publishedDate.getTime());
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      // Công thức: Score_decayed = Similarity * e^(-lambda * delta_t)
      const timeDecayFactor = Math.exp(-lambda * diffDays);
      const decayedScore = vectorSimilarity * timeDecayFactor;

      // Chuẩn hóa điểm từ khóa (Max-normalization đơn giản)
      const maxSparse = Math.max(...Array.from(sparseMap.values()), 1);
      const normalizedKeywordScore = keywordScore / maxSparse;

      // Điểm số lai cuối cùng (Hybrid score)
      const finalScore = alpha * decayedScore + (1 - alpha) * normalizedKeywordScore;

      return {
        id: chunk.id,
        instrumentId: chunk.instrumentId,
        symbol: chunk.symbol,
        content: chunk.content,
        type: chunk.type,
        metadata: chunk.metadata,
        createdAt: chunk.createdAt,
        updatedAt: chunk.updatedAt,
        vectorSimilarity,
        keywordScore: normalizedKeywordScore,
        decayedScore,
        finalScore,
      };
    });

    // Sắp xếp các chunk theo điểm số cuối cùng giảm dần và lấy đúng số lượng giới hạn
    return scoredChunks.sort((a, b) => b.finalScore - a.finalScore).slice(0, limit);
  }
}
