import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { env } from '../env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { TierGuard } from './guards/tier.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: env.JWT_SECRET,
      signOptions: {
        expiresIn: env.JWT_EXPIRES_IN,
      } as any,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, TierGuard],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
