import { db } from '../../lib/db.js';
import type { GenerationJob, JobType } from '../../shared/types/index.js';

export class JobQueue {
  private isRunning: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private handlerMap: Map<JobType, (job: GenerationJob) => Promise<any>> = new Map();

  public registerHandler(type: JobType, handler: (job: GenerationJob) => Promise<any>) {
    this.handlerMap.set(type, handler);
  }

  public async enqueue(
    projectId: string, 
    jobType: JobType, 
    targetEntityId: string, 
    payload: Record<string, any> = {},
    options?: { userId?: string; maxAttempts?: number; provider?: string }
  ): Promise<GenerationJob> {
    return db.enqueueJob({
      project_id: projectId,
      user_id: options?.userId,
      job_type: jobType,
      target_entity_id: targetEntityId,
      provider: options?.provider,
      payload,
      max_attempts: options?.maxAttempts || 3,
    });
  }

  public async getJob(jobId: string): Promise<GenerationJob | null> {
    return db.getJob(jobId);
  }

  public startWorker(intervalMs: number = 1000) {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[JobQueue] Worker pool started with polling interval:', intervalMs, 'ms');

    this.pollInterval = setInterval(async () => {
      try {
        await this.processNextJob();
      } catch (err: any) {
        console.error('[JobQueue] Error during worker loop:', err.message);
      }
    }, intervalMs);
  }

  public stopWorker() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isRunning = false;
    console.log('[JobQueue] Worker pool stopped.');
  }

  private async processNextJob() {
    const job = await db.getNextPendingJob();
    if (!job) return; // No jobs pending

    console.log(`[JobQueue] Processing job ${job.id} (${job.job_type}) for entity ${job.target_entity_id}`);
    const handler = this.handlerMap.get(job.job_type);

    if (!handler) {
      console.error(`[JobQueue] No handler registered for job type: ${job.job_type}`);
      await db.updateJob(job.id, {
        status: 'FAILED',
        error_log: `No handler registered for job type: ${job.job_type}`,
      });
      return;
    }

    try {
      const result = await handler(job);
      if (result && (result.status === 'generating' || result.status === 'queued' || result.status === 'processing')) {
        await db.updateJob(job.id, {
          status: result.status,
          result: result || {},
          locked_at: null, // Allow next polling iteration
        });
        console.log(`[JobQueue] Job ${job.id} (${job.job_type}) in state "${result.status}". Polling scheduled.`);
      } else {
        await db.updateJob(job.id, {
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          result: result || {},
        });
        console.log(`[JobQueue] Completed job ${job.id} (${job.job_type}) successfully.`);
      }
    } catch (err: any) {
      console.error(`[JobQueue] Failed job ${job.id} (${job.job_type}):`, err.message);
      const isTerminal = isTerminalError(err);
      const isExhausted = job.attempts >= job.max_attempts;
      const willFail = isTerminal || isExhausted;

      await db.updateJob(job.id, {
        status: willFail ? 'FAILED' : 'PENDING',
        error: err.message,
        error_log: err.stack || err.message,
        locked_at: null,
      });

      if (willFail) {
        if (job.job_type === 'SHOT_IMAGE' || job.job_type === 'SHOT_VIDEO') {
          try {
            await db.updateShot(job.target_entity_id, {
              status: 'FAILED',
              error_message: err.message,
            });
          } catch (shotErr: any) {
            console.warn(`[JobQueue] Could not update shot ${job.target_entity_id} to FAILED:`, shotErr.message);
          }
        }

        if (job.project_id) {
          try {
            const { updateProjectOverallProgress } = await import('./workers.js');
            await updateProjectOverallProgress(job.project_id);
          } catch (pErr: any) {
            console.error('[JobQueue] Error updating project progress:', pErr.message);
          }
        }
      }
    }
  }
}

function isTerminalError(err: any): boolean {
  if (!err) return false;
  const status = Number(err.status || err.statusCode || err.code);
  if (status === 429 || status === 400 || status === 401 || status === 403 || status === 404) {
    return true;
  }
  const msg = (err.message || String(err)).toLowerCase();
  if (
    msg.includes('resource_exhausted') ||
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('unauthenticated') ||
    msg.includes('permission_denied') ||
    msg.includes('api_key') ||
    msg.includes('api key') ||
    msg.includes('not configured') ||
    msg.includes('invalid_argument') ||
    msg.includes('invalid argument') ||
    msg.includes('safety') ||
    msg.includes('blocked') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('deadline_exceeded') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound')
  ) {
    return true;
  }
  return false;
}

export const globalJobQueue = new JobQueue();
