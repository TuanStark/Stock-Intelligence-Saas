import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SignalStrength } from "@stock-intel/db";

@Injectable()
export class RecommendationEngineService {
  private readonly logger = new Logger(RecommendationEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Computes personalized stock relevance scores (0 - 100) for a given user
   */
  async computePersonalizedScores(userId: string): Promise<any> {
    this.logger.log(
      `🤖 Starting Recommendation Score computation for user ${userId}…`,
    );

    // 1. Gather all required profile parameters
    const profile = await this.prisma.userInterestProfile.findUnique({
      where: { userId },
    });

    const portfolios = await this.prisma.portfolio.findMany({
      where: { userId },
      include: { positions: true },
    });

    const watchlists = await this.prisma.watchlist.findMany({
      where: { userId },
      include: { items: true },
    });

    // 2. Map portfolios and watchlists to quick-lookup sets
    const heldSymbols = new Set<string>();
    portfolios.forEach((p) =>
      p.positions.forEach((pos) => {
        // Find instrument to get symbol (we'll look it up from database context in step 3)
      }),
    );

    // Retrieve positions and watchlist items with symbol data
    const [dbPositions, dbWatchlistItems] = await Promise.all([
      this.prisma.portfolioPosition.findMany({
        where: { portfolio: { userId } },
        include: { instrument: true },
      }),
      this.prisma.watchlistItem.findMany({
        where: { watchlist: { userId } },
        include: { instrument: true },
      }),
    ]);

    const portfolioSymbols = new Set(
      dbPositions.map((p) => p.instrument.symbol.toUpperCase()),
    );
    const watchlistSymbols = new Set(
      dbWatchlistItems.map((w) => w.instrument.symbol.toUpperCase()),
    );

    const viewedStocks = (profile?.viewedStocks || {}) as Record<
      string,
      number
    >;
    const preferredSectors = (profile?.preferredSectors || {}) as Record<
      string,
      number
    >;

    // 3. Fetch all active instruments and their active technical signals
    const instruments = await this.prisma.instrument.findMany({
      where: { status: "ACTIVE" },
      include: {
        signals: {
          orderBy: { detectedAt: "desc" },
          take: 1,
        },
      },
    });

    // 4. Calculate Linear Hybrid Score per instrument
    // Equation: Score = 35% Portfolio + 25% Watchlist + 15% Views + 15% Sector + 10% Signals
    const upsertPromises = instruments.map(async (inst) => {
      const symbolUpper = inst.symbol.toUpperCase();
      const reasons: string[] = [];

      // A. Portfolio Holding Score (Max 100, Weight: 0.35)
      const isHeld = portfolioSymbols.has(symbolUpper);
      const sPortfolio = isHeld ? 100 : 0;
      if (isHeld) reasons.push("PORTFOLIO_HOLDING");

      // B. Watchlist State Score (Max 100, Weight: 0.25)
      const isWatched = watchlistSymbols.has(symbolUpper);
      const sWatchlist = isWatched ? 100 : 0;
      if (isWatched) reasons.push("WATCHLIST_MEMBER");

      // C. Viewed Frequency Score (Max 100, Weight: 0.15)
      const viewWeight = viewedStocks[symbolUpper] || 0;
      const sViews = Math.min(viewWeight * 10, 100); // Scale 10.0 weight to 100 points
      if (viewWeight > 0.5) reasons.push("FREQUENTLY_VIEWED");

      // D. Sector Preference Score (Max 100, Weight: 0.15)
      const sectorWeight = inst.sectorId
        ? preferredSectors[inst.sectorId] || 0
        : 0;
      const sSector = Math.min(sectorWeight * 10, 100);
      if (sectorWeight > 0.5) reasons.push("SECTOR_AFFINITY");

      // E. Technical Signal Crossover Score (Max 100, Weight: 0.10)
      let sSignal = 0;
      const activeSignal = inst.signals[0];
      if (activeSignal) {
        reasons.push("ACTIVE_TECHNICAL_SIGNAL");
        if (activeSignal.strength === SignalStrength.HIGH) sSignal = 100;
        else if (activeSignal.strength === SignalStrength.MEDIUM) sSignal = 60;
        else sSignal = 30;
      }

      // Linear Combination summation
      const totalScore = Number(
        (
          0.35 * sPortfolio +
          0.25 * sWatchlist +
          0.15 * sViews +
          0.15 * sSector +
          0.1 * sSignal
        ).toFixed(2),
      );

      // Persist only if there is non-zero interest/affinity to save table space
      if (totalScore > 0) {
        return this.prisma.recommendationScore.upsert({
          where: {
            userId_instrumentId: {
              userId,
              instrumentId: inst.id,
            },
          },
          update: {
            score: totalScore,
            reasons: reasons as any,
          },
          create: {
            userId,
            instrumentId: inst.id,
            symbol: upperSymbol(symbolUpper),
            score: totalScore,
            reasons: reasons as any,
          },
        });
      }
      return null;
    });

    await Promise.all(upsertPromises);
    this.logger.log(
      `✅ Completed Recommendation Score computation for user ${userId}`,
    );
    return { success: true };
  }
}

function upperSymbol(sym: string): string {
  return sym.toUpperCase();
}
