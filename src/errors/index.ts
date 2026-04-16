/**
 * Custom error classes for the distributed task queue.
 */

export class TaskQueueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskQueueError';
  }
}

export class JobNotFoundError extends TaskQueueError {
  public readonly jobId: string;
  constructor(jobId: string) {
    super(`Job not found: ${jobId}`);
    this.name = 'JobNotFoundError';
    this.jobId = jobId;
  }
}

export class HandlerNotRegisteredError extends TaskQueueError {
  public readonly jobType: string;
  constructor(jobType: string) {
    super(`No handler registered for job type: ${jobType}`);
    this.name = 'HandlerNotRegisteredError';
    this.jobType = jobType;
  }
}

export class InvalidJobStatusError extends TaskQueueError {
  public readonly expected: string;
  public readonly actual: string;
  constructor(expected: string, actual: string) {
    super(`Invalid job status: expected "${expected}", got "${actual}"`);
    this.name = 'InvalidJobStatusError';
    this.expected = expected;
    this.actual = actual;
  }
}
