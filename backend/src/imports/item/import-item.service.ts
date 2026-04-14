import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { parse as asyncParse } from 'csv-parse';
import { parse as syncParse } from 'csv-parse/sync';
import { createReadStream, PathLike } from 'node:fs';
import { EntityManager, Repository } from 'typeorm';

import { ImportItem } from './import-item.entity';

const SYNC_IMPORT_BATCH_SIZE = 1000;

@Injectable()
export class ImportItemService {
  constructor(
    @InjectRepository(ImportItem)
    private readonly importItemRepo: Repository<ImportItem>,
  ) {}

  /** Creates a new item with the provided task ID and raw data and saves it to the repository. */
  async create(taskId: number, rawData: string) {
    const item = this.importItemRepo.create({ rawData, task: { id: taskId } });
    return this.importItemRepo.save(item);
  }

  /** CSV import flow, bound to the provided entity manager/transaction. */
  async importCsvWithManager(
    manager: EntityManager,
    taskId: number,
    buffer: Buffer,
  ) {
    const text = buffer.toString('utf-8');

    const records = syncParse(text, {
      columns: false,
      skip_empty_lines: true,
      trim: true,
    });

    const itemRepo = manager.getRepository(ImportItem);
    let imported = 0;

    for (let i = 0; i < records.length; i += SYNC_IMPORT_BATCH_SIZE) {
      const batch = records.slice(i, i + SYNC_IMPORT_BATCH_SIZE);
      const items = batch.map((row: string[]) =>
        itemRepo.create({
          rawData: row.join(','), // or JSON.stringify(row), or map to columns later
          task: { id: taskId },
        }),
      );
      await itemRepo.save(items);
      imported += items.length;
    }

    return {
      taskId,
      imported,
    };
  }

  /** Creates a CSV parser stream for async iterator processing. */
  getStreamCsvParser(filePath: PathLike) {
    const parserOptions = {
      columns: false,
      skip_empty_lines: true,
      trim: true,
    };
    return createReadStream(filePath).pipe(asyncParse(parserOptions));
  }
}
