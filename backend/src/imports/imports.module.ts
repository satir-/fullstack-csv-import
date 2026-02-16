import { Module } from '@nestjs/common';
import { ImportTaskModule } from './task/import-task.module';
import { ImportItemModule } from './item/import-item.module';

@Module({
  imports: [ImportTaskModule, ImportItemModule],
  controllers: [],
  providers: [],
})
export class ImportsModule {}
