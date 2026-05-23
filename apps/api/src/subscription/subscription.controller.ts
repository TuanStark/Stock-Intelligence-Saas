import { Controller, Post, Get, Body, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('subscription')
@UseGuards(JwtAuthGuard)
export class SubscriptionController {
    constructor(private readonly subscriptionService: SubscriptionService) {}

    @Get()
    async getMySubscription(@Req() req: any) {
        return this.subscriptionService.getSubscription(req.user.id);
    }

    @Post('upgrade')
    @HttpCode(HttpStatus.OK)
    async upgrade(@Req() req: any, @Body('tier') tier: string) {
        return this.subscriptionService.upgradeSubscription(req.user.id, tier);
    }
}
