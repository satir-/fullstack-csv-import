import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { DataSource, In, Repository } from 'typeorm';

import { ImportTaskStatus } from './import-task-status.enum';
import { ImportTask } from './import-task.entity';
import { ImportItemService } from '../item/import-item.service';

const STORAGE_FOLDER_NAME = 'storage';

@Injectable()
export class ImportTaskService {
  constructor(
    @InjectRepository(ImportTask)
    private readonly repo: Repository<ImportTask>,
    private readonly importItemService: ImportItemService,
    private readonly dataSource: DataSource,
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
    const filePath = path.join(process.cwd(), STORAGE_FOLDER_NAME, fileKey);

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, rawDataFile.buffer);

    await this.repo.update(taskId, {
      filename: originalFilename,
      fileKey,
      status: ImportTaskStatus.UPLOADED,
    });

    return this.requireTask(taskId);
  }

  /**
   * Starts working on a file parse and marks a task as 'processing'.
   * Marks task status as 'completed' on success, 'failed' on error.
   * */
  async processFile(taskId: number): Promise<ImportTask> {
    const task = await this.requireTask(taskId);

    if (!task.fileKey)
      throw new NotFoundException(
        `Task ${taskId} does not have a fileKey to process`,
      );

    const filePath = path.join(
      process.cwd(),
      STORAGE_FOLDER_NAME,
      task.fileKey,
    );

    let fileBuffer: Buffer;
    try {
      // TODO: Consider using a stream instead of buffering the whole file.
      fileBuffer = await fs.readFile(filePath);
    } catch (e: unknown) {
      throw new NotFoundException(
        `Task ${taskId} file not found. Error: ${normalizeError(e)}`,
      );
    }

    // Allow processing only for uploaded tasks and retries from failed status.
    // (Applying status guard on DB level, in cases of fast concurrent requests)
    const res = await this.repo.update(
      {
        id: taskId,
        status: In([ImportTaskStatus.UPLOADED, ImportTaskStatus.FAILED]),
      },
      { status: ImportTaskStatus.PROCESSING },
    );

    if ((res.affected ?? 0) !== 1) {
      const currentTask = await this.requireTask(taskId);
      throw new ConflictException(
        `Task ${taskId} cannot be processed from status ${currentTask.status}`,
      );
    }

    try {
      // Keep item writes and completion status update atomic to avoid a partial "completed" state.
      await this.dataSource.transaction(async (manager) => {
        await this.importItemService.importCsvWithManager(
          manager,
          taskId,
          fileBuffer,
        );
        await manager.getRepository(ImportTask).update(taskId, {
          status: ImportTaskStatus.COMPLETED,
        });
      });
    } catch (e: unknown) {
      await this.repo.update(taskId, {
        status: ImportTaskStatus.FAILED,
      });

      throw new InternalServerErrorException(
        `Task ${taskId} processing failed with error: ${normalizeError(e)}`,
      );
    }

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

/** Normalize unknown thrown values into a safe string message. */
function normalizeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
