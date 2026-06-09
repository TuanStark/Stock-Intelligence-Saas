import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// ─── Decorator ─────────────────────────────────────────────

export const TIER_KEY = 'required_tier';

/**
 * Require a minimum subscription tier to access a route.
 *
 * Usage:
 * ```ts
 * @UseGuards(JwtAuthGuard, TierGuard)
 * @RequireTier('PRO')
 * @Get('ai-summary')
 * ```
 */
export const RequireTier = (...tiers: string[]) => SetMetadata(TIER_KEY, tiers);

// ─── Tier Hierarchy ────────────────────────────────────────

const TIER_LEVELS: Record<string, number> = {
  FREE: 0,
  PRO: 1,
  API: 2,
};

// ─── Guard ─────────────────────────────────────────────────

@Injectable()
export class TierGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredTiers = this.reflector.getAllAndOverride<string[]>(TIER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredTiers || requiredTiers.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.tier) {
      throw new ForbiddenException('Subscription tier required');
    }

    const userLevel = TIER_LEVELS[user.tier] ?? 0;
    const minRequired = Math.min(
      ...requiredTiers.map((t) => TIER_LEVELS[t] ?? 0),
    );

    if (userLevel < minRequired) {
      throw new ForbiddenException(
        `This feature requires ${requiredTiers.join(' or ')} subscription`,
      );
    }

    return true;
  }
}
