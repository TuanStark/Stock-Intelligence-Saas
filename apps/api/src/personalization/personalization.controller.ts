import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { PersonalizationService } from './personalization.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityType } from '@stock-intel/db';

interface TrackDto {
  userId?: string;
  activityType: ActivityType;
  symbol?: string;
  sectorId?: string;
  metadata?: any;
}

@Controller('personalization')
export class PersonalizationController {
  constructor(
    private readonly personalizationService: PersonalizationService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Post track activity mapping
   */
  @Post('track')
  async trackUserActivity(@Body() dto: TrackDto) {
    const userId = await this.resolveUserId(dto.userId);
    return this.personalizationService.trackActivity({
      userId,
      activityType: dto.activityType,
      symbol: dto.symbol,
      sectorId: dto.sectorId,
      metadata: dto.metadata,
    });
  }

  /**
   * Get personalized recommendation feed
   */
  @Get('feed')
  async getPersonalizedFeed(@Query('userId') queryUserId?: string) {
    const userId = await this.resolveUserId(queryUserId);
    return this.personalizationService.getPersonalizedFeed(userId);
  }

  /**
   * Get HHI and AI diversification intelligence for a portfolio
   */
  @Get('portfolio/:id/intelligence')
  async getPortfolioIntelligence(@Param('id') portfolioId: string) {
    return this.personalizationService.getPortfolioIntelligence(portfolioId);
  }

  /**
   * Helper utility to dynamically resolve a userId for easy testing
   */
  private async resolveUserId(providedUserId?: string): Promise<string> {
    if (providedUserId && providedUserId.length > 5) {
      return providedUserId;
    }

    // Fallback Mock System: retrieve the first active database user to protect dev onboarding
    const defaultUser = await this.prisma.user.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });

    if (!defaultUser) {
      throw new NotFoundException(
        'No active users found in database to resolve default preferences. Run database seed!',
      );
    }

    return defaultUser.id;
  }
}
