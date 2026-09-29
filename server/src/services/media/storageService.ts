import fs from 'fs';
import path from 'path';
import { supabase, isSupabaseConfigured } from '../../lib/supabase.js';
import { env } from '../../config/env.js';

export interface StorageUploadResult {
  storagePath: string;
  publicUrl: string;
  sizeBytes: number;
  uploadedToSupabase: boolean;
}

export class StorageService {
  private bucketName: string;

  constructor() {
    this.bucketName = env.SUPABASE_STORAGE_BUCKET || 'cineforge-assets';
  }

  public async uploadShotVideo(
    projectId: string, 
    shotId: string, 
    localFilePath: string
  ): Promise<StorageUploadResult> {
    const filename = path.basename(localFilePath);
    const remotePath = `projects/${projectId}/shots/${shotId}_${Date.now()}.mp4`;
    return this.uploadFile(localFilePath, remotePath, 'video/mp4', `/assets/${filename}`);
  }

  public async uploadMasterVideo(
    projectId: string, 
    localFilePath: string
  ): Promise<StorageUploadResult> {
    const filename = path.basename(localFilePath);
    const remotePath = `projects/${projectId}/master_${Date.now()}.mp4`;
    return this.uploadFile(localFilePath, remotePath, 'video/mp4', `/assets/${filename}`);
  }

  public async uploadThumbnail(
    projectId: string, 
    localFilePath: string
  ): Promise<StorageUploadResult> {
    const filename = path.basename(localFilePath);
    const remotePath = `projects/${projectId}/thumbnail.png`;
    return this.uploadFile(localFilePath, remotePath, 'image/png', `/assets/${filename}`);
  }

  public async uploadReferenceImage(
    projectId: string, 
    shotId: string, 
    localFilePath: string
  ): Promise<StorageUploadResult> {
    const filename = path.basename(localFilePath);
    const remotePath = `projects/${projectId}/references/ref_${shotId}.png`;
    return this.uploadFile(localFilePath, remotePath, 'image/png', `/assets/${filename}`);
  }

  public async uploadGeneratedImage(
    projectId: string,
    imageId: string,
    localFilePath: string,
    contentType: string = 'image/png'
  ): Promise<StorageUploadResult> {
    const filename = path.basename(localFilePath);
    const remotePath = `projects/${projectId}/images/${imageId}_${Date.now()}.png`;
    return this.uploadFile(localFilePath, remotePath, contentType, `/assets/${filename}`);
  }

  private async uploadFile(
    localFilePath: string, 
    remotePath: string, 
    contentType: string, 
    fallbackLocalUrl: string
  ): Promise<StorageUploadResult> {
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`Local file not found for storage upload: ${localFilePath}`);
    }

    const fileBuffer = fs.readFileSync(localFilePath);
    const sizeBytes = fileBuffer.length;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.storage
          .from(this.bucketName)
          .upload(remotePath, fileBuffer, {
            contentType,
            upsert: true,
          });

        if (error) {
          console.warn(`[StorageService] Supabase upload failed (${error.message}). Falling back to local static URL.`);
          return {
            storagePath: remotePath,
            publicUrl: fallbackLocalUrl,
            sizeBytes,
            uploadedToSupabase: false,
          };
        }

        const { data: urlData } = supabase.storage
          .from(this.bucketName)
          .getPublicUrl(data.path);

        console.log(`[StorageService] Successfully uploaded to Supabase Storage: ${data.path}`);
        return {
          storagePath: data.path,
          publicUrl: urlData.publicUrl || fallbackLocalUrl,
          sizeBytes,
          uploadedToSupabase: true,
        };
      } catch (err: any) {
        console.warn(`[StorageService] Exception uploading to Supabase Storage: ${err.message}. Using local file URL.`);
      }
    }

    return {
      storagePath: remotePath,
      publicUrl: fallbackLocalUrl,
      sizeBytes,
      uploadedToSupabase: false,
    };
  }
}

export const storageService = new StorageService();
