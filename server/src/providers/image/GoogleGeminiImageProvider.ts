import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';
import type { 
  ImageGenerationProvider, 
  ImageGenerateParams, 
  ImageGenerationResult, 
  GeneratedImageData,
  ImageDownloadResult 
} from './types.js';

export class GoogleGeminiImageProvider implements ImageGenerationProvider {
  public readonly name = 'GoogleGeminiImageProvider';
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
    return this._model !== undefined ? this._model : (env.IMAGE_MODEL || 'gemini-2.5-flash-image');
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


  public async generateImage(params: ImageGenerateParams): Promise<ImageGenerationResult> {
    if (!this.isConfigured()) {
      throw new Error('Real AI image generation is not configured. Add the required provider credentials.');
    }

    if (!params.prompt || params.prompt.trim() === '') {
      throw new Error('Image generation prompt cannot be empty.');
    }

    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    // Aspect ratio mapping for Gemini image models: '16:9' | '9:16' | '1:1' | '4:3' | '3:4'
    const supportedRatios = ['1:1', '16:9', '9:16', '4:3', '3:4'];
    const aspectRatio = supportedRatios.includes(params.aspectRatio || '') ? params.aspectRatio : '16:9';

    // Construct prompt with optional negative prompt
    let promptText = params.prompt.trim();
    if (params.negativePrompt && params.negativePrompt.trim()) {
      promptText += `\nAvoid / Negative constraints: ${params.negativePrompt.trim()}`;
    }

    console.log(`[GoogleGeminiImageProvider] Requesting image generation with model "${this.model}" (aspect ratio: ${aspectRatio})`);

    try {
      // 1. Imagen models path (if configured with Imagen on Vertex / Enterprise)
      if (this.model.startsWith('imagen-') && typeof (ai.models as any)?.generateImages === 'function') {
        try {
          const res = await (ai.models as any).generateImages({
            model: this.model,
            prompt: promptText,
            config: {
              numberOfImages: params.numberOfImages || 1,
              aspectRatio,
              outputMimeType: params.outputMimeType || 'image/jpeg',
            },
          });

          const images: GeneratedImageData[] = [];
          for (const item of res?.generatedImages || []) {
            if (item?.image?.imageBytes) {
              images.push({
                imageBytesBase64: item.image.imageBytes,
                mimeType: params.outputMimeType || 'image/jpeg',
              });
            }
          }

          if (images.length > 0) {
            return {
              provider: this.name,
              model: this.model,
              images,
              rawResponse: res,
            };
          }
        } catch (imagenErr: any) {
          console.warn(`[GoogleGeminiImageProvider] generateImages for ${this.model} failed (${imagenErr.message}), falling back to generateContent.`);
        }
      }

      // 2. Official Gemini image generation path via generateContent with responseModalities: ['IMAGE']
      const response = await ai.models.generateContent({
        model: this.model,
        contents: promptText,
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio,
          },
        } as any,
      });

      const images: GeneratedImageData[] = [];
      const candidates = response?.candidates || [];

      for (const candidate of candidates) {
        const parts = candidate?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            images.push({
              imageBytesBase64: part.inlineData.data,
              mimeType: part.inlineData.mimeType || 'image/png',
            });
          }
        }
      }

      if (images.length === 0) {
        // Check for safety finish reason
        const candidate = candidates[0];
        const finishReason = candidate?.finishReason;
        if (finishReason && finishReason !== 'STOP') {
          throw new Error(`Image generation failed safety or quality filter: ${finishReason}`);
        }
        throw new Error('Google Gemini API did not return any image data in the response.');
      }

      this.lastQuotaExhausted = false;
      this.lastQuotaError = null;
      console.log(`[GoogleGeminiImageProvider] Successfully received ${images.length} generated image(s) from "${this.model}"`);

      return {
        provider: this.name,
        model: this.model,
        images,
        rawResponse: response,
      };
    } catch (err: any) {
      // Sanitize error message to ensure API key is never leaked
      let sanitizedMessage = err.message || 'Unknown image generation error';
      if (this.apiKey) {
        sanitizedMessage = sanitizedMessage.split(this.apiKey).join('[REDACTED_API_KEY]');
      }

      try {
        const jsonMatch = sanitizedMessage.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed?.error?.message) {
            sanitizedMessage = parsed.error.message;
          }
        }
      } catch {}

      const isQuota = err.status === 429 || 
        sanitizedMessage.includes('429') || 
        sanitizedMessage.includes('quota') || 
        sanitizedMessage.includes('RESOURCE_EXHAUSTED') ||
        sanitizedMessage.includes('exceeded your current quota');

      if (isQuota) {
        this.lastQuotaExhausted = true;
        this.lastQuotaError = 'Google API quota is unavailable for this key/project.';
        if (!sanitizedMessage.includes('Google API quota is unavailable for this key/project.')) {
          sanitizedMessage = `Google API quota is unavailable for this key/project. ${sanitizedMessage}`;
        }
      }

      console.error(`[GoogleGeminiImageProvider] Error generating image: ${sanitizedMessage}`);

      const providerError: any = new Error(sanitizedMessage);
      providerError.status = isQuota ? 429 : (err.status || 500);
      throw providerError;
    }

  }

  public async downloadGeneratedImage(
    imageData: GeneratedImageData, 
    destinationPath: string
  ): Promise<ImageDownloadResult> {
    const destDir = path.dirname(destinationPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // 1. Direct base64 image bytes
    if (imageData.imageBytesBase64) {
      const buffer = Buffer.from(imageData.imageBytesBase64, 'base64');
      fs.writeFileSync(destinationPath, buffer);
      return {
        filePath: destinationPath,
        fileBuffer: buffer,
        mimeType: imageData.mimeType || 'image/png',
      };
    }

    // 2. Fetch from imageUrl
    if (imageData.imageUrl) {
      const res = await fetch(imageData.imageUrl);
      if (!res.ok) {
        throw new Error(`Failed to download image from URL: HTTP ${res.status} ${res.statusText}`);
      }
      const arrayBuf = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      fs.writeFileSync(destinationPath, buffer);
      return {
        filePath: destinationPath,
        fileBuffer: buffer,
        mimeType: imageData.mimeType || 'image/png',
      };
    }

    throw new Error('No downloadable image content available in GeneratedImageData.');
  }
}
