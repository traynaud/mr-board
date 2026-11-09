import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Marks a project as already synchronised once: from then on, differences
 * are journalised. Before, the first import stays silent (RG-033-05).
 */
@Entity({ name: 'history_baselines' })
export class HistoryBaseline {
  @PrimaryColumn({ name: 'project_id', type: 'integer' })
  projectId!: number;

  @Column({ name: 'baselined_at', type: 'text' })
  baselinedAt!: string;
}
