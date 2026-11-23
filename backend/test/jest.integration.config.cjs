const base = require('./jest.config.cjs');

try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  testMatch: ['<rootDir>/test/**/*.integration-spec.ts'],
};
