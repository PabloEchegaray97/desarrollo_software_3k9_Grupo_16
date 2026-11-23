import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENDA_CONFIGURATION_LOCK } from './transaction-boundary.js';

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const resolved = path.join(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(resolved) : Promise.resolve([resolved]);
    }),
  );
  return nested.flat().filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'));
}

describe('C-01 architecture boundary', () => {
  it('defines only the future agenda lock contract', () => {
    expect(AGENDA_CONFIGURATION_LOCK).toBe('AGENDA_CONFIGURATION');
  });

  it('does not introduce Turno entities or overlap rules', async () => {
    const sharedDirectory = path.dirname(fileURLToPath(import.meta.url));
    const sourceRoot = path.resolve(sharedDirectory, '..', '..');
    const contents = await Promise.all((await sourceFiles(sourceRoot)).map((file) => readFile(file, 'utf8')));
    expect(contents.join('\n')).not.toMatch(/class\s+Turno|solapamiento|overlap/i);
  });
});
