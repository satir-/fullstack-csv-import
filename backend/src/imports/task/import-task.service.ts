import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImportTask } from './import-task.entity';

@Injectable()
export class ImportTaskService {
  constructor(
    @InjectRepository(ImportTask)
    private readonly repo: Repository<ImportTask>,
  ) {}

  async create(filename: string): Promise<ImportTask> {
    const task = this.repo.create({ filename });
    return this.repo.save(task);
  }

  async findAll(): Promise<ImportTask[]> {
    return this.repo.find({ order: { id: 'DESC' } });
  }
}
