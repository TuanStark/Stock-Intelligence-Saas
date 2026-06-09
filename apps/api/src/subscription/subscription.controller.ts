import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  BadRequestException,
  ForbiddenException,
  Param,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  /**
   * Retrieve the authenticated user's subscription details.
   * GET /api/v1/subscription
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getMySubscription(@Req() req: any) {
    return this.subscriptionService.getSubscription(req.user.id);
  }

  /**
   * Initiate a dynamic payment upgrade request.
   * POST /api/v1/subscription/upgrade
   */
  @Post('upgrade')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async initiateUpgrade(
    @Req() req: any,
    @Body('tier') tier: string,
    @Body('provider') provider: string = 'PAYOS',
  ) {
    if (!tier) {
      throw new BadRequestException('Subscription tier is required');
    }
    return this.subscriptionService.initiateUpgrade(
      req.user.id,
      tier,
      provider,
    );
  }

  /**
   * Public Webhook endpoint for PayOS.
   * POST /api/v1/subscription/webhook/payos
   */
  @Post('webhook/payos')
  @HttpCode(HttpStatus.OK)
  async handlePayosWebhook(
    @Body() payload: any,
    @Headers('x-api-key') headerSignature?: string,
  ) {
    if (!payload || !payload.data) {
      throw new BadRequestException('Invalid PayOS webhook payload');
    }
    const signature = payload.signature || headerSignature;
    if (!signature) {
      throw new BadRequestException(
        'PayOS signature is missing in body or headers',
      );
    }
    return this.subscriptionService.handlePayosWebhook(payload, signature);
  }

  /**
   * Public Webhook endpoint for SePay.
   * POST /api/v1/subscription/webhook/sepay
   */
  @Post('webhook/sepay')
  @HttpCode(HttpStatus.OK)
  async handleSepayWebhook(
    @Body() payload: any,
    @Headers('Authorization') authHeader: string,
  ) {
    if (!payload) {
      throw new BadRequestException('Invalid SePay webhook payload');
    }

    // SePay authorization token usually sent as "Apikey <token>"
    let apiKey = '';
    if (authHeader && authHeader.startsWith('Apikey ')) {
      apiKey = authHeader.substring(7);
    } else if (authHeader) {
      apiKey = authHeader;
    }

    return this.subscriptionService.handleSepayWebhook(payload, apiKey);
  }

  /**
   * Direct subscription upgrade (manually updates the database subscription for development/bypass flow).
   * POST /api/v1/subscription/direct-upgrade
   */
  @Post('direct-upgrade')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async directUpgrade(@Req() req: any, @Body('tier') tier: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'Direct upgrades are disabled in production environment',
      );
    }
    if (!tier) {
      throw new BadRequestException('Subscription tier is required');
    }
    return this.subscriptionService.upgradeSubscription(req.user.id, tier);
  }

  /**
   * Check current status of a specific payment transaction.
   * GET /api/v1/subscription/check-status/:referenceCode
   */
  @Get('check-status/:referenceCode')
  @UseGuards(JwtAuthGuard)
  async checkTransactionStatus(
    @Req() req: any,
    @Param('referenceCode') referenceCode: string,
  ) {
    if (!referenceCode) {
      throw new BadRequestException('Transaction reference code is required');
    }
    return this.subscriptionService.checkTransactionStatus(
      req.user.id,
      referenceCode,
    );
  }
}
