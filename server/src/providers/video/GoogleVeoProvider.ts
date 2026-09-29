import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';
import type { 
  VideoGenerationProvider, 
  VideoGenerateParams, 
  VideoGenerationStatus, 
  VideoDownloadResult 
} from './types.js';

export class GoogleVeoProvider implements VideoGenerationProvider {
  public readonly name = 'GoogleVeoProvider';
  private _apiKey?: string;
  private _model?: string;
  private lastQuotaExhausted: boolean = false;
  private lastQuotaError: string | null = null;

  constructor(options?: { apiKey?: string; model?: string }) {
    this._apiKey = options?.apiKey;
    this._model = options?.model;
  }

  public get apiKey(): string {
    return this._apiKey !== undefined ? this._apiKey : (process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || '');
  }

  public get model(): string {
    return this._model !== undefined ? this._model : (env.VEO_MODEL || 'veo-3.1-generate-preview');
  }

  public isConfigured(): boolean {
    const key = this.apiKey;
    return Boolean(
      key && 
      key.trim() !== '' && 
      !key.includes('your_') &&
      !key.includes('placeholder')
    );
  }

  public isQuotaExhausted(): boolean {
    return this.lastQuotaExhausted;
  }

  public getQuotaError(): string | null {
    return this.lastQuotaError;
  }

  public resetQuotaStatus(): void {
    this.lastQuotaExhausted = false;
    this.lastQuotaError = null;
  }

