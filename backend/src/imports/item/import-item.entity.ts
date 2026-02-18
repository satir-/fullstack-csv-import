import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from 'typeorm';

import { ImportTask } from '../task/import-task.entity';

@Entity()
export class ImportItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ImportTask, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId', referencedColumnName: 'id' })
  @Index()
  task: ImportTask;

  /**
   * Expose the FK id for transparency and cheap access (logging/filtering)
   * without declaring a second "taskId" column that could drift from `task`.
   */
  @RelationId((item: ImportItem) => item.task)
  taskId: number;

  @Column()
  rawData: string;

  @Column({ default: 'pending' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  uploadedAt?: Date;
}
