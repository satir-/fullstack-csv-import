import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportTaskController } from './import-task.controller';
import { ImportTaskService } from './import-task.service';
import { ImportTask } from './import-task.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ImportTask])],
  controllers: [ImportTaskController],
  providers: [ImportTaskService],
})
export class ImportTaskModule {}
