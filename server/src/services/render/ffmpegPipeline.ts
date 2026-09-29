import fs from 'fs';
import path from 'path';
import { ffmpeg } from '../../lib/ffmpeg.js';
import { db } from '../../lib/db.js';
import { generateShotVideoClip } from '../media/videoService.js';
import { generateBackgroundMusicTrack } from '../media/audioMixerService.js';
import { storageService } from '../media/storageService.js';
import type { Project, Shot } from '../../shared/types/index.js';

const ASSETS_DIR = path.resolve(process.cwd(), 'public', 'assets');
const TEMP_BASE_DIR = path.resolve(process.cwd(), 'temp');

if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
if (!fs.existsSync(TEMP_BASE_DIR)) fs.mkdirSync(TEMP_BASE_DIR, { recursive: true });

export interface RenderResult {
  outputVideoUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
}

export async function executeFfmpegMasterRender(projectId: string): Promise<RenderResult> {
  const project = await db.getProject(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const workDir = path.join(TEMP_BASE_DIR, projectId);
  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }

  console.log(`[FFmpeg Master Pipeline] Starting render for project "${project.title}" (${projectId})`);

  // 1. Gather all shots in order
  const scenes = project.scenes || [];
  const allShots: Shot[] = [];
  for (const scene of scenes) {
    if (scene.shots && scene.shots.length > 0) {
      allShots.push(...scene.shots);
    }
  }

  if (allShots.length === 0) {
    throw new Error('Project has no shots to render. Please generate storyboard and shots first.');
  }

  // Sort all shots by order
  allShots.sort((a, b) => a.shot_order - b.shot_order);

  // 2. Ensure every shot has a valid, rendered MP4 video clip
  const normalizedClips: string[] = [];
  const width = project.aspect_ratio === '9:16' ? 720 : (project.aspect_ratio === '1:1' ? 1080 : 1920);
  const height = project.aspect_ratio === '9:16' ? 1280 : (project.aspect_ratio === '1:1' ? 1080 : 1080);

  for (let idx = 0; idx < allShots.length; idx++) {
    const shot = allShots[idx];
    let clipUrl = shot.visual_asset_url;

    // Check if a local file already exists for this shot in public/assets
    const defaultLocalPath = path.resolve(ASSETS_DIR, `shot_${shot.id}.mp4`);
    let resolvedClipPath: string | null = null;

    if (fs.existsSync(defaultLocalPath) && fs.statSync(defaultLocalPath).size > 0) {
      resolvedClipPath = defaultLocalPath;
    } else if (clipUrl && !clipUrl.startsWith('http')) {
      const candidatePath = path.resolve(process.cwd(), 'public', clipUrl.replace(/^\//, ''));
      if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).size > 0) {
        resolvedClipPath = candidatePath;
      }
    } else if (clipUrl && clipUrl.startsWith('http')) {
      // Remote clip URL (e.g. Supabase Storage): download locally to workDir
      try {
        const destPath = path.join(workDir, `downloaded_shot_${shot.id}.mp4`);
        const res = await fetch(clipUrl);
        if (res.ok) {
          const ab = await res.arrayBuffer();
          fs.writeFileSync(destPath, Buffer.from(ab));
          if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
            resolvedClipPath = destPath;
          }
        }
      } catch (dlErr: any) {
        console.warn(`[FFmpeg Master Pipeline] Failed to download remote clip for shot ${shot.id}: ${dlErr.message}`);
      }
    }

    // If still no valid local clip file, attempt generation via real provider
    if (!resolvedClipPath) {
      if (shot.status !== 'COMPLETED' && (!clipUrl || !clipUrl.endsWith('.mp4'))) {
        clipUrl = await generateShotVideoClip({
          shotId: shot.id,
          projectId: project.id,
          sourceAssetUrl: clipUrl || undefined,
          durationSeconds: shot.duration_seconds,
          motionInstruction: shot.motion_instruction,
          aspectRatio: project.aspect_ratio,
        });

        await db.updateShot(shot.id, {
          visual_asset_url: clipUrl,
          status: 'COMPLETED',
        });
      }

      if (fs.existsSync(defaultLocalPath) && fs.statSync(defaultLocalPath).size > 0) {
        resolvedClipPath = defaultLocalPath;
      } else if (clipUrl && !clipUrl.startsWith('http')) {
        const candidate = path.resolve(process.cwd(), 'public', clipUrl.replace(/^\//, ''));
        if (fs.existsSync(candidate) && fs.statSync(candidate).size > 0) {
          resolvedClipPath = candidate;
        }
      }
    }

    if (!resolvedClipPath || !fs.existsSync(resolvedClipPath)) {
      throw new Error(`Shot #${shot.shot_order} (ID: ${shot.id}) is missing a valid video file on disk. Master assembly cannot proceed until all shots are generated.`);
    }

    normalizedClips.push(resolvedClipPath);
  }

  if (normalizedClips.length !== allShots.length) {
    throw new Error(`Master render expected ${allShots.length} valid shot clips, but found ${normalizedClips.length}.`);
  }

  // 3. Write concat demuxer text file
  const concatFilePath = path.join(workDir, 'concat_list.txt');
  // FFmpeg requires forward slashes or escaped backslashes in concat demuxer
  const concatLines = normalizedClips.map(clip => `file '${clip.replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(concatFilePath, concatLines, 'utf-8');


  // 4. Concatenate video clips into a single video track
  const rawVideoOutput = path.join(workDir, 'concat_video.mp4');
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(concatFilePath)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c copy'])
      .output(rawVideoOutput)
      .on('end', () => {
        console.log('[FFmpeg Master Pipeline] Video clips concatenated successfully.');
        resolve();
      })
      .on('error', (err) => {
        console.warn(`[FFmpeg Master Pipeline] Concat demuxer failed copy mode, trying re-encode: ${err.message}`);
        // Fallback re-encode
        ffmpeg()
          .input(concatFilePath)
          .inputOptions(['-f concat', '-safe 0'])
          .outputOptions([
            '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30`,
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart'
          ])
          .output(rawVideoOutput)
          .on('end', () => resolve())
          .on('error', reject)
          .run();
      })
      .run();
  });

  // 5. Build Master Audio (Voiceover + Ducked Background Music)
  const masterAudioOutput = path.join(workDir, 'master_audio.aac');
  const totalDuration = allShots.reduce((acc, s) => acc + Number(s.duration_seconds), 0);

  // Get or create background music
  const bgMusicUrl = await generateBackgroundMusicTrack({
    projectId: project.id,
    durationSeconds: totalDuration,
    mood: project.visual_style || 'Cinematic',
  });
  const bgMusicLocalPath = path.join(process.cwd(), 'public', bgMusicUrl.replace(/^\//, ''));

  // Get voiceover track if available
  const audioTracks = project.audio_tracks || [];
  const voiceTrack = audioTracks.find(t => t.track_type === 'VOICEOVER');
  let voiceLocalPath = voiceTrack ? path.join(process.cwd(), 'public', voiceTrack.file_url.replace(/^\//, '')) : null;

  if (voiceLocalPath && !fs.existsSync(voiceLocalPath)) {
    voiceLocalPath = null;
  }

  // Audio mix with ducking:
  // If voiceover exists, apply sidechain compression / amix filter with -14dB reduction
  if (voiceLocalPath && fs.existsSync(voiceLocalPath)) {
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(voiceLocalPath!)
        .input(bgMusicLocalPath)
        .complexFilter([
          // Duck music by -14dB (factor ~0.2) when mixed with voice
          '[1:a]volume=0.18[music_ducked]',
          '[0:a]volume=1.0[voice_boosted]',
          '[voice_boosted][music_ducked]amix=inputs=2:duration=first:dropout_transition=2[aout]'
        ])
        .outputOptions(['-map [aout]', '-c:a aac', '-b:a 192k'])
        .output(masterAudioOutput)
        .on('end', () => {
          console.log('[FFmpeg Master Pipeline] Audio mixed with -14dB music ducking.');
          resolve();
        })
        .on('error', (err) => {
          console.warn('[FFmpeg Master Pipeline] Ducking filter error, falling back to simple music track:', err.message);
          // Fallback to music track
          ffmpeg()
            .input(bgMusicLocalPath)
            .outputOptions(['-c:a aac', '-b:a 192k'])
            .output(masterAudioOutput)
            .on('end', () => resolve())
            .on('error', reject)
            .run();
        })
        .run();
    });
  } else {
    // Background music only
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(bgMusicLocalPath)
        .outputOptions(['-c:a aac', '-b:a 192k'])
        .output(masterAudioOutput)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });
  }

  // 6. Subtitles: Write SRT file if subtitles exist
  let srtFilePath: string | null = null;
  if (project.subtitle_track && project.subtitle_track.srt_content) {
    srtFilePath = path.join(workDir, 'subtitles.srt');
    fs.writeFileSync(srtFilePath, project.subtitle_track.srt_content, 'utf-8');
  }

  // 7. Final Master Muxing: Combine video + mixed audio into high-fidelity MP4
  const finalFilename = `master_${projectId}_${Date.now()}.mp4`;
  const finalOutputPath = path.join(ASSETS_DIR, finalFilename);

  await new Promise<void>((resolve, reject) => {
    const cmd = ffmpeg()
      .input(rawVideoOutput)
      .input(masterAudioOutput)
      .outputOptions([
        '-c:v', 'copy',
        '-c:a', 'copy',
        '-shortest',
        '-movflags', '+faststart'
      ]);

    cmd
      .output(finalOutputPath)
      .on('end', () => {
        console.log(`[FFmpeg Master Pipeline] Master assembly complete: ${finalFilename}`);
        resolve();
      })
      .on('error', reject)
      .run();
  });

  // 8. Generate thumbnail from master video
  const thumbnailFilename = `thumb_${projectId}.png`;
  const thumbnailPath = path.join(ASSETS_DIR, thumbnailFilename);

  await new Promise<void>((resolve) => {
    ffmpeg()
      .input(finalOutputPath)
      .outputOptions(['-ss 00:00:01', '-vframes 1'])
      .output(thumbnailPath)
      .on('end', () => resolve())
      .on('error', () => {
        // Fallback to first shot asset
        resolve();
      })
      .run();
  });

  let finalVideoUrl = `/assets/${finalFilename}`;
  let thumbnailUrl = fs.existsSync(thumbnailPath) 
    ? `/assets/${thumbnailFilename}` 
    : (allShots[0]?.visual_asset_url || `/assets/shot_${allShots[0]?.id}.svg`);

  // Upload final MP4 and thumbnail to Supabase Storage
  try {
    const videoUpload = await storageService.uploadMasterVideo(projectId, finalOutputPath);
    finalVideoUrl = videoUpload.publicUrl;
    if (fs.existsSync(thumbnailPath)) {
      const thumbUpload = await storageService.uploadThumbnail(projectId, thumbnailPath);
      thumbnailUrl = thumbUpload.publicUrl;
    }
    console.log(`[FFmpeg Master Pipeline] Master video registered at: ${finalVideoUrl}`);
  } catch (storageErr: any) {
    console.warn(`[FFmpeg Master Pipeline] Storage upload fallback: ${storageErr.message}`);
  }

  // Update project record
  await db.updateProject(projectId, {
    final_video_url: finalVideoUrl,
    thumbnail_url: thumbnailUrl,
    actual_duration_seconds: totalDuration,
    status: 'COMPLETED',
    progress_percentage: 100,
  });

  // Safe cleanup of temporary workDir files
  try {
    if (fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  } catch (cleanErr: any) {
    console.warn(`[FFmpeg Master Pipeline] Non-fatal temp cleanup warning: ${cleanErr.message}`);
  }

  return {
    outputVideoUrl: finalVideoUrl,
    thumbnailUrl,
    durationSeconds: totalDuration,
  };
}

