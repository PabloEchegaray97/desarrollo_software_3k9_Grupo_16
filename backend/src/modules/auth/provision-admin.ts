import 'reflect-metadata';
import { createApplicationDataSource } from '../../database/data-source.js';
import { MissingUsersTableError, provisionInitialAccount } from './account-provisioning.js';
import { ScryptPasswordHasher } from './scrypt-password-hasher.js';

try {
  process.loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
    throw error;
  }
}

const email = process.env.INITIAL_ADMIN_EMAIL;
const password = process.env.INITIAL_ADMIN_PASSWORD;

if (!email || !password) {
  throw new Error('INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD are required');
}

if (password.length < 12) {
  throw new Error('INITIAL_ADMIN_PASSWORD must contain at least 12 characters');
}

const dataSource = createApplicationDataSource({ ...process.env, APP_ENV: 'provision' });
await dataSource.initialize();
try {
  const outcome = await provisionInitialAccount(dataSource, email, password, new ScryptPasswordHasher());
  console.info(outcome === 'created' ? 'Cuenta inicial creada.' : 'La cuenta inicial ya existía; no se modificó.');
} catch (error) {
  if (error instanceof MissingUsersTableError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
} finally {
  await dataSource.destroy();
}
