import fs from 'fs';
import path from 'path';
import { getImageProvider } from '../../providers/image/index.js';
import { storageService, StorageUploadResult } from './storageService.js';

const ASSETS_DIR = path.resolve(process.cwd(), 'public', 'assets');
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

export interface GeneratedImageResult {
  assetUrl: string;
  storagePath: string;
  localPath: string;
  mimeType: string;
  sizeBytes: number;
  uploadedToSupabase: boolean;
}

/**
 * Generate a real AI shot keyframe image using the configured image generation provider.
 * Strictly NO SVG or simulated placeholders.
 */
export async function generateShotImage(params: {
  shotId: string;
  projectId: string;
  visualPrompt: string;
  negativePrompt?: string;
  aspectRatio: string;
}): Promise<string> {
  const provider = getImageProvider();

  if (!provider.isConfigured()) {
    throw new Error('Real AI image generation is not configured. Add the required provider credentials.');
  }

  console.log(`[ImageService] Generating real shot image for shot ${params.shotId} via ${provider.name} (${provider.getModel()})`);

  // Map aspect ratio for provider: '16:9' | '9:16' | '1:1' | '4:3' | '3:4'
  let aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' = '16:9';
  if (params.aspectRatio === '9:16' || params.aspectRatio === '1:1' || params.aspectRatio === '4:3' || params.aspectRatio === '3:4') {
    aspectRatio = params.aspectRatio;
  }

  // 1. Request real image from provider
  const result = await provider.generateImage({
    prompt: params.visualPrompt,
    negativePrompt: params.negativePrompt,
    aspectRatio,
    projectId: params.projectId,
    shotId: params.shotId,
  });

  const firstImage = result.images[0];
  if (!firstImage) {
    throw new Error('Provider did not return any image data.');
  }

  // 2. Download / write image to local disk
  const ext = firstImage.mimeType?.includes('jpeg') || firstImage.mimeType?.includes('jpg') ? 'jpg' : 'png';
  const filename = `shot_${params.shotId}_${Date.now()}.${ext}`;
  const localFilePath = path.join(ASSETS_DIR, filename);

  const downloaded = await provider.downloadGeneratedImage(firstImage, localFilePath);

  // 3. Upload to Supabase Storage with local fallback
  const uploadResult = await storageService.uploadGeneratedImage(
    params.projectId,
    params.shotId,
    downloaded.filePath,
    downloaded.mimeType
  );

  console.log(`[ImageService] Real shot image successfully saved & stored: ${uploadResult.publicUrl}`);
  return uploadResult.publicUrl;
}

/**
 * Generate a standalone image for Image Studio with full metadata
 */
export async function generateStandaloneImage(params: {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  projectId?: string;
  imageId?: string;
}): Promise<GeneratedImageResult> {
  const provider = getImageProvider();

  if (!provider.isConfigured()) {
    throw new Error('Real AI image generation is not configured. Add the required provider credentials.');
  }

  const imageId = params.imageId || `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const projectId = params.projectId || 'standalone';
  const aspectRatio = params.aspectRatio || '16:9';

  console.log(`[ImageService] Generating standalone image "${imageId}" via ${provider.name} (${provider.getModel()})`);

  const result = await provider.generateImage({
    prompt: params.prompt,
    negativePrompt: params.negativePrompt,
    aspectRatio,
    projectId,
    shotId: imageId,
  });

  const firstImage = result.images[0];
  if (!firstImage) {
    throw new Error('Provider did not return any image data.');
  }

  const ext = firstImage.mimeType?.includes('jpeg') || firstImage.mimeType?.includes('jpg') ? 'jpg' : 'png';
  const filename = `${imageId}.${ext}`;
  const localFilePath = path.join(ASSETS_DIR, filename);

  const downloaded = await provider.downloadGeneratedImage(firstImage, localFilePath);

  const uploadResult = await storageService.uploadGeneratedImage(
    projectId,
    imageId,
    downloaded.filePath,
    downloaded.mimeType
  );

  return {
    assetUrl: uploadResult.publicUrl,
    storagePath: uploadResult.storagePath,
    localPath: downloaded.filePath,
    mimeType: downloaded.mimeType,
    sizeBytes: uploadResult.sizeBytes,
    uploadedToSupabase: uploadResult.uploadedToSupabase,
  };
}
