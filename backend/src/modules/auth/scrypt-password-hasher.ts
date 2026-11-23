import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PASSWORD_DERIVATION, type PasswordHasher } from './password-hasher.contract.js';

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const MAX_COST = 1_048_576;
const MAX_BLOCK_SIZE = 32;
const MAX_PARALLELIZATION = 16;

function derive(plainText: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(plainText, salt, keyLength, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

function positiveInteger(value: string, max: number): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return parsed >= 1 && parsed <= max ? parsed : null;
}

/**
 * Deriva contraseñas con `scrypt` y las guarda como
 * `scrypt$<N>$<r>$<p>$<salt base64url>$<hash base64url>`.
 */
@Injectable()
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(plainText: string): Promise<string> {
    const salt = randomBytes(PASSWORD_DERIVATION.saltBytes);
    const key = await derive(plainText, salt, PASSWORD_DERIVATION.keyLength, {
      N: COST,
      r: BLOCK_SIZE,
      p: PARALLELIZATION,
    });
    return [
      PASSWORD_DERIVATION.algorithm,
      COST,
      BLOCK_SIZE,
      PARALLELIZATION,
      salt.toString('base64url'),
      key.toString('base64url'),
    ].join('$');
  }

  async verify(plainText: string, encodedHash: string): Promise<boolean> {
    const parts = encodedHash.split('$');
    if (parts.length !== 6 || parts[0] !== PASSWORD_DERIVATION.algorithm) return false;
    const [, costText, blockText, parallelText, saltText, hashText] = parts;
    const cost = positiveInteger(costText, MAX_COST);
    const blockSize = positiveInteger(blockText, MAX_BLOCK_SIZE);
    const parallelization = positiveInteger(parallelText, MAX_PARALLELIZATION);
    if (cost === null || blockSize === null || parallelization === null) return false;
    if ((cost & (cost - 1)) !== 0 || cost < 2) return false;

    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(hashText, 'base64url');
    if (salt.length === 0 || expected.length === 0) return false;

    try {
      const actual = await derive(plainText, salt, expected.length, {
        N: cost,
        r: blockSize,
        p: parallelization,
        maxmem: 256 * cost * blockSize + 1024 * 1024,
      });
      return timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
}
