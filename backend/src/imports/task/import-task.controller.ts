import { Body, Controller, Get, Post } from '@nestjs/common';
import { ImportTaskService } from './import-task.service';

@Controller('imports')
export class ImportTaskController {
  constructor(private readonly importsService: ImportTaskService) {}

  @Get('tasks')
  list() {
    return this.importsService.findAll();
  }

  @Post('tasks')
  create(@Body('filename') filename: string) {
    return this.importsService.create(filename);
  }
}
