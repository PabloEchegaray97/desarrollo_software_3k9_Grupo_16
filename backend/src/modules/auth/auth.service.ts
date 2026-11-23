import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { DatabaseConnectionService } from '../../database/database-connection.service.js';
import { invalidCredentials } from './auth-errors.js';
import { normalizeEmail } from './email-normalization.js';
import type { PasswordHasher } from './password-hasher.contract.js';
import { PASSWORD_HASHER } from './scrypt-password-hasher.js';
import { SessionTokenService } from './session-token.service.js';
import type { SessionUser } from './session-user.js';
import { UserEntity } from './user.entity.js';

export interface LoginResult {
  readonly user: SessionUser;
  readonly token: string;
}

const toSessionUser = (user: UserEntity): SessionUser => ({ id: user.id, email: user.email });

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private decoyHash: Promise<string> | undefined;

  constructor(
    private readonly database: DatabaseConnectionService,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly tokens: SessionTokenService,
  ) {}

  /**
   * Verifica siempre un hash (real o ficticio) para que un email inexistente y una
   * contraseña incorrecta produzcan el mismo error con un costo equivalente.
   */
  async login(email: string, password: string): Promise<LoginResult> {
    const user = await (await this.users()).findOneBy({ email: normalizeEmail(email) });
    const valid = await this.hasher.verify(password, user?.passwordHash ?? (await this.decoy()));
    if (!user || !valid) {
      this.logger.warn({ event: 'login_failed' });
      throw invalidCredentials();
    }
    this.logger.log({ event: 'login_succeeded' });
    return { user: toSessionUser(user), token: this.tokens.sign(user.id) };
  }

  async findSessionUser(token: string | null): Promise<SessionUser | null> {
    if (!token) return null;
    const claims = this.tokens.verify(token);
    if (!claims) return null;
    const user = await (await this.users()).findOneBy({ id: claims.sub });
    return user ? toSessionUser(user) : null;
  }

  private decoy(): Promise<string> {
    this.decoyHash ??= this.hasher.hash(randomBytes(32).toString('base64url'));
    return this.decoyHash;
  }

  private async users(): Promise<Repository<UserEntity>> {
    return (await this.database.ensureInitialized()).getRepository(UserEntity);
  }
}
