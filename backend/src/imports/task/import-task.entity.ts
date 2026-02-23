import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ImportTaskStatus } from './import-task-status.enum';

@Entity()
export class ImportTask {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  filename?: string | null;

  @Column({ nullable: true })
  fileKey?: string | null;

  @Column({
    type: 'varchar',
    default: ImportTaskStatus.CREATED,
  })
  status: ImportTaskStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
