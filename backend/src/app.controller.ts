import { Controller, Get, ParseIntPipe, Post, Query } from '@nestjs/common';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('debug/memory')
  getMemory() {
    return this.appService.getMemorySnapshot();
  }

  @Get('debug/leak')
  getLeakStatus() {
    return this.appService.getLeakStatus();
  }

  @Post('debug/leak/buffer/start')
  startBufferLeak(
    @Query('chunkKb', new ParseIntPipe({ optional: true })) chunkKb?: number,
    @Query('intervalMs', new ParseIntPipe({ optional: true })) intervalMs?: number,
  ) {
    return this.appService.startBufferLeak(chunkKb, intervalMs);
  }

  @Post('debug/leak/start')
  startLeakLegacy(
    @Query('chunkKb', new ParseIntPipe({ optional: true })) chunkKb?: number,
    @Query('intervalMs', new ParseIntPipe({ optional: true })) intervalMs?: number,
  ) {
    return this.appService.startBufferLeak(chunkKb, intervalMs);
  }

  @Post('debug/leak/buffer/once')
  bufferLeakOnce(
    @Query('chunkKb', new ParseIntPipe({ optional: true })) chunkKb?: number,
  ) {
    return this.appService.bufferLeakOnce(chunkKb);
  }

  @Post('debug/leak/once')
  leakOnceLegacy(
    @Query('chunkKb', new ParseIntPipe({ optional: true })) chunkKb?: number,
  ) {
    return this.appService.bufferLeakOnce(chunkKb);
  }

  @Post('debug/leak/buffer/stop')
  stopBufferLeak() {
    return this.appService.stopBufferLeak();
  }

  @Post('debug/leak/stop')
  stopLeakLegacy() {
    return this.appService.stopBufferLeak();
  }

  @Post('debug/leak/buffer/clear')
  clearBufferLeak() {
    return this.appService.clearBufferLeak();
  }

  @Post('debug/leak/clear')
  clearLeakLegacy() {
    return this.appService.clearBufferLeak();
  }

  @Post('debug/leak/heap/start')
  startHeapLeak(
    @Query('objectsPerTick', new ParseIntPipe({ optional: true }))
    objectsPerTick?: number,
    @Query('intervalMs', new ParseIntPipe({ optional: true })) intervalMs?: number,
  ) {
    return this.appService.startHeapLeak(objectsPerTick, intervalMs);
  }

  @Post('debug/leak/heap/stop')
  stopHeapLeak() {
    return this.appService.stopHeapLeak();
  }

  @Post('debug/leak/heap/clear')
  clearHeapLeak() {
    return this.appService.clearHeapLeak();
  }

  @Post('debug/gc')
  runGc() {
    return this.appService.runGc();
  }
}
