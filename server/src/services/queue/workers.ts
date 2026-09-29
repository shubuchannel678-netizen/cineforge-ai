import path from 'path';
import { globalJobQueue } from './jobQueue.js';
import { db } from '../../lib/db.js';
import { planStoryAndScenes } from '../ai/storyPlanner.js';
import { extractBibles } from '../ai/bibleExtractor.js';
import { decomposeSceneIntoShots, normalizeToVeoDuration } from '../ai/shotDecomposer.js';
import { generateShotImage, generateStandaloneImage } from '../media/imageService.js';

import { generateShotVideoClip } from '../media/videoService.js';
import { synthesizeVoiceover } from '../media/ttsService.js';
import { generateBackgroundMusicTrack } from '../media/audioMixerService.js';
import { storageService } from '../media/storageService.js';
import { getVideoProvider } from '../../providers/video/index.js';
import { getImageProvider } from '../../providers/image/index.js';
import type { VideoGenerationStatus } from '../../providers/video/types.js';
import { executeFfmpegMasterRender } from '../render/ffmpegPipeline.js';
import type { GenerationJob, Shot } from '../../shared/types/index.js';

export function initializeQueueWorkers() {
  // 1. STORY_ANALYSIS
  globalJobQueue.registerHandler('STORY_ANALYSIS', async (job: GenerationJob) => {
    const project = await db.getProject(job.project_id);
    if (!project) throw new Error(`Project ${job.project_id} not found`);

    await db.updateProject(project.id, {
      status: 'PLANNING',
      progress_percentage: 10,
    });

    // Generate story & scenes
    const plan = await planStoryAndScenes({
      prompt: project.initial_prompt,
      targetDurationSeconds: project.target_duration_seconds,
      visualStyle: project.visual_style,
      pacing: project.pacing,
      userScript: project.raw_script || undefined,
    });

    // Extract Character & Style Bibles
    const bibles = await extractBibles(plan, project.visual_style);

    // Save Bibles to DB
    for (const char of bibles.characters) {
      await db.createCharacterBible({
        project_id: project.id,
        name: char.name,
        description: char.description,
        visual_attributes: char.visualAttributes,
      });
    }

    await db.upsertStyleBible({
      project_id: project.id,
      style_name: bibles.style.styleName,
      lighting: bibles.style.lighting,
      camera_gear: bibles.style.cameraGear,
      color_palette: bibles.style.colorPalette,
      environment_rules: bibles.style.environmentRules,
      negative_prompt: bibles.style.negativePrompt,
    });

    // Flatten and save scenes
    let sceneCounter = 1;
    for (const act of plan.acts) {
      for (const sc of act.scenes) {
        const createdScene = await db.createScene({
          project_id: project.id,
          scene_order: sceneCounter++,
          title: sc.title,
          narrative_goal: sc.narrativeGoal,
          environment: sc.environment,
          mood: sc.mood,
          target_duration_seconds: sc.targetDurationSeconds,
          status: 'PENDING',
          narration_script: sc.narrationScript,
        });

        // Enqueue SCENE_EXPANSION for each scene
        await globalJobQueue.enqueue(project.id, 'SCENE_EXPANSION', createdScene.id, {
          sceneId: createdScene.id,
        });
      }
    }

    await db.updateProject(project.id, {
      progress_percentage: 25,
      status: 'GENERATING',
    });

    return { planTitle: plan.title, sceneCount: sceneCounter - 1 };
  });

  // 2. SCENE_EXPANSION
  globalJobQueue.registerHandler('SCENE_EXPANSION', async (job: GenerationJob) => {
    const sceneId = job.target_entity_id;
    const project = await db.getProject(job.project_id);
    if (!project) throw new Error(`Project ${job.project_id} not found`);

    const scenes = await db.getScenes(project.id);
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) throw new Error(`Scene ${sceneId} not found`);

    const charBibles = await db.getCharacterBibles(project.id);
    const styleBible = await db.getStyleBible(project.id);

    // Decompose scene into shots
    const decomposed = await decomposeSceneIntoShots({
      scene,
      characterBibles: charBibles,
      styleBible: styleBible || {},
    });

    // Save shots and enqueue shot image & video jobs
    for (const s of decomposed.shots) {
      const createdShot = await db.createShot({
        scene_id: scene.id,
        project_id: project.id,
        shot_order: s.shotOrder,
        visual_prompt: s.visualPrompt,
        motion_instruction: s.motionInstruction,
        duration_seconds: s.durationSeconds,
        status: 'PENDING',
        retry_count: 0,
      });

      // Enqueue visual generation for this shot
      await globalJobQueue.enqueue(project.id, 'SHOT_IMAGE', createdShot.id, {
        shotId: createdShot.id,
        visualPrompt: s.visualPrompt,
        aspectRatio: project.aspect_ratio,
      });
    }

    // Enqueue VOICE_TTS for scene narration
    if (scene.narration_script) {
      await globalJobQueue.enqueue(project.id, 'VOICE_TTS', scene.id, {
        sceneId: scene.id,
        text: scene.narration_script,
        targetDurationSeconds: scene.target_duration_seconds,
      });
    }

    await db.updateScene(scene.id, { status: 'COMPLETED' });

    return { shotCount: decomposed.shots.length };
  });

  // 3. SHOT_IMAGE
  globalJobQueue.registerHandler('SHOT_IMAGE', async (job: GenerationJob) => {
    const shotId = job.target_entity_id;
    const shot = await db.getShot(shotId);
    if (!shot) throw new Error(`Shot ${shotId} not found`);

    const project = await db.getProject(job.project_id);
    const aspectRatio = project?.aspect_ratio || '16:9';

    await db.updateShot(shotId, { status: 'PROCESSING', error_message: null });

    try {
      // Generate visual keyframe image
      const assetUrl = await generateShotImage({
        shotId: shot.id,
        projectId: job.project_id,
        visualPrompt: job.payload.visualPrompt || shot.visual_prompt,
        aspectRatio,
      });

      await db.updateShot(shotId, {
        visual_asset_url: assetUrl,
      });

      // Enqueue SHOT_VIDEO to render actual motion video clip
      await globalJobQueue.enqueue(job.project_id, 'SHOT_VIDEO', shotId, {
        shotId,
        sourceAssetUrl: assetUrl,
        durationSeconds: shot.duration_seconds,
        motionInstruction: shot.motion_instruction,
        aspectRatio,
      });

      return { assetUrl };
    } catch (err: any) {
      const errorMsg = err.message || 'Keyframe image generation failed';
      console.error(`[JobQueue Worker] Failed to generate image for shot ${shotId}:`, errorMsg);
      await db.updateShot(shotId, {
        status: 'FAILED',
        error_message: errorMsg,
      });
      await db.updateJob(job.id, {
        status: 'FAILED',
        error: errorMsg,
        error_log: err.stack || errorMsg,
      });
      await updateProjectOverallProgress(job.project_id);
      throw err;
    }
  });

  // 3b. IMAGE_GEN (Real AI Image Generation Worker)
  globalJobQueue.registerHandler('IMAGE_GEN', async (job: GenerationJob) => {
    const { prompt, negativePrompt, aspectRatio, projectId, shotId } = job.payload;
    const provider = getImageProvider();

    if (!provider.isConfigured()) {
      const cfgErr = 'Real AI image generation is not configured. Add the required provider credentials.';
      await db.updateJob(job.id, {
        status: 'failed',
        error: cfgErr,
        error_log: cfgErr,
      });
      throw new Error(cfgErr);
    }

    await db.updateJob(job.id, {
      status: 'generating',
      progress: 30,
      provider: provider.name,
      started_at: new Date().toISOString(),
    });

    const result = await generateStandaloneImage({
      prompt,
      negativePrompt,
      aspectRatio,
      projectId: projectId || job.project_id || 'standalone',
      imageId: job.target_entity_id,
    });

    await db.updateJob(job.id, {
      status: 'uploading',
      progress: 85,
    });

    if (shotId) {
      try {
        await db.updateShot(shotId, {
          visual_asset_url: result.assetUrl,
        });
      } catch (e: any) {
        console.warn(`[IMAGE_GEN Worker] Could not update shot ${shotId}: ${e.message}`);
      }
    }

    return {
      status: 'completed',
      assetUrl: result.assetUrl,
      storagePath: result.storagePath,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
      uploadedToSupabase: result.uploadedToSupabase,
    };
  });

  // 4. SHOT_VIDEO
  globalJobQueue.registerHandler('SHOT_VIDEO', async (job: GenerationJob) => {
    const shotId = job.target_entity_id;
    const shot = await db.getShot(shotId);
    if (!shot) throw new Error(`Shot ${shotId} not found`);

    const project = await db.getProject(job.project_id);
    if (!project) throw new Error(`Project ${job.project_id} not found`);

    const provider = getVideoProvider();

    // 1. Strict Configuration Verification — NO SIMULATION FALLBACK
    if (!provider.isConfigured()) {
      const cfgErr = 'Real AI video generation is not configured. Add the required provider credentials.';
      await db.updateShot(shotId, {
        status: 'FAILED',
        error_message: cfgErr,
      });
      await db.updateJob(job.id, {
        status: 'failed',
        error: cfgErr,
        error_log: cfgErr,
      });
      throw new Error(cfgErr);
    }

    const visualPrompt = job.payload.visualPrompt || shot.visual_prompt;
    const aspectRatio = project.aspect_ratio || '16:9';
    const durationSeconds = normalizeToVeoDuration(shot.duration_seconds);
    const referenceImageUrl = job.payload.sourceAssetUrl || shot.visual_asset_url || undefined;


    // 2. Dispatch if not yet started
    const operationId = job.provider_operation_id || job.payload?.operationId;
    if (!operationId) {
      await db.updateJob(job.id, {
        status: 'generating',
        provider: provider.name,
        started_at: new Date().toISOString(),
      });
      await db.updateShot(shotId, {
        status: 'generating',
        error_message: null,
      });

      console.log(`[JobQueue Worker] Dispatching shot ${shot.id} to ${provider.name} (prompt: "${visualPrompt.slice(0, 60)}...")`);

      try {
        const { operationId: newOpId } = await provider.generateVideo({
          shotId: shot.id,
          projectId: project.id,
          prompt: visualPrompt,
          aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9',
          durationSeconds,
          referenceImageUrl,
        });

        await db.updateJob(job.id, {
          provider_operation_id: newOpId,
          payload: { ...job.payload, operationId: newOpId },
          status: 'generating',
        });

        return { operationId: newOpId, status: 'generating' };
      } catch (dispatchErr: any) {
        let cleanErr = dispatchErr.message || 'Veo video generation dispatch failed';
        try {
          const parsed = typeof cleanErr === 'string' ? JSON.parse(cleanErr) : cleanErr;
          if (parsed?.error?.message) cleanErr = parsed.error.message;
        } catch {}

        console.error(`[JobQueue Worker] Failed to dispatch shot ${shot.id} to ${provider.name}:`, cleanErr);
        await db.updateShot(shotId, {
          status: 'FAILED',
          error_message: cleanErr,
        });
        await db.updateJob(job.id, {
          status: 'FAILED',
          error: cleanErr,
          error_log: cleanErr,
        });
        await updateProjectOverallProgress(job.project_id);
        throw new Error(cleanErr);
      }
    }

    // 3. Poll existing operation
    console.log(`[JobQueue Worker] Polling operation "${operationId}" for shot ${shot.id}`);
    let status: VideoGenerationStatus;
    try {
      status = await provider.getGenerationStatus(operationId);
    } catch (pollErr: any) {
      let cleanErr = pollErr.message || 'Veo status polling failed';
      await db.updateShot(shotId, {
        status: 'FAILED',
        error_message: cleanErr,
      });
      await db.updateJob(job.id, {
        status: 'FAILED',
        error: cleanErr,
        error_log: cleanErr,
      });
      await updateProjectOverallProgress(job.project_id);
      throw new Error(cleanErr);
    }

    if (!status.done) {
      await db.updateJob(job.id, {
        status: 'generating',
        progress: status.progress || 35,
      });
      return { operationId, status: 'generating' };
    }

    if (status.status === 'failed') {
      const errorMsg = status.error || 'Veo video generation failed';
      await db.updateShot(shotId, {
        status: 'FAILED',
        error_message: errorMsg,
      });
      await db.updateJob(job.id, {
        status: 'FAILED',
        error: errorMsg,
        error_log: errorMsg,
      });
      await updateProjectOverallProgress(job.project_id);
      throw new Error(errorMsg);
    }

    try {
      // 4. Download video clip locally
      await db.updateJob(job.id, { status: 'downloading', progress: 70 });
      const localFilename = `shot_${shot.id}.mp4`;
      const localPath = path.resolve(process.cwd(), 'public', 'assets', localFilename);
      await provider.downloadGeneratedVideo(status, localPath);

      // 5. Upload to Supabase Storage
      await db.updateJob(job.id, { status: 'uploading', progress: 90 });
      const uploadResult = await storageService.uploadShotVideo(project.id, shot.id, localPath);

      // 6. Complete Shot and Job
      await db.updateShot(shotId, {
        visual_asset_url: uploadResult.publicUrl,
        status: 'COMPLETED',
        error_message: null,
      });

      await db.updateJob(job.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        progress: 100,
        result: {
          videoUrl: uploadResult.publicUrl,
          storagePath: uploadResult.storagePath,
        },
      });

      // 7. Update progress & auto-trigger master render when all shots ready
      await updateProjectOverallProgress(job.project_id);
      await checkAndTriggerFinalRender(job.project_id);

      return { videoUrl: uploadResult.publicUrl, storagePath: uploadResult.storagePath, status: 'completed' };
    } catch (ioErr: any) {
      const errorMsg = ioErr.message || 'Failed to download or persist video asset';
      await db.updateShot(shotId, {
        status: 'FAILED',
        error_message: errorMsg,
      });
      await db.updateJob(job.id, {
        status: 'FAILED',
        error: errorMsg,
        error_log: errorMsg,
      });
      await updateProjectOverallProgress(job.project_id);
      throw ioErr;
    }
  });

  // 5. VOICE_TTS
  globalJobQueue.registerHandler('VOICE_TTS', async (job: GenerationJob) => {
    const sceneId = job.target_entity_id;
    const project = await db.getProject(job.project_id);
    if (!project) throw new Error(`Project ${job.project_id} not found`);

    const ttsResult = await synthesizeVoiceover({
      sceneId,
      projectId: project.id,
      text: job.payload.text || 'Narration placeholder',
      targetDurationSeconds: job.payload.targetDurationSeconds || 15,
    });

    // Store audio track
    await db.createAudioTrack({
      project_id: project.id,
      scene_id: sceneId,
      track_type: 'VOICEOVER',
      file_url: ttsResult.audioUrl,
      start_time_seconds: 0,
      duration_seconds: ttsResult.durationSeconds,
      volume_level: 1.0,
      ducking_enabled: true,
      metadata: { cues: ttsResult.cues },
    });

    // Upsert subtitle track
    await db.upsertSubtitleTrack({
      project_id: project.id,
      srt_content: ttsResult.srtContent,
      vtt_content: ttsResult.vttContent,
      json_cues: ttsResult.cues,
    });

    return { audioUrl: ttsResult.audioUrl, cueCount: ttsResult.cues.length };
  });

  // 6. AUDIO_SFX_MUSIC
  globalJobQueue.registerHandler('AUDIO_SFX_MUSIC', async (job: GenerationJob) => {
    const project = await db.getProject(job.project_id);
    if (!project) throw new Error(`Project ${job.project_id} not found`);

    const musicUrl = await generateBackgroundMusicTrack({
      projectId: project.id,
      durationSeconds: project.target_duration_seconds,
      mood: project.visual_style,
    });

    await db.createAudioTrack({
      project_id: project.id,
      track_type: 'MUSIC',
      file_url: musicUrl,
      start_time_seconds: 0,
      duration_seconds: project.target_duration_seconds,
      volume_level: 0.6,
      ducking_enabled: false,
    });

    return { musicUrl };
  });

  // 7. FINAL_RENDER
  globalJobQueue.registerHandler('FINAL_RENDER', async (job: GenerationJob) => {
    const project = await db.getProject(job.project_id);
    if (!project) throw new Error(`Project ${job.project_id} not found`);

    await db.updateProject(project.id, {
      status: 'GENERATING',
      progress_percentage: 85,
    });

    const result = await executeFfmpegMasterRender(project.id);
    return result;
  });
}

