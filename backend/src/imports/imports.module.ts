import { Module } from '@nestjs/common';

import { ImportItemModule } from './item/import-item.module';
import { ImportTaskModule } from './task/import-task.module';

@Module({
  imports: [ImportTaskModule, ImportItemModule],
  controllers: [],
  providers: [],
})
export class ImportsModule {}
