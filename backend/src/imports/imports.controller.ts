import { Body, Controller, Get, Post } from '@nestjs/common';
import { ImportsService } from './imports.service';

@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get('tasks')
  list() {
    return this.importsService.findAll();
  }

  @Post('tasks')
  create(@Body('filename') filename: string) {
    return this.importsService.create(filename);
  }
}