export async function updateProjectOverallProgress(projectId: string) {
  const shots = await db.getShots(projectId);
  const project = await db.getProject(projectId);
  if (!project) return;

  const jobs = await db.listJobs(projectId);
  const activeJobs = jobs.filter(j => 
    j.status === 'PENDING' || 
    j.status === 'queued' || 
    j.status === 'PROCESSING' || 
    j.status === 'generating' || 
    j.status === 'downloading' || 
    j.status === 'uploading' ||
    j.status === 'planning'
  );

  // Auto-sync any stale shots whose jobs permanently failed and have no active running jobs
  for (const shot of shots) {
    if (shot.status !== 'COMPLETED' && shot.status !== 'completed' && shot.status !== 'FAILED' && shot.status !== 'failed') {
      const activeJobForShot = activeJobs.find(j => j.target_entity_id === shot.id);
      if (!activeJobForShot) {
        const failedJobForShot = jobs.find(j => 
          j.target_entity_id === shot.id && 
          (j.status === 'FAILED' || j.status === 'failed')
        );
        if (failedJobForShot) {
          let errText = failedJobForShot.error || 'Job failed during media synthesis';
          try {
            const parsed = JSON.parse(errText);
            if (parsed?.error?.message) errText = parsed.error.message;
          } catch {}
          await db.updateShot(shot.id, {
            status: 'FAILED',
            error_message: errText,
          });
          shot.status = 'FAILED';
          shot.error_message = errText;
        }
      }
    }
  }

  const completedShots = shots.filter(s => s.status === 'COMPLETED' || s.status === 'completed');
  const failedShots = shots.filter(s => s.status === 'FAILED' || s.status === 'failed');
  const failedJobs = jobs.filter(j => j.status === 'FAILED' || j.status === 'failed');

  let newStatus = project.status;

  if (shots.length > 0 && completedShots.length === shots.length) {
    const masterJob = jobs.find(j => j.job_type === 'FINAL_RENDER');
    if (!masterJob || masterJob.status === 'COMPLETED' || masterJob.status === 'completed') {
      newStatus = 'COMPLETED';
    } else if (masterJob.status === 'FAILED' || masterJob.status === 'failed') {
      newStatus = 'FAILED';
    } else {
      newStatus = 'GENERATING';
    }
  } else if (activeJobs.length > 0) {
    newStatus = project.scenes && project.scenes.length > 0 ? 'GENERATING' : 'PLANNING';
  } else if (failedShots.length > 0 || failedJobs.length > 0) {
    // Generation cannot continue because of failed shots and no active jobs
    newStatus = 'FAILED';
  }

  // Progress scaled from 25% (planning complete) to 80% (all shots ready)
  let progressPct = project.progress_percentage || 10;
  if (shots.length > 0) {
    const shotRatio = completedShots.length / shots.length;
    progressPct = Math.round(25 + shotRatio * 55);
    if (newStatus === 'COMPLETED') {
      progressPct = 100;
    }
  }

  let errorMsg = project.error_message || null;
  if (newStatus === 'FAILED') {
    const firstFailedShot = failedShots.find(s => s.error_message);
    const firstFailedJob = failedJobs.find(j => j.error);
    errorMsg = firstFailedShot?.error_message || firstFailedJob?.error || 'One or more generation jobs failed.';
    try {
      const parsed = JSON.parse(errorMsg);
      if (parsed?.error?.message) errorMsg = parsed.error.message;
    } catch {}
  } else if (newStatus === 'COMPLETED') {
    errorMsg = null;
  }

  await db.updateProject(projectId, {
    status: newStatus,
    progress_percentage: progressPct,
    error_message: errorMsg,
  });
}

async function checkAndTriggerFinalRender(projectId: string) {
  const shots = await db.getShots(projectId);
  if (shots.length === 0) return;

  const allCompleted = shots.every(s => s.status === 'COMPLETED');
  if (!allCompleted) return;

  const project = await db.getProject(projectId);
  if (!project || project.status === 'COMPLETED') return;

  const jobs = await db.listJobs(projectId);
  const alreadyRendering = jobs.some(j => j.job_type === 'FINAL_RENDER' && (j.status === 'PENDING' || j.status === 'PROCESSING' || j.status === 'COMPLETED'));

  if (!alreadyRendering) {
    console.log(`[JobQueue Worker] All ${shots.length} shots completed for project "${project.title}". Auto-enqueuing FINAL_RENDER master assembly.`);
    await globalJobQueue.enqueue(projectId, 'FINAL_RENDER', projectId);
  }
}
