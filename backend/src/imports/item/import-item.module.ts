import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportItem } from './import-item.entity';
import { ImportItemController } from './import-item.controller';
import { ImportItemService } from './import-item.service';

@Module({
  imports: [TypeOrmModule.forFeature([ImportItem])],
  controllers: [ImportItemController],
  providers: [ImportItemService],
})
export class ImportItemModule {}
