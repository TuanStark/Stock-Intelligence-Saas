import { Controller, Post, Get, Body, Req, UseGuards, HttpCode, HttpStatus, Headers, BadRequestException } from '@nestjs/common';
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
        @Body('provider') provider: string = 'PAYOS'
    ) {
        if (!tier) {
            throw new BadRequestException('Subscription tier is required');
        }
        return this.subscriptionService.initiateUpgrade(req.user.id, tier, provider);
    }

    /**
     * Public Webhook endpoint for PayOS.
     * POST /api/v1/subscription/webhook/payos
     */
    @Post('webhook/payos')
    @HttpCode(HttpStatus.OK)
    async handlePayosWebhook(
        @Body() payload: any,
        @Headers('x-api-key') signature: string
    ) {
        if (!payload || !payload.data) {
            throw new BadRequestException('Invalid PayOS webhook payload');
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
        @Headers('Authorization') authHeader: string
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
}
