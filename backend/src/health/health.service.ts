import { Injectable } from '@nestjs/common';
import { DatabaseConnectionService } from '../database/database-connection.service.js';

export type HealthBody = {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
};

@Injectable()
export class HealthService {
  constructor(private readonly database: DatabaseConnectionService) {}

  async check(): Promise<{ statusCode: 200 | 503; body: HealthBody }> {
    try {
      await this.database.ping();
      return { statusCode: 200, body: { status: 'ok', database: 'up' } };
    } catch {
      return { statusCode: 503, body: { status: 'degraded', database: 'down' } };
    }
  }
}
