import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { Repository } from 'typeorm';

import { ImportTaskStatus } from './import-task-status.enum';
import { ImportTask } from './import-task.entity';

@Injectable()
export class ImportTaskService {
  constructor(
    @InjectRepository(ImportTask)
    private readonly repo: Repository<ImportTask>,
  ) {}

  /** Creates task intent before any file is uploaded. */
  async create(): Promise<ImportTask> {
    const task = this.repo.create({
      status: ImportTaskStatus.CREATED,
    });
    return this.repo.save(task);
  }

  /** Stores the uploaded file and marks task status as uploaded. */
  async uploadFile(taskId: number, rawDataFile: Express.Multer.File) {
    await this.requireTask(taskId);

    // Prefer a client-provided originalname; filename is mostly useful with disk storage naming.
    const originalFilename = rawDataFile.originalname || rawDataFile.filename;
    const fileKey = this.buildFileKey(taskId, originalFilename);
    const filePath = path.join(process.cwd(), 'storage', fileKey);

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, rawDataFile.buffer);

    await this.repo.update(taskId, {
      filename: originalFilename,
      fileKey,
      status: ImportTaskStatus.UPLOADED,
    });

    return this.requireTask(taskId);
  }

  /** Returns tasks newest first for quick dashboard visibility. */
  async findAll(): Promise<ImportTask[]> {
    return this.repo.find({ order: { id: 'DESC' } });
  }

  /** Loads a task by id and throws a 404 when it does not exist. */
  private async requireTask(taskId: number): Promise<ImportTask> {
    const task = await this.repo.findOneBy({ id: taskId });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} was not found`);
    }

    return task;
  }

  /**
   * Generates a filesystem-safe storage key scoped by task id.
   * Example: imports/42/1730000000000-orders.csv
   */
  private buildFileKey(taskId: number, filename: string): string {
    const sanitizedFilename = filename.replace(/[^A-Za-z0-9._-]/g, '_');
    const uniqueName = `${Date.now()}-${sanitizedFilename}`;
    return path.join('imports', String(taskId), uniqueName);
  }
}
