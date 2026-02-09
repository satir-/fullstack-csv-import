import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { ImportTask } from './import-task.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ImportTask])],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
