import { Router } from 'express';
import { db } from '../lib/db.js';
import { globalJobQueue } from '../services/queue/jobQueue.js';
import type { ExportResponse } from '../shared/types/index.js';

export const renderRouter = Router({ mergeParams: true });

// POST /api/v1/projects/:id/render - Enqueue final master assembly
renderRouter.post('/render', async (req, res, next) => {
  try {
    const projectId = (req.params as any).id;
    const project = await db.getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Verify project has shots
    const shots = await db.getShots(projectId);
    if (shots.length === 0) {
      return res.status(400).json({ error: 'Cannot render: No shots found for this project.' });
    }

    const job = await globalJobQueue.enqueue(projectId, 'FINAL_RENDER', projectId);

    res.status(202).json({
      message: 'Master FFmpeg rendering pipeline initiated',
      jobId: job.id,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/projects/:id/export - Export assets and master video info
renderRouter.get('/export', async (req, res, next) => {
  try {
    const projectId = (req.params as any).id;
    const project = await db.getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const subtitleTrack = await db.getSubtitleTrack(projectId);

    const exportData: ExportResponse = {
      downloadUrl: project.final_video_url || null,
      srtUrl: subtitleTrack ? `/api/v1/projects/${projectId}/subtitles.srt` : null,
      vttUrl: subtitleTrack ? `/api/v1/projects/${projectId}/subtitles.vtt` : null,
      duration: Number(project.actual_duration_seconds) || project.target_duration_seconds,
      resolution: project.aspect_ratio === '9:16' ? '1080x1920 (Vertical Reel)' : (project.aspect_ratio === '1:1' ? '1080x1080 (Square)' : '1920x1080 (Full HD 16:9)'),
      status: project.status,
    };

    res.json(exportData);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/projects/:id/subtitles.srt - Direct subtitle download
renderRouter.get('/subtitles.srt', async (req, res, next) => {
  try {
    const projectId = (req.params as any).id;
    const subtitleTrack = await db.getSubtitleTrack(projectId);
    if (!subtitleTrack || !subtitleTrack.srt_content) {
      return res.status(404).send('Subtitles not found');
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cineforge_${projectId}.srt"`);
    res.send(subtitleTrack.srt_content);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/projects/:id/subtitles.vtt - Direct WebVTT download
renderRouter.get('/subtitles.vtt', async (req, res, next) => {
  try {
    const projectId = (req.params as any).id;
    const subtitleTrack = await db.getSubtitleTrack(projectId);
    if (!subtitleTrack || !subtitleTrack.vtt_content) {
      return res.status(404).send('WebVTT track not found');
    }

    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cineforge_${projectId}.vtt"`);
    res.send(subtitleTrack.vtt_content);
  } catch (err) {
    next(err);
  }
});
