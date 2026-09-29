export interface VideoGenerateParams {
  shotId?: string;
  projectId?: string;
  sceneId?: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  durationSeconds?: number;
  fps?: number;
  resolution?: '720p' | '1080p';
  referenceImageUrl?: string;
  referenceImageBytes?: Buffer;
  referenceImageMimeType?: string;
}

export type VideoOperationStatus =
  | 'queued'
  | 'generating'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface VideoGenerationStatus {
  operationId: string;
  done: boolean;
  status: VideoOperationStatus;
  progress?: number;
  videoUri?: string;
  videoBytesBase64?: string;
  error?: string;
  rawResponse?: any;
}

export interface VideoDownloadResult {
  filePath: string;
  fileBuffer?: Buffer;
  mimeType: string;
  durationSeconds?: number;
}

export interface VideoGenerationProvider {
  readonly name: string;
  isConfigured(): boolean;
  getModel?(): string;
  generateVideo(params: VideoGenerateParams): Promise<{ operationId: string }>;
  getGenerationStatus(operationId: string): Promise<VideoGenerationStatus>;
  downloadGeneratedVideo(
    status: VideoGenerationStatus, 
    destinationPath: string
  ): Promise<VideoDownloadResult>;
}
