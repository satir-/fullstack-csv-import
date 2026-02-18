import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { ImportTaskService } from './import-task.service';
import { ImportItemService } from '../item/import-item.service';

type UploadedRawDataFile = {
  buffer: Buffer;
};

@Controller('imports')
export class ImportTaskController {
  constructor(
    private readonly importsTaskService: ImportTaskService,
    private readonly importsItemService: ImportItemService,
  ) {}

  @Get('tasks')
  list() {
    return this.importsTaskService.findAll();
  }

  @Post('tasks')
  create(@Body('filename') filename: string) {
    return this.importsTaskService.create(filename);
  }

  @Post(':taskId/upload')
  @UseInterceptors(FileInterceptor('rawData'))
  uploadCsv(
    @Param('taskId', ParseIntPipe) taskId: number,
    @UploadedFile() rawDataFile: UploadedRawDataFile | undefined,
  ) {
    // Keep a simple runtime check for now; switch to ParseFilePipe if validation rules grow.
    if (!rawDataFile) {
      throw new BadRequestException('rawData file is required');
    }

    return this.importsItemService.importCsv(taskId, rawDataFile.buffer);
  }
}
