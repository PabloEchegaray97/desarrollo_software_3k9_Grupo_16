import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseConnectionService implements OnApplicationShutdown {
  private initialization: Promise<DataSource> | undefined;

  constructor(private readonly dataSource: DataSource) {}

  async ensureInitialized(): Promise<DataSource> {
    if (this.dataSource.isInitialized) {
      return this.dataSource;
    }
    this.initialization ??= this.dataSource.initialize().catch((error: unknown) => {
      this.initialization = undefined;
      throw error;
    });
    return this.initialization;
  }

  async ping(): Promise<void> {
    const dataSource = await this.ensureInitialized();
    await dataSource.query('SELECT 1');
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }
}
