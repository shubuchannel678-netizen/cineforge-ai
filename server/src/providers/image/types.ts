export interface ImageGenerateParams {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  numberOfImages?: number;
  outputMimeType?: 'image/png' | 'image/jpeg';
  projectId?: string;
  shotId?: string;
}

export interface GeneratedImageData {
  imageBytesBase64?: string;
  imageUrl?: string;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface ImageGenerationResult {
  provider: string;
  model: string;
  images: GeneratedImageData[];
  rawResponse?: any;
}

export interface ImageDownloadResult {
  filePath: string;
  fileBuffer: Buffer;
  mimeType: string;
}

export interface ImageGenerationProvider {
  readonly name: string;
  isConfigured(): boolean;
  getModel(): string;
  generateImage(params: ImageGenerateParams): Promise<ImageGenerationResult>;
  downloadGeneratedImage(
    imageData: GeneratedImageData, 
    destinationPath: string
  ): Promise<ImageDownloadResult>;
}
