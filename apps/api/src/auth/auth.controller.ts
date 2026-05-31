import {
    Controller,
    Post,
    Body,
    Res,
    Req,
    HttpCode,
    HttpStatus,
    UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// ─── DTOs ──────────────────────────────────────────────────

class RegisterDto {
    email!: string;
    password!: string;
}

class LoginDto {
    email!: string;
    password!: string;
}

class GoogleLoginDto {
    idToken!: string;
}

// ─── Controller ────────────────────────────────────────────

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    async register(
        @Body() dto: RegisterDto,
        @Res({ passthrough: true }) res: any,
    ) {
        const result = await this.authService.register(dto.email, dto.password);

        this.setRefreshCookie(res, result.refreshToken);

        return {
            success: true,
            data: {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                user: result.user,
            },
        };
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(
        @Body() dto: LoginDto,
        @Res({ passthrough: true }) res: any,
    ) {
        const result = await this.authService.login(dto.email, dto.password);

        this.setRefreshCookie(res, result.refreshToken);

        return {
            success: true,
            data: {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                user: result.user,
            },
        };
    }

    @Post('google')
    @HttpCode(HttpStatus.OK)
    async googleLogin(
        @Body() dto: GoogleLoginDto,
        @Res({ passthrough: true }) res: any,
    ) {
        const result = await this.authService.loginOrRegisterWithGoogle(dto.idToken);

        this.setRefreshCookie(res, result.refreshToken);

        return {
            success: true,
            data: {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                user: result.user,
            },
        };
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refresh(
        @Req() req: any,
        @Res({ passthrough: true }) res: any,
        @Body() body: { refreshToken?: string },
    ) {
        const refreshToken = req.cookies?.['refresh_token'] || body?.refreshToken;
        if (!refreshToken) {
            return {
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Refresh token not found',
                },
            };
        }

        const result = await this.authService.refresh(refreshToken);

        this.setRefreshCookie(res, result.refreshToken);

        return {
            success: true,
            data: {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
            },
        };
    }

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async logout(
        @Req() req: any,
        @Res({ passthrough: true }) res: any,
    ) {
        const refreshToken = req.cookies?.['refresh_token'];
        if (refreshToken) {
            await this.authService.logout(refreshToken);
        }

        res.clearCookie('refresh_token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/api/v1/auth',
        });

        return {
            success: true,
            data: { message: 'Logged out successfully' },
        };
    }

    @Post('me')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async me(@Req() req: any) {
        const user = req.user;
        return {
            success: true,
            data: { user },
        };
    }

    // ─── Helpers ────────────────────────────────────────────

    private setRefreshCookie(res: Response, token: string) {
        res.cookie('refresh_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/api/v1/auth',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
    }
}
