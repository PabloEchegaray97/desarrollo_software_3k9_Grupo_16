import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import type { AppEnvironment } from '../../config/env.validation.js';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PASSWORD_HASHER, ScryptPasswordHasher } from './scrypt-password-hasher.js';
import { SessionGuard } from './session.guard.js';
import { SessionTokenService } from './session-token.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    { provide: PASSWORD_HASHER, useClass: ScryptPasswordHasher },
    {
      provide: SessionTokenService,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnvironment, true>) =>
        new SessionTokenService(config.get('AUTH_SECRET', { infer: true })),
    },
    AuthService,
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
