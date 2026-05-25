import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ActivityType } from '@stock-intel/db';

interface TrackPayload {
  userId: string;
  activityType: ActivityType;
  symbol?: string;
  sectorId?: string;
  metadata?: any;
}

@Injectable()
export class PersonalizationService {
  private readonly logger = new Logger(PersonalizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('activity-tracking') private readonly trackingQueue: Queue,
  ) {}

  /**
   * Tracks user interaction events asynchronously via BullMQ activity-tracking queue
   */
  async trackActivity(payload: TrackPayload) {
    this.logger.log(`Enqueuing activity track event: ${payload.activityType} for user ${payload.userId}`);
    
    try {
      await this.trackingQueue.add(
        'track-event',
        payload,
        {
          removeOnComplete: 100,
          removeOnFail: 500,
          attempts: 3,
        }
      );
      return { success: true, message: 'Hoạt động đã được tiếp nhận và xử lý ngầm.' };
    } catch (err: any) {
      this.logger.error(`Failed to enqueue activity track event:`, err);
      // Fail-safe: fallback to sync writing if queue experiences issues to protect data logging
      try {
        await this.prisma.userActivity.create({
          data: {
            userId: payload.userId,
            activityType: payload.activityType,
            symbol: payload.symbol,
            sectorId: payload.sectorId,
            metadata: payload.metadata,
          },
        });
        return { success: true, message: 'Hoạt động được lưu đồng bộ (hàng đợi bận).' };
      } catch (dbErr) {
        return { success: false, message: 'Không thể ghi nhận hoạt động vào cơ sở dữ liệu.' };
      }
    }
  }

  /**
   * Retrieves personalized feed recommendations based on user's RecommendationScore
   */
  async getPersonalizedFeed(userId: string) {
    const scores = await this.prisma.recommendationScore.findMany({
      where: { userId },
      orderBy: { score: 'desc' },
      take: 10,
      include: {
        instrument: {
          include: {
            quotes: { orderBy: { asOf: 'desc' }, take: 1 },
            signals: { orderBy: { detectedAt: 'desc' }, take: 1 }
          }
        }
      }
    });

    if (scores.length > 0) {
      return {
        success: true,
        source: 'personalized',
        data: scores.map(s => ({
          symbol: s.symbol,
          name: s.instrument.name,
          score: Number(s.score),
          reasons: s.reasons,
          price: s.instrument.quotes[0] ? Number(s.instrument.quotes[0].price) : null,
          changePercent: s.instrument.quotes[0] ? Number(s.instrument.quotes[0].changePercent) : null,
          latestSignal: s.instrument.signals[0] || null
        }))
      };
    }

    // Fallback: If no personalized recommendations computed yet, return overall top instruments with signals
    const topInstruments = await this.prisma.instrument.findMany({
      take: 5,
      include: {
        quotes: { orderBy: { asOf: 'desc' }, take: 1 },
        signals: { orderBy: { detectedAt: 'desc' }, take: 1 }
      }
    });

    return {
      success: true,
      source: 'fallback_global',
      data: topInstruments.map(inst => ({
        symbol: inst.symbol,
        name: inst.name,
        score: 50.00,
        reasons: ['POPULAR_MEMBER'],
        price: inst.quotes[0] ? Number(inst.quotes[0].price) : null,
        changePercent: inst.quotes[0] ? Number(inst.quotes[0].changePercent) : null,
        latestSignal: inst.signals[0] || null
      }))
    };
  }

  /**
   * Generates premium Portfolio Intelligence including HHI calculation, sector phơi nhiễm (allocation),
   * and context-aware AI risk analysis thesis.
   */
  async getPortfolioIntelligence(portfolioId: string) {
    let portfolio;

    if (portfolioId === 'default') {
      // 1. Resolve default active user
      const defaultUser = await this.prisma.user.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' }
      });

      if (!defaultUser) {
        throw new NotFoundException('No active user found. Seed database first!');
      }

      // 2. Resolve or Bootstrap default portfolio
      portfolio = await this.prisma.portfolio.findFirst({
        where: { userId: defaultUser.id },
        include: {
          positions: {
            include: {
              instrument: {
                include: {
                  sector: true,
                  quotes: { orderBy: { asOf: 'desc' }, take: 1 }
                }
              }
            }
          }
        }
      });

