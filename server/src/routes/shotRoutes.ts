import { Router } from 'express';
import { db } from '../lib/db.js';
import { globalJobQueue } from '../services/queue/jobQueue.js';
import { RetryShotSchema, UpdateShotSchema } from '../shared/validators/projectSchemas.js';

export const shotRouter = Router({ mergeParams: true });

// POST /api/v1/projects/:id/shots/:shotId/retry - Granular shot retry without restarting project
shotRouter.post('/:shotId/retry', async (req, res, next) => {
  try {
    const projectId = (req.params as any).id;
    const shotId = (req.params as any).shotId;
    
    // Optional custom prompt or motion from body
    const bodyValidation = RetryShotSchema.safeParse({ shotId, ...req.body });
    const customPrompt = bodyValidation.success ? bodyValidation.data.customVisualPrompt : undefined;
    const motionInstruction = bodyValidation.success ? bodyValidation.data.motionInstruction : undefined;

    const shot = await db.getShot(shotId);
    if (!shot) {
      return res.status(404).json({ error: `Shot ${shotId} not found` });
    }

    // Prevent overwriting completed shots without custom prompt changes
    if (shot.status === 'COMPLETED' && !customPrompt && !motionInstruction) {
      return res.json({
        message: `Shot ${shotId} is already COMPLETED. Existing video URL was preserved.`,
        shot,
      });
    }

    // Reset status to PENDING, increment retry_count
    const updatedShot = await db.updateShot(shotId, {
      status: 'PENDING',
      error_message: null,
      retry_count: (shot.retry_count || 0) + 1,
      visual_prompt: customPrompt || shot.visual_prompt,
      motion_instruction: motionInstruction || shot.motion_instruction,
    });

    // If keyframe image already exists and prompt was not changed, retry SHOT_VIDEO directly
    const hasValidKeyframe = shot.visual_asset_url && !shot.visual_asset_url.endsWith('.mp4');
    let job;
    if (hasValidKeyframe && !customPrompt) {
      job = await globalJobQueue.enqueue(projectId, 'SHOT_VIDEO', shotId, {
        shotId,
        sourceAssetUrl: shot.visual_asset_url,
        durationSeconds: updatedShot.duration_seconds,
        motionInstruction: updatedShot.motion_instruction,
        aspectRatio: '16:9',
        retry: true,
      });
    } else {
      job = await globalJobQueue.enqueue(projectId, 'SHOT_IMAGE', shotId, {
        shotId,
        visualPrompt: updatedShot.visual_prompt,
        retry: true,
      });
    }


    // Update project status to GENERATING and clear project error
    try {
      await db.updateProject(projectId, {
        status: 'GENERATING',
        error_message: null,
      });
    } catch (pErr: any) {
      console.warn(`[Granular Retry] Could not update project ${projectId} to GENERATING:`, pErr.message);
    }

    console.log(`[Granular Retry] Retrying shot ${shotId} (Attempt #${updatedShot.retry_count}). Job ${job.id} enqueued.`);

    res.json({
      message: `Shot ${shotId} re-enqueued for regeneration`,
      shot: updatedShot,
      jobId: job.id,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/projects/:id/shots/:shotId - Update shot parameters before regeneration
shotRouter.put('/:shotId', async (req, res, next) => {
  try {
    const shotId = req.params.shotId;
    const validated = UpdateShotSchema.parse(req.body);

    const shot = await db.getShot(shotId);
    if (!shot) {
      return res.status(404).json({ error: `Shot ${shotId} not found` });
    }

    const updated = await db.updateShot(shotId, {
      visual_prompt: validated.visualPrompt,
      motion_instruction: validated.motionInstruction || shot.motion_instruction,
      duration_seconds: validated.durationSeconds || shot.duration_seconds,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});
