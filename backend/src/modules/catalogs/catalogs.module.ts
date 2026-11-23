import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { CatalogReferences } from './catalog-references.js';
import { ChairsController, ProceduresController } from './catalogs.controllers.js';
import { ChairsService } from './chairs.service.js';
import { ProceduresService } from './procedures.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [ProceduresController, ChairsController],
  providers: [ProceduresService, ChairsService, CatalogReferences],
  exports: [CatalogReferences],
})
export class CatalogsModule {}
