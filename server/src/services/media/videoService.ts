import fs from 'fs';
import path from 'path';
import { getVideoProvider } from '../../providers/video/index.js';
import { storageService } from './storageService.js';
import { normalizeToVeoDuration } from '../ai/shotDecomposer.js';
import type { ShotCameraMotion } from '../../shared/types/index.js';


const ASSETS_DIR = path.resolve(process.cwd(), 'public', 'assets');
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

export async function generateShotVideoClip(params: {
  shotId: string;
  projectId: string;
  prompt?: string;
  sourceAssetUrl?: string;
  durationSeconds: number;
  motionInstruction?: ShotCameraMotion;
  aspectRatio: string;
}): Promise<string> {
  const provider = getVideoProvider();

  // Strict check: NO simulation fallback
  if (!provider.isConfigured()) {
    throw new Error('Real AI video generation is not configured. Add the required provider credentials.');
  }

  const outputFilename = `shot_${params.shotId}.mp4`;
  const outputPath = path.join(ASSETS_DIR, outputFilename);

  // If already rendered and exists, return existing
  if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
    return `/assets/${outputFilename}`;
  }

  const effectivePrompt = params.prompt || `Cinematic shot with camera motion ${params.motionInstruction || 'STATIC'}`;

  // Start generation with real provider
  const { operationId } = await provider.generateVideo({
    shotId: params.shotId,
    projectId: params.projectId,
    prompt: effectivePrompt,
    aspectRatio: params.aspectRatio === '9:16' ? '9:16' : '16:9',
    durationSeconds: normalizeToVeoDuration(params.durationSeconds),
    referenceImageUrl: params.sourceAssetUrl,
  });

  // Poll for completion (with timeout)
  const maxAttempts = 60; // 5 minutes max (5s intervals)
  let attempts = 0;
  let status = await provider.getGenerationStatus(operationId);

  while (!status.done && attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    status = await provider.getGenerationStatus(operationId);
    attempts++;
  }

  if (!status.done) {
    throw new Error(`Video generation timed out for operation: ${operationId}`);
  }

  if (status.status === 'failed') {
    throw new Error(status.error || `Veo video generation failed for shot ${params.shotId}`);
  }

  // Download video clip locally
  await provider.downloadGeneratedVideo(status, outputPath);

  // Upload to Supabase Storage
  try {
    const uploadResult = await storageService.uploadShotVideo(
      params.projectId, 
      params.shotId, 
      outputPath
    );
    return uploadResult.publicUrl;
  } catch (storageErr: any) {
    console.warn(`[VideoService] Storage upload fallback: ${storageErr.message}`);
    return `/assets/${outputFilename}`;
  }
}
