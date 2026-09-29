import { Router } from 'express';
import { z } from 'zod';
import { globalJobQueue } from '../services/queue/jobQueue.js';
import { getImageProvider } from '../providers/image/index.js';
import { generationLimiter } from '../middleware/rateLimiter.js';

export const imageRouter = Router();

const GenerateImageSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required and cannot be empty').max(2000, 'Prompt too long'),
  negativePrompt: z.string().max(1000).optional(),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).default('16:9'),
  projectId: z.string().optional(),
  shotId: z.string().optional(),
});

// GET /api/v1/images/config - Provider status check (without exposing credentials)
imageRouter.get('/config', (req, res) => {
  const provider = getImageProvider();
  res.json({
    configured: provider.isConfigured(),
    model: provider.getModel(),
    provider: provider.name,
  });
});

// POST /api/v1/images/generate - Start asynchronous image generation job
imageRouter.post('/generate', generationLimiter, async (req, res, next) => {
  try {
    const validated = GenerateImageSchema.parse(req.body);
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    const provider = getImageProvider();

    if (!provider.isConfigured()) {
      return res.status(503).json({
        error: 'Real AI image generation is not configured. Add the required provider credentials.',
        configured: false,
      });
    }

    const imageEntityId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const projectId = validated.projectId || 'standalone';

    // Enqueue generation job asynchronously
    const job = await globalJobQueue.enqueue(
      projectId,
      'IMAGE_GEN',
      imageEntityId,
      {
        prompt: validated.prompt,
        negativePrompt: validated.negativePrompt,
        aspectRatio: validated.aspectRatio,
        projectId,
        shotId: validated.shotId,
      },
      {
        userId,
        provider: provider.name,
      }
    );

    res.status(202).json({
      jobId: job.id,
      status: 'queued',
      message: 'Image generation job queued successfully',
      provider: provider.name,
      model: provider.getModel(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/images/jobs/:jobId - Poll image generation job status
imageRouter.get('/jobs/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await globalJobQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: `Image generation job "${jobId}" not found` });
    }

    // Map status and assets
    const isCompleted = job.status === 'COMPLETED' || job.status === 'completed';
    const isFailed = job.status === 'FAILED' || job.status === 'failed';

    res.json({
      jobId: job.id,
      status: job.status.toLowerCase(),
      progress: isCompleted ? 100 : (job.progress || (isFailed ? 0 : 30)),
      error: job.error || null,
      assetUrl: job.result?.assetUrl || null,
      storagePath: job.result?.storagePath || null,
      mimeType: job.result?.mimeType || null,
      sizeBytes: job.result?.sizeBytes || null,
      createdAt: job.created_at,
      startedAt: job.started_at,
      completedAt: job.completed_at,
    });
  } catch (err) {
    next(err);
  }
});
