import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ImportTaskController } from './import-task.controller';
import { ImportTask } from './import-task.entity';
import { ImportTaskService } from './import-task.service';
import { ImportItemModule } from '../item/import-item.module';

@Module({
  imports: [TypeOrmModule.forFeature([ImportTask]), ImportItemModule],
  controllers: [ImportTaskController],
  providers: [ImportTaskService],
})
export class ImportTaskModule {}
