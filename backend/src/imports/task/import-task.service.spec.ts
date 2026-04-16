import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { DataSource, Repository } from 'typeorm';

import { ImportItemService } from '../item/import-item.service';
import { ImportTask } from './import-task.entity';
import { ImportTaskService } from './import-task.service';
import { ImportTaskStatus } from './import-task-status.enum';

type MockRepo = Partial<Record<keyof Repository<ImportTask>, jest.Mock>>;

describe('ImportTaskService', () => {
  let service: ImportTaskService;
  let repo: MockRepo;
  let importItemService: {
    getStreamCsvParser: jest.Mock;
    saveCsvBatchWithManager: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(fs, 'access').mockResolvedValue(undefined);
    jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    jest.spyOn(fs, 'rm').mockResolvedValue(undefined);
    jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

    repo = {
      create: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    importItemService = {
      getStreamCsvParser: jest.fn(),
      saveCsvBatchWithManager: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(),
    };

    service = new ImportTaskService(
      repo as unknown as Repository<ImportTask>,
      importItemService as unknown as ImportItemService,
      dataSource as unknown as DataSource,
    );
  });

  it('rejects upload when task is not in created status', async () => {
    (repo.findOneBy as jest.Mock).mockResolvedValue({
      id: 1,
      status: ImportTaskStatus.UPLOADED,
    });

    await expect(
      service.uploadFile(1, {
        buffer: Buffer.from('a,b'),
        filename: 'source.csv',
        originalname: 'source.csv',
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('marks task as failed and rethrows known HTTP exceptions', async () => {
    (repo.findOneBy as jest.Mock).mockResolvedValue({
      id: 1,
      fileKey: 'imports/1/sample.csv',
      status: ImportTaskStatus.UPLOADED,
    });
    (repo.update as jest.Mock)
      .mockResolvedValueOnce({ affected: 1 })
      .mockResolvedValueOnce({ affected: 1 });
    dataSource.transaction.mockRejectedValue(new NotFoundException('bad csv'));

    await expect(service.processFile(1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.update).toHaveBeenNthCalledWith(
      2,
      1,
      expect.objectContaining({ status: ImportTaskStatus.FAILED }),
    );
  });

  it('marks task as failed and wraps unknown errors as 500', async () => {
    (repo.findOneBy as jest.Mock).mockResolvedValue({
      id: 1,
      fileKey: 'imports/1/sample.csv',
      status: ImportTaskStatus.UPLOADED,
    });
    (repo.update as jest.Mock)
      .mockResolvedValueOnce({ affected: 1 })
      .mockResolvedValueOnce({ affected: 1 });
    dataSource.transaction.mockRejectedValue(new Error('parser exploded'));

    await expect(service.processFile(1)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(repo.update).toHaveBeenNthCalledWith(
      2,
      1,
      expect.objectContaining({ status: ImportTaskStatus.FAILED }),
    );
  });
});
