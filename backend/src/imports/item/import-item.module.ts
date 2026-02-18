import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ImportItemController } from './import-item.controller';
import { ImportItem } from './import-item.entity';
import { ImportItemService } from './import-item.service';

@Module({
  imports: [TypeOrmModule.forFeature([ImportItem])],
  controllers: [ImportItemController],
  providers: [ImportItemService],
  exports: [ImportItemService],
})
export class ImportItemModule {}
