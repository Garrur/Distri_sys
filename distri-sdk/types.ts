/**
 * Consolidated type definitions for the distri-sdk.
 * Minimal set required for enqueuing jobs.
 */

export type JobStatus   = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'dead';
export type JobPriority = 'high' | 'normal' | 'low';

export const PRIORITIES: readonly JobPriority[] = ['high', 'normal', 'low'] as const;

export interface Job<T = any> {
  id: string;
  type: string;
  data: T;
  status: JobStatus;
  priority: JobPriority;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
}
