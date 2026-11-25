import type { PathLike } from 'node:fs';
import { fileURLToPath } from 'node:url';

type LoadEnvFile = (path?: PathLike) => void;

export interface LoadEnvironmentOptions {
  environment?: NodeJS.ProcessEnv;
  envFilePath?: PathLike;
  loadEnvFile?: LoadEnvFile;
}

const backendEnvironmentPath = fileURLToPath(new URL('../../.env', import.meta.url));
const defaultLoadEnvFile: LoadEnvFile = (path) => process.loadEnvFile(path);

function restoreExistingVariables(
  environment: NodeJS.ProcessEnv,
  existingVariables: ReadonlyMap<string, string>,
): void {
  for (const [key, value] of existingVariables) {
    environment[key] = value;
  }
}

export function loadEnvironment({
  environment = process.env,
  envFilePath = backendEnvironmentPath,
  loadEnvFile = defaultLoadEnvFile,
}: LoadEnvironmentOptions = {}): void {
  if ((environment.APP_ENV ?? 'development') !== 'development') {
    return;
  }

  const existingVariables = new Map(
    Object.entries(environment).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );

  try {
    loadEnvFile(envFilePath);
  } catch (error) {
    restoreExistingVariables(environment, existingVariables);
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    throw error;
  }

  restoreExistingVariables(environment, existingVariables);
}
