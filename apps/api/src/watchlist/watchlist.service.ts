import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WatchlistService {
  constructor(private readonly prisma: PrismaService) {}

  // Get or create default watchlist for a user
  async getOrCreateWatchlist(userId: string) {
    let watchlist = await this.prisma.watchlist.findFirst({
      where: { userId },
      include: {
        items: {
          include: {
            instrument: {
              include: {
                quotes: { orderBy: { asOf: 'desc' }, take: 1 },
                signals: { orderBy: { detectedAt: 'desc' }, take: 1 },
              },
            },
          },
        },
      },
    });

    if (!watchlist) {
      watchlist = await this.prisma.watchlist.create({
        data: {
          userId,
          name: 'My Watchlist',
        },
        include: {
          items: {
            include: {
              instrument: {
                include: {
                  quotes: { orderBy: { asOf: 'desc' }, take: 1 },
                  signals: { orderBy: { detectedAt: 'desc' }, take: 1 },
                },
              },
            },
          },
        },
      });
    }

    return {
      success: true,
      data: {
        id: watchlist.id,
        name: watchlist.name,
        items: watchlist.items.map((item) => {
          const quote = item.instrument.quotes[0] || null;
          const signal = item.instrument.signals[0] || null;
          return {
            id: item.id,
            addedAt: item.addedAt,
            instrument: {
              id: item.instrument.id,
              symbol: item.instrument.symbol,
              name: item.instrument.name,
              price: quote ? Number(quote.price) : 0,
              change: quote ? Number(quote.change) : 0,
              changePercent: quote ? Number(quote.changePercent) : 0,
              latestSignal: signal || null,
            },
          };
        }),
      },
    };
  }

  // Add a symbol to user's default watchlist
  async addWatchlistItem(userId: string, symbol: string) {
    const cleanSymbol = symbol.toUpperCase().trim();
    const instrument = await this.prisma.instrument.findFirst({
      where: { symbol: cleanSymbol },
    });

    if (!instrument) {
      throw new NotFoundException(`Instrument with symbol ${symbol} not found`);
    }

    // Get the watchlist
    let watchlist = await this.prisma.watchlist.findFirst({
      where: { userId },
    });

    if (!watchlist) {
      watchlist = await this.prisma.watchlist.create({
        data: {
          userId,
          name: 'My Watchlist',
        },
      });
    }

    // Check if item already exists
    const existingItem = await this.prisma.watchlistItem.findUnique({
      where: {
        watchlistId_instrumentId: {
          watchlistId: watchlist.id,
          instrumentId: instrument.id,
        },
      },
    });

    if (existingItem) {
      return {
        success: true,
        message: `${cleanSymbol} is already in your watchlist`,
      };
    }

    await this.prisma.watchlistItem.create({
      data: {
        watchlistId: watchlist.id,
        instrumentId: instrument.id,
      },
    });

    return {
      success: true,
      message: `${cleanSymbol} added to watchlist successfully`,
    };
  }

  // Remove a symbol from watchlist
  async removeWatchlistItem(userId: string, symbol: string) {
    const cleanSymbol = symbol.toUpperCase().trim();
    const instrument = await this.prisma.instrument.findFirst({
      where: { symbol: cleanSymbol },
    });

    if (!instrument) {
      throw new NotFoundException(`Instrument with symbol ${symbol} not found`);
    }

    const watchlist = await this.prisma.watchlist.findFirst({
      where: { userId },
    });

    if (!watchlist) {
      throw new NotFoundException('Watchlist not found');
    }

    try {
      await this.prisma.watchlistItem.delete({
        where: {
          watchlistId_instrumentId: {
            watchlistId: watchlist.id,
            instrumentId: instrument.id,
          },
        },
      });
    } catch (err) {
      // Silence item not found errors
    }

    return {
      success: true,
      message: `${cleanSymbol} removed from watchlist successfully`,
    };
  }
}
