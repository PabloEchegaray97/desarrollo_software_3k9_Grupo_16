import { z } from 'zod';

const optionalEnvironmentString = <Schema extends z.ZodType>(schema: Schema) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const environmentSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production', 'provision']).default('development'),
  BACKEND_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  APP_TIME_ZONE: z.literal('America/Argentina/Buenos_Aires'),
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.coerce.number().int().min(1).max(65_535).default(3306),
  DATABASE_NAME: z.string().min(1),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  INITIAL_ADMIN_EMAIL: optionalEnvironmentString(z.string().email()),
  INITIAL_ADMIN_PASSWORD: optionalEnvironmentString(z.string().min(12)),
});

export type AppEnvironment = z.infer<typeof environmentSchema>;

export function validateEnvironment(input: Record<string, unknown>): AppEnvironment {
  const result = environmentSchema.safeParse(input);
  if (result.success) {
    return result.data;
  }

  const problems = result.error.issues
    .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid environment configuration: ${problems}`);
}

const testDatabaseSchema = z.object({
  TEST_DATABASE_HOST: z.string().min(1),
  TEST_DATABASE_PORT: z.coerce.number().int().min(1).max(65_535).default(3306),
  TEST_DATABASE_NAME: z.string().min(1),
  TEST_DATABASE_USER: z.string().min(1),
  TEST_DATABASE_PASSWORD: z.string().min(1),
});

export type TestDatabaseEnvironment = z.infer<typeof testDatabaseSchema>;

export function validateTestDatabaseEnvironment(
  input: Record<string, unknown>,
): TestDatabaseEnvironment {
  const result = testDatabaseSchema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  const keys = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`MariaDB integration configuration is required: ${keys}`);
}
