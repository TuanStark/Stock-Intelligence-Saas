import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionTier } from '@stock-intel/db';

@Injectable()
export class SubscriptionService {
    constructor(private readonly prisma: PrismaService) {}

    async upgradeSubscription(userId: string, tier: string) {
        // Validate tier
        const upperTier = tier.toUpperCase();
        if (upperTier !== 'FREE' && upperTier !== 'PRO' && upperTier !== 'API') {
            throw new BadRequestException(`Invalid subscription tier: ${tier}`);
        }

        const validTier = upperTier as SubscriptionTier;

        // Perform upsert or update of the subscription record
        const subscription = await this.prisma.subscription.upsert({
            where: { userId },
            create: {
                userId,
                tier: validTier,
                status: 'ACTIVE',
                renewalAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days renewal
            },
            update: {
                tier: validTier,
                status: 'ACTIVE',
                renewalAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
        });

        return {
            success: true,
            data: {
                tier: subscription.tier,
                status: subscription.status,
                renewalAt: subscription.renewalAt,
            },
        };
    }

    async getSubscription(userId: string) {
        const sub = await this.prisma.subscription.findUnique({
            where: { userId },
        });

        return {
            success: true,
            data: sub || { tier: 'FREE', status: 'ACTIVE' },
        };
    }
}
