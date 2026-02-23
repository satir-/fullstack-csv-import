import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ImportTaskController } from './import-task.controller';
import { ImportTask } from './import-task.entity';
import { ImportTaskService } from './import-task.service';

@Module({
  imports: [TypeOrmModule.forFeature([ImportTask])],
  controllers: [ImportTaskController],
  providers: [ImportTaskService],
})
export class ImportTaskModule {}
