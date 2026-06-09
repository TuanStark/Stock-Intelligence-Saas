import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import * as crypto from 'crypto';
import { env } from '../../env';

@Injectable()
export class SignatureGuard implements CanActivate {
  private readonly secretKey = env.API_SIGN_SECRET;

  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const type = context.getType();
    if (type !== 'http') return true;

    const req = context.switchToHttp().getRequest();

    // Skip signature verification on OPTIONS preflight
    if (req.method === 'OPTIONS') return true;

    const signature = req.headers['x-signature'];
    const timestampStr = req.headers['x-timestamp'];
    const nonce = req.headers['x-nonce'];

    if (!signature || !timestampStr || !nonce) {
      throw new ForbiddenException('Missing signature headers');
    }

    const timestamp = parseInt(timestampStr as string, 10);
    if (isNaN(timestamp)) {
      throw new ForbiddenException('Invalid signature timestamp');
    }

    // 1. Replay attack check: Max 60 seconds skew allowed
    const currentTime = Date.now();
    if (Math.abs(currentTime - timestamp) > 60000) {
      throw new ForbiddenException('Signature expired');
    }

    // 2. Nonce reuse check: Prevent duplicate requests
    const nonceKey = `nonce:${nonce}`;
    const nonceExists = await this.redis.exists(nonceKey);
    if (nonceExists) {
      throw new ForbiddenException('Duplicate request');
    }

    // Store nonce in Redis for 60 seconds (matching time skew)
    await this.redis.set(nonceKey, '1', 60000);

    // 3. Verify HMAC signature
    const method = req.method.toUpperCase();
    // Use req.originalUrl if available, otherwise fallback to req.url
    const path = req.originalUrl || req.url;

    // Ensure body is serialized consistently
    const bodyStr =
      req.body && Object.keys(req.body).length > 0
        ? JSON.stringify(req.body)
        : '';

    const signString = `${method}:${path}:${timestampStr}:${nonce}:${bodyStr}`;
    const calculatedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(signString)
      .digest('hex');

    if (calculatedSignature !== signature) {
      throw new ForbiddenException('Invalid signature');
    }

    return true;
  }
}
