import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImportItem } from './import-item.entity';

@Injectable()
export class ImportItemService {
  constructor(
    @InjectRepository(ImportItem)
    private readonly importItemRepo: Repository<ImportItem>,
  ) {}

  async create(taskId: number, rawData: string) {
    const item = this.importItemRepo.create({ taskId, rawData });
    return this.importItemRepo.save(item);
  }
}
