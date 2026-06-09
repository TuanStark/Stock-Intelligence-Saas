import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class RateLimiterGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Rate limit by authenticated user ID if present
    if (req.user && req.user.id) {
      return `user:${req.user.id}`;
    }
    // Fallback to client IP address
    const ip =
      req.headers['x-forwarded-for'] ||
      req.ip ||
      req.socket.remoteAddress ||
      '127.0.0.1';
    return `ip:${ip}`;
  }

  protected async handleRequest(requestProps: any): Promise<boolean> {
    const { context, limit } = requestProps;
    const type = context.getType();

    if (type === 'http') {
      const req = context.switchToHttp().getRequest();
      const user = req.user;

      let dynamicLimit = limit;

      if (user) {
        const tier = user.tier || 'FREE';
        if (tier === 'PRO' || tier === 'API') {
          dynamicLimit = 500; // Pro/API tiers get 500 requests per minute
        } else {
          dynamicLimit = 120; // Logged-in FREE tier gets 120 requests per minute
        }
      } else {
        dynamicLimit = 60; // Guest gets 60 requests per minute
      }

      // Apply special strict rate limits on expensive API endpoints
      const handlerName = context.getHandler().name;
      if (handlerName === 'triggerAiSummary') {
        // Strict limit: 30 requests per minute for Pro/API, 5 for Free, 2 for Guest
        const isPremium = user && (user.tier === 'PRO' || user.tier === 'API');
        dynamicLimit = isPremium ? 30 : user ? 5 : 2;
      }

      requestProps.limit = dynamicLimit;
    }

    return super.handleRequest(requestProps);
  }
}
