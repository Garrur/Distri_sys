/**
 * Consolidated type definitions for the distributed task queue.
 */

// ── Job Status & Priority ────────────────────────────────────────────────────

export type JobStatus   = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'dead';
export type JobPriority = 'high' | 'normal' | 'low';

export const PRIORITIES: readonly JobPriority[] = ['high', 'normal', 'low'] as const;

// ── Core Job Interface ───────────────────────────────────────────────────────

export interface Job<T = unknown> {
  id: string;
  type: string;
  data: T;
  status: JobStatus;
  priority: JobPriority;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
}

// ── Handler Type ─────────────────────────────────────────────────────────────

export type JobHandler<T = unknown> = (job: Job<T>) => Promise<void>;

// ── Active Job Registry ──────────────────────────────────────────────────────

export interface ActiveJobEntry {
  workerId: number;
  startedAt: number;
  timeout: number;
}

// ── API Response Shapes ──────────────────────────────────────────────────────

export interface QueueDepths {
  high: number;
  normal: number;
  low: number;
  delayed: number;
  dead: number;
}

export interface QueueMetrics {
  jobs_processed_total: number;
  jobs_failed_total: number;
  avg_processing_time_ms: number;
}

export interface StatsResponse {
  queues: QueueDepths;
  metrics: QueueMetrics;
}

export interface JobListResponse {
  jobs: Job[];
}

export interface RetryResponse {
  message: string;
}
