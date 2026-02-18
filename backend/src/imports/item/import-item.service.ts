import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { parse } from 'csv-parse/sync';
import { Repository } from 'typeorm';

import { ImportItem } from './import-item.entity';

@Injectable()
export class ImportItemService {
  constructor(
    @InjectRepository(ImportItem)
    private readonly importItemRepo: Repository<ImportItem>,
  ) {}

  async create(taskId: number, rawData: string) {
    const item = this.importItemRepo.create({ rawData, task: { id: taskId } });
    return this.importItemRepo.save(item);
  }

  async importCsv(taskId: number, buffer: Buffer) {
    const text = buffer.toString('utf-8');

    const records = parse(text, {
      columns: false,
      skip_empty_lines: true,
      trim: true,
    });

    const items = records.map((row: string[]) =>
      this.importItemRepo.create({
        rawData: row.join(','), // or JSON.stringify(row), or map to columns later
        task: { id: taskId },
      }),
    );

    await this.importItemRepo.save(items);

    return {
      taskId,
      imported: items.length,
    };
  }
}
