import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { Constants, CacheKeys } from '@stock-intel/config';

// ─── Types ─────────────────────────────────────────────────

interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    user: {
        id: string;
        email: string;
        tier: string;
    };
}

interface AccessTokenPayload {
    sub: string;
    email: string;
    tier: string;
}

// ─── Service ───────────────────────────────────────────────

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        private readonly redis: RedisService,
    ) {}

    // ─── Register ──────────────────────────────────────────

    async register(email: string, password: string): Promise<AuthTokens> {
        // Validate
        if (!email || !password) {
            throw new BadRequestException('Email and password are required');
        }
        if (password.length < Constants.PASSWORD_MIN_LENGTH) {
            throw new BadRequestException(
                `Password must be at least ${Constants.PASSWORD_MIN_LENGTH} characters`,
            );
        }

        // Check duplicate
        const existing = await this.prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() },
        });
        if (existing) {
            throw new ConflictException('Email already registered');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(
            password,
            Constants.BCRYPT_SALT_ROUNDS,
        );

        // Create user + subscription in a transaction
        const user = await this.prisma.$transaction(async (tx: any) => {
            const newUser = await tx.user.create({
                data: {
                    email: email.toLowerCase().trim(),
                    passwordHash,
                },
            });

            await tx.subscription.create({
                data: {
                    userId: newUser.id,
                    tier: 'FREE',
                    status: 'ACTIVE',
                },
            });

            return newUser;
        });

        // Generate tokens
        return this.generateAuthTokens(user.id, user.email, 'FREE');
    }

    // ─── Login ─────────────────────────────────────────────

    async login(email: string, password: string): Promise<AuthTokens> {
        if (!email || !password) {
            throw new BadRequestException('Email and password are required');
        }

        const user = await this.prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() },
            include: { subscription: true },
        });

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (user.status !== 'ACTIVE') {
            throw new UnauthorizedException('Account is not active');
        }

        const passwordValid = await bcrypt.compare(password, user.passwordHash);
        if (!passwordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const tier = user.subscription?.tier || 'FREE';
        return this.generateAuthTokens(user.id, user.email, tier);
    }

    // ─── Refresh ───────────────────────────────────────────

    async refresh(
        refreshToken: string,
    ): Promise<{ accessToken: string; refreshToken: string }> {
        // Find the token
        const tokenHash = this.hashToken(refreshToken);
        const storedToken = await this.prisma.refreshToken.findUnique({
            where: { tokenHash },
            include: { user: { include: { subscription: true } } },
        });

        if (!storedToken) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        // Check if already used (reuse detection)
        if (storedToken.used) {
            // Token reuse detected — revoke entire family
            await this.prisma.refreshToken.deleteMany({
                where: { familyId: storedToken.familyId },
            });
            throw new UnauthorizedException(
                'Token reuse detected — all sessions revoked',
            );
        }

        // Check expiry
        if (new Date() > storedToken.expiresAt) {
            await this.prisma.refreshToken.delete({
                where: { id: storedToken.id },
            });
            throw new UnauthorizedException('Refresh token expired');
        }

        // Mark as used
        await this.prisma.refreshToken.update({
            where: { id: storedToken.id },
            data: { used: true },
        });

        // Generate new token pair (same family)
        const tier = storedToken.user.subscription?.tier || 'FREE';
        const newRefreshToken = uuidv4();
        const newTokenHash = this.hashToken(newRefreshToken);

        await this.prisma.refreshToken.create({
            data: {
                userId: storedToken.userId,
                familyId: storedToken.familyId,
                tokenHash: newTokenHash,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });

        const accessToken = this.generateAccessToken(
            storedToken.userId,
            storedToken.user.email,
            tier,
        );

        return { accessToken, refreshToken: newRefreshToken };
    }

    // ─── Logout ────────────────────────────────────────────

    async logout(refreshToken: string): Promise<void> {
        const tokenHash = this.hashToken(refreshToken);
        const storedToken = await this.prisma.refreshToken.findUnique({
            where: { tokenHash },
        });

        if (storedToken) {
            // Delete entire family to invalidate all related tokens
            await this.prisma.refreshToken.deleteMany({
                where: { familyId: storedToken.familyId },
            });
        }
    }

    // ─── Token Validation (used by JWT strategy) ──────────

    async validateUser(payload: AccessTokenPayload) {
        // Check blacklist
        const blacklisted = await this.redis.exists(
            CacheKeys.tokenBlacklist(payload.sub),
        );
        if (blacklisted) return null;

        return {
            id: payload.sub,
            email: payload.email,
            tier: payload.tier,
        };
    }

    // ─── Private Helpers ───────────────────────────────────

    private async generateAuthTokens(
        userId: string,
        email: string,
        tier: string,
    ): Promise<AuthTokens> {
        const accessToken = this.generateAccessToken(userId, email, tier);

        // Create refresh token
        const refreshToken = uuidv4();
        const tokenHash = this.hashToken(refreshToken);
        const familyId = uuidv4();

        await this.prisma.refreshToken.create({
            data: {
                userId,
                familyId,
                tokenHash,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });

        return {
            accessToken,
            refreshToken,
            user: { id: userId, email, tier },
        };
    }

    private generateAccessToken(
        userId: string,
        email: string,
        tier: string,
    ): string {
        return this.jwt.sign({
            sub: userId,
            email,
            tier,
        });
    }

    private hashToken(token: string): string {
        // Use Node.js built-in crypto for synchronous hashing
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(token).digest('hex');
    }
}
