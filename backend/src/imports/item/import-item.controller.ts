import { Body, Controller, Post } from '@nestjs/common';

import { ImportItemService } from './import-item.service';

@Controller('imports')
export class ImportItemController {
  constructor(private readonly importItemService: ImportItemService) {}

  @Post('item')
  create(@Body('taskId') taskId: number, @Body('rawData') rawData: string) {
    return this.importItemService.create(taskId, rawData);
  }
}
