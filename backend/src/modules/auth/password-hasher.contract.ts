export const PASSWORD_DERIVATION = {
  algorithm: 'scrypt',
  saltBytes: 16,
  keyLength: 64,
} as const;

export interface PasswordHasher {
  hash(plainText: string): Promise<string>;
  verify(plainText: string, encodedHash: string): Promise<boolean>;
}