      if (!portfolio) {
        // Find HPG & FPT instruments seeded in database
        const fpt = await this.prisma.instrument.findFirst({ where: { symbol: 'FPT' } });
        const hpg = await this.prisma.instrument.findFirst({ where: { symbol: 'HPG' } });

        if (fpt && hpg) {
          portfolio = await this.prisma.portfolio.create({
            data: {
              userId: defaultUser.id,
              name: 'Danh mục Chiến lược Stark',
              baseCurrency: 'VND',
              positions: {
                create: [
                  { instrumentId: fpt.id, quantity: 1500, averageCost: 75000 },
                  { instrumentId: hpg.id, quantity: 4500, averageCost: 24000 }
                ]
              }
            },
            include: {
              positions: {
                include: {
                  instrument: {
                    include: {
                      sector: true,
                      quotes: { orderBy: { asOf: 'desc' }, take: 1 }
                    }
                  }
                }
              }
            }
          });
        }
      }
    }

    // Fallback if querying specific portfolioId
    if (!portfolio && portfolioId !== 'default') {
      portfolio = await this.prisma.portfolio.findUnique({
        where: { id: portfolioId },
        include: {
          positions: {
            include: {
              instrument: {
                include: {
                  sector: true,
                  quotes: { orderBy: { asOf: 'desc' }, take: 1 }
                }
              }
            }
          }
        }
      });
    }

    if (!portfolio) {
      throw new NotFoundException(`Portfolio ${portfolioId} not found`);
    }

    if (portfolio.positions.length === 0) {
      return {
        success: true,
        data: {
          portfolioName: portfolio.name,
          hhi: 0,
          concentrationRating: 'EMPTY',
          allocation: [],
          thesis: 'Hãy nạp các giao dịch mua/bán vào danh mục để kích hoạt phân tích đa dạng hóa danh mục!'
        }
      };
    }

    // 1. Calculate Total Value of Portfolio Positions
    let totalPortfolioValue = 0;
    const positionValues = portfolio.positions.map(pos => {
      const price = pos.instrument.quotes[0] ? Number(pos.instrument.quotes[0].price) : Number(pos.averageCost);
      const value = Number(pos.quantity) * price;
      totalPortfolioValue += value;
      return {
        symbol: pos.instrument.symbol,
        sectorName: pos.instrument.sector?.name || 'Chưa phân loại',
        value
      };
    });

    // 2. Compute Herfindahl-Hirschman Index (HHI) for Stock Concentration
    // Equation: HHI = Sum(s_i ^ 2), where s_i is percentage of total portfolio value
    let hhi = 0;
    positionValues.forEach(pos => {
      const percentage = (pos.value / totalPortfolioValue) * 100;
      hhi += percentage * percentage;
    });

    // 3. Compute Sector Exposure Allocations
    const sectorMap = new Map<string, number>();
    positionValues.forEach(pos => {
      const currentVal = sectorMap.get(pos.sectorName) || 0;
      sectorMap.set(pos.sectorName, currentVal + pos.value);
    });

    const allocation = Array.from(sectorMap.entries()).map(([sectorName, val]) => ({
      sector: sectorName,
      value: val,
      percentage: Number(((val / totalPortfolioValue) * 100).toFixed(2))
    })).sort((a, b) => b.percentage - a.percentage);

    // 4. Determine Concentration Risk Rating
    let rating = 'DIVERSIFIED'; // HHI < 1500
    let ratingText = 'Đa dạng hóa tốt';
    if (hhi >= 2500) {
      rating = 'HIGHLY_CONCENTRATED';
      ratingText = 'Rủi ro tập trung cao';
    } else if (hhi >= 1500) {
      rating = 'MODERATELY_CONCENTRATED';
      ratingText = 'Tập trung trung bình';
    }

    // 5. Generate Dynamic AI/Heuristic Intelligence Thesis
    const topSector = allocation[0];
    let thesis = '';
    if (rating === 'HIGHLY_CONCENTRATED') {
      thesis = `Danh mục của bạn đang có độ rủi ro tập trung cao (Chỉ số HHI: ${Math.round(hhi)}). Nhóm ngành "${topSector.sector}" đang chiếm tỷ trọng áp đảo lên tới ${topSector.percentage}%. Sự phơi nhiễm quá lớn này sẽ khiến tài khoản chịu tác động mạnh nếu ngành xảy ra rung lắc. Cân nhắc đa dạng hóa sang các lĩnh vực phụ trợ để cân bằng danh mục.`;
    } else if (rating === 'MODERATELY_CONCENTRATED') {
      thesis = `Danh mục của bạn ở mức tập trung trung bình (Chỉ số HHI: ${Math.round(hhi)}). Sức phơi nhiễm của ngành "${topSector.sector}" chiếm ${topSector.percentage}%. Đây là mức phân bổ hợp lý giúp tập trung tối ưu hóa lợi nhuận mà vẫn kiểm soát được rủi ro biến động cục bộ của thị trường chứng khoán Việt Nam.`;
    } else {
      thesis = `Danh mục được đa dạng hóa vô cùng lý tưởng (Chỉ số HHI: ${Math.round(hhi)} dưới ngưỡng 1500). Việc trải đều vốn ra nhiều lĩnh vực giúp giảm thiểu tối đa rủi ro phi hệ thống. Hãy tiếp tục duy trì tỷ trọng phân bổ lành mạnh này và bổ sung cảnh báo tín hiệu kỹ thuật để tối đa hóa điểm mua bán tốt.`;
    }

    // Capture Snapshot record in the background asynchronously for analytics history
    this.prisma.portfolioSnapshot.create({
      data: {
        portfolioId: portfolio.id,
        totalValue: totalPortfolioValue,
        cashBalance: 0,
        unrealizedPnl: 0,
        realizedPnl: 0,
        volatility: 0.15, // placeholder risk stdDev
        allocation: allocation as any,
      }
    }).catch(err => this.logger.error('Failed to save portfolio snapshot:', err));

    return {
      success: true,
      data: {
        portfolioName: portfolio.name,
        totalValue: totalPortfolioValue,
        hhi: Math.round(hhi),
        concentrationRating: rating,
        concentrationLabel: ratingText,
        allocation,
        thesis
      }
    };
  }
}
