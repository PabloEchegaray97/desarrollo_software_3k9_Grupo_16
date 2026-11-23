import { jest } from '@jest/globals';
import { Logger, UnauthorizedException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { DatabaseConnectionService } from '../../database/database-connection.service.js';
import { AuthService } from './auth.service.js';
import type { PasswordHasher } from './password-hasher.contract.js';
import { SessionTokenService } from './session-token.service.js';
import { UserEntity } from './user.entity.js';

const SECRET = 'fictional-secret-with-at-least-32-characters';
const EMAIL = 'odontologo.ficticio@example.test';
const PASSWORD = 'contrasena-ficticia-123';
const USER_ID = '7a1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

function user(): UserEntity {
  return Object.assign(new UserEntity(), { id: USER_ID, email: EMAIL, passwordHash: 'stored-hash', role: 'ODONTOLOGO' });
}

function setup(existing: UserEntity | null) {
  const repository = {
    findOneBy: jest.fn<(where: Partial<UserEntity>) => Promise<UserEntity | null>>().mockResolvedValue(existing),
  };
  const dataSource = { getRepository: () => repository } as unknown as DataSource;
  const database = { ensureInitialized: async () => dataSource } as unknown as DatabaseConnectionService;
  const hasher = {
    hash: jest.fn<PasswordHasher['hash']>().mockResolvedValue('decoy-hash'),
    verify: jest.fn<PasswordHasher['verify']>(async (plain, encoded) => plain === PASSWORD && encoded === 'stored-hash'),
  };
  const tokens = new SessionTokenService(SECRET);
  return { repository, hasher, tokens, service: new AuthService(database, hasher, tokens) };
}

async function failure(promise: Promise<unknown>): Promise<UnauthorizedException> {
  try {
    await promise;
  } catch (error) {
    return error as UnauthorizedException;
  }
  throw new Error('expected rejection');
}

describe('AuthService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('normalizes the email and returns the session user and a token', async () => {
    const { service, repository, tokens } = setup(user());
    const result = await service.login('  Odontologo.Ficticio@EXAMPLE.test ', PASSWORD);
    expect(repository.findOneBy).toHaveBeenCalledWith({ email: EMAIL });
    expect(result.user).toEqual({ id: USER_ID, email: EMAIL });
    expect(tokens.verify(result.token)?.sub).toBe(USER_ID);
  });

  it('fails identically for an unknown email and a wrong password, verifying a hash in both cases', async () => {
    const unknown = setup(null);
    const wrong = setup(user());
    const unknownError = await failure(unknown.service.login('nadie@example.test', PASSWORD));
    const wrongError = await failure(wrong.service.login(EMAIL, 'otra-contrasena-ficticia'));

    expect(unknownError).toBeInstanceOf(UnauthorizedException);
    expect(unknownError.getResponse()).toEqual(wrongError.getResponse());
    expect(unknown.hasher.verify).toHaveBeenCalledWith(PASSWORD, 'decoy-hash');
    expect(wrong.hasher.verify).toHaveBeenCalledTimes(1);
  });

  it('never logs the email, the password or the hash', async () => {
    const calls: unknown[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((...args: unknown[]) => void calls.push(args));
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((...args: unknown[]) => void calls.push(args));
    const { service } = setup(user());
    await service.login(EMAIL, PASSWORD);
    await failure(service.login(EMAIL, 'otra-contrasena-ficticia'));
    const logged = JSON.stringify(calls);
    expect(calls.length).toBe(2);
    for (const secret of [EMAIL, PASSWORD, 'otra-contrasena-ficticia', 'stored-hash']) {
      expect(logged).not.toContain(secret);
    }
  });

  it('resolves the session user from a valid token', async () => {
    const { service, tokens } = setup(user());
    await expect(service.findSessionUser(tokens.sign(USER_ID))).resolves.toEqual({ id: USER_ID, email: EMAIL });
  });

  it('returns null without token, with an invalid token or when the user no longer exists', async () => {
    const { service, tokens } = setup(null);
    await expect(service.findSessionUser(null)).resolves.toBeNull();
    await expect(service.findSessionUser('a.b.c')).resolves.toBeNull();
    await expect(service.findSessionUser(tokens.sign(USER_ID))).resolves.toBeNull();
  });
});
