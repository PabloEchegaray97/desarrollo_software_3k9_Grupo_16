import { createApplicationDataSource } from './data-source.js';

try {
  process.loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
    throw error;
  }
}

export default createApplicationDataSource(process.env);
