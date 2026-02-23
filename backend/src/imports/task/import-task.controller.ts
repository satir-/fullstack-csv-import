import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { ImportTaskService } from './import-task.service';

@Controller('imports')
export class ImportTaskController {
  constructor(private readonly importsTaskService: ImportTaskService) {}

  @Get('tasks')
  list() {
    return this.importsTaskService.findAll();
  }

  @Post('tasks')
  create() {
    return this.importsTaskService.create();
  }

  @Put('tasks/:taskId/file')
  @UseInterceptors(FileInterceptor('rawData'))
  uploadFile(
    @Param('taskId', ParseIntPipe) taskId: number,
    @UploadedFile() rawDataFile: Express.Multer.File | undefined,
  ) {
    // Keep a simple runtime check for now; switch to ParseFilePipe if validation rules grow.
    if (!rawDataFile) {
      throw new BadRequestException('rawData file is required');
    }

    return this.importsTaskService.uploadFile(taskId, rawDataFile);
  }
}
