import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Parser } from 'csv-parse';
import { parse as asyncParse } from 'csv-parse';
import { createReadStream, PathLike } from 'node:fs';
import { EntityManager, Repository } from 'typeorm';

import { ImportItem } from './import-item.entity';

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

  /** Persists one parsed CSV batch inside the provided transaction manager. */
  async saveCsvBatchWithManager(
    manager: EntityManager,
    taskId: number,
    records: string[][],
  ) {
    const itemRepo = manager.getRepository(ImportItem);

    const items = records.map((row: string[]) =>
      itemRepo.create({
        rawData: row.join(','), // or JSON.stringify(row), or map to columns later
        task: { id: taskId },
      }),
    );

    await itemRepo.save(items);
  }

  /** Creates a CSV parser stream for async iterator processing. */
  getStreamCsvParser(filePath: PathLike): AsyncIterable<string[]> {
    const parser = createReadStream(filePath).pipe(
      asyncParse({
        columns: false,
        skip_empty_lines: true,
        trim: true,
      }),
    );
    return parser as Parser & AsyncIterable<string[]>;
  }
}
