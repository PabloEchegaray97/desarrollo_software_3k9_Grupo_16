const base = require('./jest.config.cjs');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
};
