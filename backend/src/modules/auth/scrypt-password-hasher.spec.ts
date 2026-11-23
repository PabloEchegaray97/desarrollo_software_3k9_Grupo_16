import { ScryptPasswordHasher } from './scrypt-password-hasher.js';

describe('ScryptPasswordHasher', () => {
  const hasher = new ScryptPasswordHasher();
  const password = 'contrasena-ficticia-123';

  it('stores a self-describing hash that never contains the password', async () => {
    const encoded = await hasher.hash(password);
    expect(encoded).toMatch(/^scrypt\$16384\$8\$1\$[\w-]+\$[\w-]+$/);
    expect(encoded).not.toContain(password);
  });

  it('uses a random salt for every hash', async () => {
    expect(await hasher.hash(password)).not.toBe(await hasher.hash(password));
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const encoded = await hasher.hash(password);
    await expect(hasher.verify(password, encoded)).resolves.toBe(true);
    await expect(hasher.verify('otra-contrasena-ficticia', encoded)).resolves.toBe(false);
  });

  it.each([
    '',
    'texto-plano',
    'bcrypt$16384$8$1$c2FsdA$aGFzaA',
    'scrypt$1000$8$1$c2FsdA$aGFzaA',
    'scrypt$16384$x$1$c2FsdA$aGFzaA',
    'scrypt$16384$8$1$$aGFzaA',
  ])('returns false for malformed hash %p', async (encoded) => {
    await expect(hasher.verify(password, encoded)).resolves.toBe(false);
  });
});
