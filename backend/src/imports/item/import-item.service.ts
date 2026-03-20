import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { parse } from 'csv-parse/sync';
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

  /** Processes a CSV file from a buffer, parses its content, and saves the data into the repository. */
  async importCsv(taskId: number, buffer: Buffer) {
    return this.importCsvWithManager(
      this.importItemRepo.manager,
      taskId,
      buffer,
    );
  }

  /** The same CSV import flow but bound to the provided entity manager/transaction. */
  async importCsvWithManager(
    manager: EntityManager,
    taskId: number,
    buffer: Buffer,
  ) {
    const text = buffer.toString('utf-8');

    const records = parse(text, {
      columns: false,
      skip_empty_lines: true,
      trim: true,
    });

    const itemRepo = manager.getRepository(ImportItem);

    const items = records.map((row: string[]) =>
      itemRepo.create({
        rawData: row.join(','), // or JSON.stringify(row), or map to columns later
        task: { id: taskId },
      }),
    );

    await itemRepo.save(items);

    return {
      taskId,
      imported: items.length,
    };
  }
}
