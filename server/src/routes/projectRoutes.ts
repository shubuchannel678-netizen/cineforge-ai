import { Router } from 'express';
import { db } from '../lib/db.js';
import { globalJobQueue } from '../services/queue/jobQueue.js';
import { CreateProjectSchema } from '../shared/validators/projectSchemas.js';
import { generationLimiter } from '../middleware/rateLimiter.js';
import { planStoryAndScenes } from '../services/ai/storyPlanner.js';
import type { ProjectProgressResponse } from '../shared/types/index.js';

export const projectRouter = Router();

// POST /api/v1/projects - Create project and enqueue STORY_ANALYSIS
projectRouter.post('/', generationLimiter, async (req, res, next) => {
  try {
    const validated = CreateProjectSchema.parse(req.body);
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';

    const project = await db.createProject({
      user_id: userId,
      title: validated.title,
      description: validated.description || null,
      initial_prompt: validated.initialPrompt,
      raw_script: validated.rawScript || null,
      target_duration_seconds: validated.targetDurationSeconds,
      actual_duration_seconds: 0,
      aspect_ratio: validated.aspectRatio,
      visual_style: validated.visualStyle,
      pacing: validated.pacing,
      status: 'PLANNING',
      progress_percentage: 5,
    });

    // Enqueue STORY_ANALYSIS job
    await globalJobQueue.enqueue(project.id, 'STORY_ANALYSIS', project.id, {
      prompt: project.initial_prompt,
      targetDurationSeconds: project.target_duration_seconds,
    });

    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/projects - List user's projects
projectRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    const projects = await db.listProjects(userId);
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/projects/:id - Get full project details
projectRouter.get('/:id', async (req, res, next) => {
  try {
    const project = await db.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/projects/:id - Delete project
projectRouter.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await db.deleteProject(req.params.id);
    res.json({ success: deleted });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/projects/:id/plan - Re-plan scene breakdown
projectRouter.post('/:id/plan', async (req, res, next) => {
  try {
    const project = await db.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const plan = await planStoryAndScenes({
      prompt: project.initial_prompt,
      targetDurationSeconds: project.target_duration_seconds,
      visualStyle: project.visual_style,
      pacing: project.pacing,
      userScript: project.raw_script || undefined,
    });

    res.json(plan);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/projects/:id/generate - Kick off full autonomous production
projectRouter.post('/:id/generate', generationLimiter, async (req, res, next) => {
  try {
    const project = await db.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // If no scenes yet, start with STORY_ANALYSIS
    if (!project.scenes || project.scenes.length === 0) {
      const job = await globalJobQueue.enqueue(project.id, 'STORY_ANALYSIS', project.id);
      return res.status(202).json({
        message: 'Story analysis and autonomous production launched',
        jobId: job.id,
      });
    }

    // If scenes exist, enqueue scene expansions and music
    await db.updateProject(project.id, { status: 'GENERATING' });
    await globalJobQueue.enqueue(project.id, 'AUDIO_SFX_MUSIC', project.id);

    const jobs = [];
    for (const scene of project.scenes) {
      const j = await globalJobQueue.enqueue(project.id, 'SCENE_EXPANSION', scene.id);
      jobs.push(j);
    }

    res.status(202).json({
      message: 'Autonomous production pipeline running across all scenes',
      activeJobs: jobs.length,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/projects/:id/progress - Telemetry and status
projectRouter.get('/:id/progress', async (req, res, next) => {
  try {
    const projectId = req.params.id;
    
    // Sync current project overall status based on shots and jobs
    try {
      const { updateProjectOverallProgress } = await import('../services/queue/workers.js');
      await updateProjectOverallProgress(projectId);
    } catch {}

    const project = await db.getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const jobs = await db.listJobs(project.id);
    const activeJobs = jobs.filter(j => 
      j.status === 'PROCESSING' || 
      j.status === 'PENDING' ||
      j.status === 'queued' ||
      j.status === 'generating' ||
      j.status === 'downloading' ||
      j.status === 'uploading' ||
      j.status === 'planning'
    ).length;

    const failedJobs = jobs.filter(j => j.status === 'FAILED' || j.status === 'failed').length;

    const allShots = (project.scenes || []).flatMap(s => s.shots || []);
    const failedShots = allShots.filter(s => s.status === 'FAILED' || s.status === 'failed');
    const firstFailedShot = failedShots.find(s => s.error_message);
    const firstFailedJob = jobs.find(j => (j.status === 'FAILED' || j.status === 'failed') && j.error);
    const errorMessage = project.error_message || firstFailedShot?.error_message || firstFailedJob?.error || null;

    const progressResponse: ProjectProgressResponse = {
      status: project.status,
      progressPercentage: project.progress_percentage,
      activeJobsCount: activeJobs,
      failedJobsCount: failedJobs,
      errorMessage,
      scenes: (project.scenes || []).map(s => ({
        id: s.id,
        sceneOrder: s.scene_order,
        title: s.title,
        status: s.status,
        shotsCount: s.shots?.length || 0,
        completedShotsCount: s.shots?.filter(shot => shot.status === 'COMPLETED' || shot.status === 'completed').length || 0,
        shots: (s.shots || []).map(shot => ({
          id: shot.id,
          shotOrder: shot.shot_order,
          status: shot.status,
          visualAssetUrl: shot.visual_asset_url,
          errorMessage: shot.error_message,
          retryCount: shot.retry_count,
        })),
      })),
    };

    res.json(progressResponse);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/projects/:id/retry-failed - Retry all failed shots in project
projectRouter.post('/:id/retry-failed', async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const project = await db.getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const shots = await db.getShots(projectId);
    const failedShots = shots.filter(s => s.status === 'FAILED' || s.status === 'failed');

    if (failedShots.length === 0) {
      return res.json({ message: 'No failed shots found to retry', retriedCount: 0 });
    }

    // Reset failed shots and enqueue generation
    for (const shot of failedShots) {
      await db.updateShot(shot.id, {
        status: 'PENDING',
        error_message: null,
        retry_count: (shot.retry_count || 0) + 1,
      });

      // If shot already has an image keyframe, enqueue SHOT_VIDEO directly, otherwise SHOT_IMAGE
      if (shot.visual_asset_url && !shot.visual_asset_url.endsWith('.mp4')) {
        await globalJobQueue.enqueue(projectId, 'SHOT_VIDEO', shot.id, {
          shotId: shot.id,
          sourceAssetUrl: shot.visual_asset_url,
          durationSeconds: shot.duration_seconds,
          motionInstruction: shot.motion_instruction,
          aspectRatio: project.aspect_ratio || '16:9',
          retry: true,
        });
      } else {
        await globalJobQueue.enqueue(projectId, 'SHOT_IMAGE', shot.id, {
          shotId: shot.id,
          visualPrompt: shot.visual_prompt,
          aspectRatio: project.aspect_ratio || '16:9',
          retry: true,
        });
      }
    }

    // Set project status back to GENERATING and clear project error
    await db.updateProject(projectId, {
      status: 'GENERATING',
      error_message: null,
    });

    console.log(`[Project] Enqueued retry for ${failedShots.length} failed shots in project ${projectId}`);

    res.json({
      message: `Retrying ${failedShots.length} failed shots`,
      retriedCount: failedShots.length,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/projects/:id/jobs - Job queue telemetry
projectRouter.get('/:id/jobs', async (req, res, next) => {
  try {
    const jobs = await db.listJobs(req.params.id);
    res.json(jobs);
  } catch (err) {
    next(err);
  }
});