  public getModel(): string {
    return this.model;
  }

  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      model: this.model,
      configured: this.isConfigured(),
      quotaExhausted: this.lastQuotaExhausted,
      quotaStatus: this.lastQuotaExhausted ? 'Exhausted (429)' : 'Active',
    };
  }

  public async generateVideo(params: VideoGenerateParams): Promise<{ operationId: string }> {
    if (!this.isConfigured()) {
      throw new Error('Real AI video generation is not configured. Add the required provider credentials.');
    }

    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    // Map aspect ratio for Veo (supports '16:9' or '9:16')
    const aspectRatio = params.aspectRatio === '9:16' ? '9:16' : '16:9';

    // Veo generation clips strictly support durations of 4, 6, or 8 seconds
    let durationSeconds = 6;
    if (params.durationSeconds !== undefined) {
      const parsed = Math.round(params.durationSeconds);
      if (parsed <= 4) {
        durationSeconds = 4;
      } else if (parsed >= 8) {
        durationSeconds = 8;
      } else {
        durationSeconds = 6;
      }
    }

    const config: Record<string, any> = {
      numberOfVideos: 1,
      aspectRatio,
      durationSeconds,
    };

    if (params.negativePrompt) {
      config.negativePrompt = params.negativePrompt;
    }

    // Support for Image-to-Video: if reference image is provided
    let imageInput: any = undefined;
    if (params.referenceImageBytes) {
      imageInput = {
        imageBytes: params.referenceImageBytes.toString('base64'),
        mimeType: params.referenceImageMimeType || 'image/png',
      };
    } else if (params.referenceImageUrl) {
      try {
        let localPath = params.referenceImageUrl;
        if (localPath.startsWith('/assets/')) {
          localPath = path.resolve(process.cwd(), 'public', localPath.replace(/^\//, ''));
        }
        if (fs.existsSync(localPath) && (localPath.endsWith('.png') || localPath.endsWith('.jpg') || localPath.endsWith('.jpeg'))) {
          const imgBuffer = fs.readFileSync(localPath);
          imageInput = {
            imageBytes: imgBuffer.toString('base64'),
            mimeType: localPath.endsWith('.png') ? 'image/png' : 'image/jpeg',
          };
        }
      } catch (err: any) {
        console.warn(`[GoogleVeoProvider] Could not load reference image for I2V: ${err.message}`);
      }
    }

    const sourcePayload: any = {
      prompt: params.prompt,
    };
    if (imageInput) {
      sourcePayload.image = imageInput;
    }

    console.log(`[GoogleVeoProvider] Initiating Veo video generation with model "${this.model}" (clip duration: ${durationSeconds}s, ratio: ${aspectRatio})`);

    try {
      const operation = await ai.models.generateVideos({
        model: this.model,
        source: sourcePayload,
        config,
      });

      if (!operation || !operation.name) {
        throw new Error(`Veo did not return a valid operation resource name. Received: ${JSON.stringify(operation)}`);
      }

      this.lastQuotaExhausted = false;
      this.lastQuotaError = null;
      console.log(`[GoogleVeoProvider] Generation operation created: ${operation.name}`);
      return { operationId: operation.name };
    } catch (err: any) {
      let cleanMsg = err.message || 'Unknown Veo generation error';
      try {
        const parsed = typeof err.message === 'string' ? JSON.parse(err.message) : err;
        if (parsed?.error?.message) {
          cleanMsg = parsed.error.message;
        }
      } catch {}

      if (this.apiKey) {
        cleanMsg = cleanMsg.split(this.apiKey).join('[REDACTED_API_KEY]');
      }

      const isQuota = err.status === 429 || 
        cleanMsg.includes('429') || 
        cleanMsg.includes('quota') || 
        cleanMsg.includes('RESOURCE_EXHAUSTED') ||
        cleanMsg.includes('exceeded your current quota');

      if (isQuota) {
        this.lastQuotaExhausted = true;
        this.lastQuotaError = 'Google API quota is unavailable for this key/project.';
        if (!cleanMsg.includes('Google API quota is unavailable for this key/project.')) {
          cleanMsg = `Google API quota is unavailable for this key/project. ${cleanMsg}`;
        }
      }

      console.error(`[GoogleVeoProvider] Generation request error: ${cleanMsg}`);
      const providerError: any = new Error(cleanMsg);
      providerError.status = isQuota ? 429 : (err.status || 500);
      throw providerError;
    }
  }


  public async getGenerationStatus(operationId: string): Promise<VideoGenerationStatus> {
    if (!this.isConfigured()) {
      throw new Error('Real AI video generation is not configured. Add the required provider credentials.');
    }

    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    try {
      const operation = await ai.operations.getVideosOperation({
        operation: { name: operationId } as any,
      });

      if (!operation) {
        throw new Error(`Operation "${operationId}" not found`);
      }

      if (operation.error) {
        const errMsg = typeof operation.error === 'object' 
          ? (operation.error as any).message || JSON.stringify(operation.error) 
          : String(operation.error);
        return {
          operationId,
          done: true,
          status: 'failed',
          error: errMsg,
          rawResponse: operation,
        };
      }

      if (operation.done) {
        const generatedVideo = operation.response?.generatedVideos?.[0];
        const video = generatedVideo?.video;

        return {
          operationId,
          done: true,
          status: 'completed',
          videoUri: video?.uri,
          videoBytesBase64: video?.videoBytes,
          rawResponse: operation,
        };
      }

      return {
        operationId,
        done: false,
        status: 'generating',
        progress: (operation.metadata as any)?.progressPercent || undefined,
        rawResponse: operation,
      };
    } catch (err: any) {
      console.error(`[GoogleVeoProvider] Error getting operation status for "${operationId}":`, err.message);
      return {
        operationId,
        done: true,
        status: 'failed',
        error: err.message,
      };
    }
  }

  public async downloadGeneratedVideo(
    status: VideoGenerationStatus, 
    destinationPath: string
  ): Promise<VideoDownloadResult> {
    const destDir = path.dirname(destinationPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // 1. Direct base64 video bytes
    if (status.videoBytesBase64) {
      const buffer = Buffer.from(status.videoBytesBase64, 'base64');
      fs.writeFileSync(destinationPath, buffer);
      return {
        filePath: destinationPath,
        fileBuffer: buffer,
        mimeType: 'video/mp4',
      };
    }

    // 2. Download via SDK files.download if generatedVideo object is available
    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    const generatedVideo = status.rawResponse?.response?.generatedVideos?.[0];
    if (generatedVideo && typeof ai.files?.download === 'function') {
      try {
        await ai.files.download({
          file: generatedVideo,
          downloadPath: destinationPath,
        });
        if (fs.existsSync(destinationPath) && fs.statSync(destinationPath).size > 0) {
          const buffer = fs.readFileSync(destinationPath);
          return {
            filePath: destinationPath,
            fileBuffer: buffer,
            mimeType: 'video/mp4',
          };
        }
      } catch (sdkErr: any) {
        console.warn(`[GoogleVeoProvider] ai.files.download failed, attempting direct URI fetch: ${sdkErr.message}`);
      }
    }

    // 3. Download via URI if provided
    if (status.videoUri) {
      const fetchHeaders: Record<string, string> = {};
      if (this.apiKey) {
        fetchHeaders['x-goog-api-key'] = this.apiKey;
      }

      const res = await fetch(status.videoUri, { headers: fetchHeaders });
      if (!res.ok) {
        throw new Error(`Failed to download video from URI: HTTP ${res.status} ${res.statusText}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(destinationPath, buffer);

      return {
        filePath: destinationPath,
        fileBuffer: buffer,
        mimeType: 'video/mp4',
      };
    }

    throw new Error('No downloadable video content available in generation status result.');
  }
}
