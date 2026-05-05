import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MarketService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    // 1. Get Top Movers (Based on highest changePercent in the last 24h)
    // For MVP, we just get the latest quotes and order them
    const topMovers = await this.prisma.quote.findMany({
      orderBy: { changePercent: 'desc' },
      take: 5,
      include: {
        instrument: {
          include: {
            signals: {
              orderBy: { detectedAt: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    const activeSignals = await this.prisma.stockSignal.findMany({
      orderBy: { detectedAt: 'desc' },
      take: 5,
      include: {
        instrument: true
      }
    });

    return {
      success: true,
      data: {
        topMovers: topMovers.map(quote => ({
          symbol: quote.symbol,
          name: quote.instrument.name,
          price: Number(quote.price),
          change: Number(quote.change),
          changePercent: Number(quote.changePercent),
          latestSignal: quote.instrument.signals[0] || null
        })),
        recentSignals: activeSignals
      }
    };
  }

  async searchInstruments(query: string) {
    const results = await this.prisma.instrument.findMany({
      where: {
        OR: [
          { symbol: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ]
      },
      take: 10,
      include: {
        signals: { orderBy: { detectedAt: 'desc' }, take: 1 }
      }
    });

    return {
      success: true,
      data: results
    };
  }

  async getInstrumentDetail(symbol: string) {
    const instrument = await this.prisma.instrument.findFirst({
      where: { symbol: symbol.toUpperCase() },
      include: {
        quotes: { orderBy: { asOf: 'desc' }, take: 1 },
        signals: { orderBy: { detectedAt: 'desc' }, take: 5 },
        aiSummaries: { orderBy: { generatedAt: 'desc' }, take: 1 }
      }
    });

    if (!instrument) return null;

    return {
      success: true,
      data: {
        instrument,
        latestQuote: instrument.quotes[0] || null,
        signals: instrument.signals,
        aiSummary: instrument.aiSummaries[0] || null
      }
    };
  }
}
