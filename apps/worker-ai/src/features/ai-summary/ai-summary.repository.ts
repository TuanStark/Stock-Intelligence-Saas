import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiSentiment, AiSummary } from '@stock-intel/db';
import { AiSummaryResponse, ContextData } from './types/ai-summary.types';

@Injectable()
export class AiSummaryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findValidCache(instrumentId: string, cacheHours: number): Promise<AiSummary | null> {
    const expiry = new Date(Date.now() - cacheHours * 60 * 60 * 1000);

    return this.prisma.aiSummary.findFirst({
      where: {
        instrumentId,
        generatedAt: { gte: expiry },
      },
      orderBy: { generatedAt: 'desc' },
    });
  }

  async createSummary(
    instrumentId: string,
    response: AiSummaryResponse,
    model: string,
    cacheHours: number,
  ): Promise<AiSummary> {
    const dbSentiment = this.mapSentiment(response.sentiment);

    return this.prisma.aiSummary.create({
      data: {
        instrumentId,
        summary: response.summary,
        sentiment: dbSentiment,
        confidence: response.confidence,
        drivers: response.drivers,
        risks: response.risks,
        model,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + cacheHours * 60 * 60 * 1000),
      },
    });
  }

  async gatherContextData(instrumentId: string): Promise<ContextData> {
    const [
      latestQuote,
      activeSignals,
      recentNews,
      companyProfile,
      companyShareholders,
      companyDividends,
      companyFinancialQuarters,
    ] = await Promise.all([
      this.prisma.quote.findFirst({
        where: { instrumentId },
        orderBy: { asOf: 'desc' },
      }),
      this.prisma.stockSignal.findMany({
        where: { instrumentId },
        orderBy: { detectedAt: 'desc' },
        take: 3,
      }),
      this.prisma.newsArticle.findMany({
        where: { newsInstruments: { some: { instrumentId } } },
        orderBy: { publishedAt: 'desc' },
        take: 3,
      }),
      this.prisma.companyProfile.findUnique({
        where: { instrumentId },
      }),
      this.prisma.companyShareholder.findMany({
        where: { instrumentId },
        orderBy: { percentage: 'desc' },
        take: 5,
      }),
      this.prisma.companyDividend.findMany({
        where: { instrumentId },
        orderBy: { exDate: 'desc' },
        take: 5,
      }),
      this.prisma.companyFinancialQuarter.findMany({
        where: { instrumentId },
        orderBy: { quarter: 'desc' },
        take: 4,
      }),
    ]);

    return {
      latestQuote,
      activeSignals,
      recentNews,
      companyProfile,
      companyShareholders,
      companyDividends,
      companyFinancialQuarters,
    };
  }

  private mapSentiment(sentiment: string): AiSentiment {
    if (sentiment === 'BULLISH') return AiSentiment.BULLISH;
    if (sentiment === 'BEARISH') return AiSentiment.BEARISH;
    return AiSentiment.NEUTRAL;
  }
}
