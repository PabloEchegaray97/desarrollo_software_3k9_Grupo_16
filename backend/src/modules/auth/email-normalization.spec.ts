import { normalizeEmail } from './email-normalization.js';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Odontologo.Ficticio@EXAMPLE.test ')).toBe('odontologo.ficticio@example.test');
  });
});
