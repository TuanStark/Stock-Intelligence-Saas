import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AlertService {
    constructor(private readonly prisma: PrismaService) {}

    // Get all user alert rules and triggered events
    async getUserAlerts(userId: string) {
        const rules = await this.prisma.alertRule.findMany({
            where: { userId },
            include: {
                instrument: true,
                events: { orderBy: { triggeredAt: 'desc' }, take: 10 },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Map rules to simplified layout
        const mappedRules = rules.map((r) => ({
            id: r.id,
            symbol: r.instrument.symbol,
            name: r.instrument.name,
            type: r.type, // e.g. PRICE_ABOVE, PRICE_BELOW
            condition: r.condition,
            threshold: Number(r.threshold),
            enabled: r.enabled,
            createdAt: r.createdAt,
            events: r.events.map((e) => ({
                id: e.id,
                triggeredValue: Number(e.triggeredValue),
                triggeredAt: e.triggeredAt,
                status: e.status,
            })),
        }));

        // Get all triggered alert events across all rules
        const recentEvents = await this.prisma.alertEvent.findMany({
            where: {
                alertRule: { userId },
            },
            include: {
                alertRule: { include: { instrument: true } },
            },
            orderBy: { triggeredAt: 'desc' },
            take: 15,
        });

        const mappedEvents = recentEvents.map((e) => ({
            id: e.id,
            symbol: e.alertRule.instrument.symbol,
            type: e.alertRule.type,
            threshold: Number(e.alertRule.threshold),
            triggeredValue: Number(e.triggeredValue),
            triggeredAt: e.triggeredAt,
            status: e.status,
        }));

        return {
            success: true,
            data: {
                rules: mappedRules,
                events: mappedEvents,
            },
        };
    }

    // Create a price alert rule
    async createAlertRule(
        userId: string,
        symbol: string,
        type: string,
        threshold: number,
    ) {
        const cleanSymbol = symbol.toUpperCase().trim();
        const instrument = await this.prisma.instrument.findFirst({
            where: { symbol: cleanSymbol },
        });

        if (!instrument) {
            throw new NotFoundException(`Instrument ${symbol} not found`);
        }

        const rule = await this.prisma.alertRule.create({
            data: {
                userId,
                instrumentId: instrument.id,
                type, // PRICE_ABOVE or PRICE_BELOW
                condition: type === 'PRICE_ABOVE' ? '>=' : '<=',
                threshold,
                enabled: true,
            },
            include: {
                instrument: true,
            },
        });

        return {
            success: true,
            data: {
                id: rule.id,
                symbol: rule.instrument.symbol,
                type: rule.type,
                threshold: Number(rule.threshold),
                enabled: rule.enabled,
            },
        };
    }

    // Delete alert rule
    async deleteAlertRule(userId: string, ruleId: string) {
        const rule = await this.prisma.alertRule.findFirst({
            where: { id: ruleId, userId },
        });

        if (!rule) {
            throw new NotFoundException(`Alert rule ${ruleId} not found`);
        }

        // Delete alert events first to prevent constraint violations
        await this.prisma.alertEvent.deleteMany({
            where: { alertRuleId: ruleId },
        });

        await this.prisma.alertRule.delete({
            where: { id: ruleId },
        });

        return {
            success: true,
            message: 'Alert rule deleted successfully',
        };
    }
}
