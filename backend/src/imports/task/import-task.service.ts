import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { DataSource, In, Repository } from 'typeorm';

import { ImportTaskStatus } from './import-task-status.enum';
import { ImportTask } from './import-task.entity';
import { ImportItem } from '../item/import-item.entity';
import { ImportItemService } from '../item/import-item.service';

const STORAGE_FOLDER_NAME = 'storage';
const SYNC_READ = 'sync' as const;
const ASYNC_READ = 'async' as const;
const DEFAULT_ASYNC_BATCH_SIZE = 1000;
const ASYNC_PROGRESS_LOG_EVERY_BATCHES = 10;

export type FileReadStrategy = typeof SYNC_READ | typeof ASYNC_READ;

type ProcessFileResult = {
  taskId: number;
  strategy: FileReadStrategy;
  imported: number;
  durationMs: number;
  status: ImportTaskStatus;
};

@Injectable()
export class ImportTaskService {
  private readonly logger = new Logger(ImportTaskService.name);

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
  async processFile(
    taskId: number,
    fileReadStrategy: FileReadStrategy = SYNC_READ,
  ): Promise<ProcessFileResult> {
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

    const startedAt = Date.now();
    let imported = 0;
    this.logger.log(
      `Processing started for task=${taskId}, strategy=${fileReadStrategy}`,
    );

    try {
      imported =
        fileReadStrategy === ASYNC_READ
          ? await this.asyncRead(filePath, taskId)
          : await this.syncRead(filePath, taskId);
    } catch (e: unknown) {
      await this.repo.update(taskId, {
        status: ImportTaskStatus.FAILED,
      });
      this.logger.error(
        `Processing failed for task=${taskId}, strategy=${fileReadStrategy}: ${normalizeError(e)}`,
      );

      throw new InternalServerErrorException(
        `Task ${taskId} processing failed with error: ${normalizeError(e)}`,
      );
    }

    const durationMs = Date.now() - startedAt;
    this.logger.log(
      `Processing completed for task=${taskId}, strategy=${fileReadStrategy}, imported=${imported}, durationMs=${durationMs}`,
    );

    return {
      taskId,
      strategy: fileReadStrategy,
      imported,
      durationMs,
      status: ImportTaskStatus.COMPLETED,
    };
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

  private async syncRead(filePath: string, taskId: number): Promise<number> {
    this.logger.log(`Sync read started for task=${taskId}`);
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(filePath);
    } catch (e: unknown) {
      throw new NotFoundException(
        `Task ${taskId} file not found. Error: ${normalizeError(e)}`,
      );
    }

    // Keep item writes and completion status update atomic to avoid a partial "completed" state.
    const imported = await this.dataSource.transaction(async (manager) => {
      const importResult = await this.importItemService.importCsvWithManager(
        manager,
        taskId,
        fileBuffer,
      );

      await manager.getRepository(ImportTask).update(taskId, {
        status: ImportTaskStatus.COMPLETED,
      });

      return importResult.imported;
    });
    this.logger.log(`Sync read finished for task=${taskId}, imported=${imported}`);
    return imported;
  }

  private async asyncRead(
    filePath: string,
    taskId: number,
    batchSize = DEFAULT_ASYNC_BATCH_SIZE,
  ): Promise<number> {
    try {
      await fs.access(filePath);
    } catch (e: unknown) {
      throw new NotFoundException(
        `Task ${taskId} file not found. Error: ${normalizeError(e)}`,
      );
    }
    const fileStreamParser =
      this.importItemService.getStreamCsvParser(filePath);

    const batchedRecords: string[][] = [];
    let processedCount = 0;
    let processedBatches = 0;
    this.logger.log(
      `Async read started for task=${taskId}, batchSize=${batchSize}`,
    );

    for await (const row of fileStreamParser) {
      const parsedRow = Array.isArray(row) ? row.map(String) : [String(row)];
      batchedRecords.push(parsedRow);

      if (batchedRecords.length >= batchSize) {
        await this.dataSource.transaction(async (manager) => {
          const itemRepo = manager.getRepository(ImportItem);

          const items = batchedRecords.map((row: string[]) =>
            itemRepo.create({
              rawData: row.join(','), // or JSON.stringify(row), or map to columns later
              task: { id: taskId },
            }),
          );
          await itemRepo.save(items);

          processedCount += batchedRecords.length;
          processedBatches += 1;

          batchedRecords.length = 0;
        });
        if (processedBatches % ASYNC_PROGRESS_LOG_EVERY_BATCHES === 0) {
          this.logger.log(
            `Async read progress for task=${taskId}: batches=${processedBatches}, imported=${processedCount}`,
          );
        }
      }
    }

    // Save any remaining records in the batch
    if (batchedRecords.length > 0) {
      await this.dataSource.transaction(async (manager) => {
        const itemRepo = manager.getRepository(ImportItem);

        const items = batchedRecords.map((row: string[]) =>
          itemRepo.create({
            rawData: row.join(','), // or JSON.stringify(row), or map to columns later
            task: { id: taskId },
          }),
        );
        await itemRepo.save(items);

        processedCount += batchedRecords.length;
        processedBatches += 1;
      });
    }

    await this.repo.update(taskId, {
      status: ImportTaskStatus.COMPLETED,
    });
    this.logger.log(
      `Async read finished for task=${taskId}, batches=${processedBatches}, imported=${processedCount}`,
    );

    return processedCount;
  }
}

/** Normalize unknown thrown values into a safe string message. */
function normalizeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
