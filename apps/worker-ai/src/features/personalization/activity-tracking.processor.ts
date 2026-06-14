import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { ActivityType } from "@stock-intel/db";

interface TrackJobPayload {
  userId: string;
  activityType: ActivityType;
  symbol?: string;
  sectorId?: string;
  metadata?: any;
}

@Processor("activity-tracking")
export class ActivityTrackingProcessor extends WorkerHost {
  private readonly logger = new Logger(ActivityTrackingProcessor.name);
  private readonly DECAY_FACTOR = 0.92; // 8% interest decay per interaction to fade old history naturally

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<TrackJobPayload>): Promise<any> {
    const { userId, activityType, symbol, sectorId, metadata } = job.data;
    this.logger.log(
      `Processing activity tracking job: ${activityType} for user ${userId}`,
    );

    // 1. Persist the raw activity record in the Timeseries/Postgres logs
    const activity = await this.prisma.userActivity.create({
      data: {
        userId,
        activityType,
        symbol,
        sectorId,
        metadata,
      },
    });

    // 2. Fetch the existing interest profile or create a fresh one
    let profile = await this.prisma.userInterestProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      profile = await this.prisma.userInterestProfile.create({
        data: {
          userId,
          preferredSectors: {},
          viewedStocks: {},
          investmentStyle: "NEUTRAL",
          riskTolerance: 0.5,
        },
      });
    }

    // 3. Process dynamic weights based on activity type (Decay & Boost Model)
    const viewedStocks = (profile.viewedStocks || {}) as Record<string, number>;
    const preferredSectors = (profile.preferredSectors || {}) as Record<
      string,
      number
    >;

    // Step A: Apply Exponential Decay to all existing items to ensure freshness
    for (const key in viewedStocks) {
      viewedStocks[key] = Number(
        (viewedStocks[key] * this.DECAY_FACTOR).toFixed(4),
      );
    }
    for (const key in preferredSectors) {
      preferredSectors[key] = Number(
        (preferredSectors[key] * this.DECAY_FACTOR).toFixed(4),
      );
    }

    // Step B: Calculate and apply active boosts based on interaction type
    let stockBoost = 0;
    let sectorBoost = 0;

    switch (activityType) {
      case ActivityType.VIEW_STOCK:
        stockBoost = 1.0;
        sectorBoost = 0.5;
        break;
      case ActivityType.CLICK_NEWS:
        stockBoost = 1.5;
        sectorBoost = 0.8;
        break;
      case ActivityType.ADD_WATCHLIST:
        stockBoost = 4.0;
        sectorBoost = 2.0;
        break;
      case ActivityType.ADD_PORTFOLIO:
        stockBoost = 6.0;
        sectorBoost = 3.0;
        break;
      case ActivityType.VIEW_SECTOR:
        sectorBoost = 1.0;
        break;
      case ActivityType.INTERACT_AI:
        stockBoost = 2.0;
        sectorBoost = 1.0;
        break;
      default:
        stockBoost = 0.5;
        sectorBoost = 0.2;
    }

    // Apply stock ticker boost
    if (symbol) {
      const upperSymbol = symbol.toUpperCase();
      const currentStockWeight = viewedStocks[upperSymbol] || 0;
      viewedStocks[upperSymbol] = Number(
        (currentStockWeight + stockBoost).toFixed(4),
      );

      // Auto-resolve sector if not provided to enrich context profiles
      if (!sectorId) {
        const instrument = await this.prisma.instrument.findFirst({
          where: { symbol: upperSymbol },
          select: { sectorId: true },
        });
        if (instrument && instrument.sectorId) {
          const currentSectorWeight =
            preferredSectors[instrument.sectorId] || 0;
          preferredSectors[instrument.sectorId] = Number(
            (currentSectorWeight + sectorBoost).toFixed(4),
          );
        }
      }
    }

    // Apply sector boost
    if (sectorId) {
      const currentSectorWeight = preferredSectors[sectorId] || 0;
      preferredSectors[sectorId] = Number(
        (currentSectorWeight + sectorBoost).toFixed(4),
      );
    }

    // 4. Update the computed weights profile back to DB
    await this.prisma.userInterestProfile.update({
      where: { userId },
      data: {
        viewedStocks: viewedStocks as any,
        preferredSectors: preferredSectors as any,
      },
    });

    this.logger.log(`Successfully updated UserInterestProfile for ${userId}`);
    return { success: true, activityId: activity.id };
  }
}
