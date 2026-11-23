import { jest } from '@jest/globals';
import { HealthService } from './health.service.js';
import type { DatabaseConnectionService } from '../database/database-connection.service.js';

describe('HealthService', () => {
  it('reports an available MariaDB connection', async () => {
    const database = { ping: jest.fn().mockResolvedValue(undefined) };
    const service = new HealthService(database as unknown as DatabaseConnectionService);
    await expect(service.check()).resolves.toEqual({
      statusCode: 200,
      body: { status: 'ok', database: 'up' },
    });
  });

  it('reports degradation without exposing the connection error', async () => {
    const database = { ping: jest.fn().mockRejectedValue(new Error('password=fake')) };
    const service = new HealthService(database as unknown as DatabaseConnectionService);
    const result = await service.check();
    expect(result).toEqual({
      statusCode: 503,
      body: { status: 'degraded', database: 'down' },
    });
    expect(JSON.stringify(result)).not.toContain('password');
  });
});
