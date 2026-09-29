export type ProjectStatus = 'DRAFT' | 'PLANNING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
export type JobStatus = 
  | 'PENDING' 
  | 'PROCESSING' 
  | 'COMPLETED' 
  | 'FAILED' 
  | 'CANCELLED'
  | 'queued'
  | 'planning'
  | 'generating'
  | 'downloading'
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type AspectRatio = '16:9' | '9:16' | '1:1';
export type ShotCameraMotion = 
  | 'STATIC' 
  | 'PAN_LEFT' 
  | 'PAN_RIGHT' 
  | 'TILT_UP' 
  | 'TILT_DOWN' 
  | 'ZOOM_IN' 
  | 'ZOOM_OUT' 
  | 'DOLLY_FORWARD' 
  | 'ORBIT';

export type JobType = 
  | 'STORY_ANALYSIS' 
  | 'SCENE_EXPANSION' 
  | 'SHOT_IMAGE' 
  | 'SHOT_VIDEO' 
  | 'VOICE_TTS' 
  | 'AUDIO_SFX_MUSIC' 
  | 'FINAL_RENDER'
  | 'IMAGE_GEN';

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
  tier?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CharacterBible {
  id: string;
  project_id: string;
  name: string;
  description: string;
  visual_attributes: {
    hair?: string;
    clothing?: string;
    build?: string;
    distinguishingFeatures?: string;
    [key: string]: string | undefined;
  };
  reference_image_url?: string | null;
  voice_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StyleBible {
  id: string;
  project_id: string;
  style_name: string;
  lighting: string;
  camera_gear: string;
  color_palette: string[];
  environment_rules: string;
  negative_prompt: string;
  created_at?: string;
  updated_at?: string;
}

export interface Shot {
  id: string;
  scene_id: string;
  project_id: string;
  shot_order: number;
  visual_prompt: string;
  motion_instruction: ShotCameraMotion;
  duration_seconds: number;
  visual_asset_url?: string | null;
  character_ids?: string[];
  status: JobStatus;
  error_message?: string | null;
  retry_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface Scene {
  id: string;
  project_id: string;
  scene_order: number;
  title: string;
  narrative_goal: string;
  environment: string;
  mood: string;
  target_duration_seconds: number;
  actual_duration_seconds?: number;
  status: JobStatus;
  narration_script?: string;
  shots?: Shot[];
  created_at?: string;
  updated_at?: string;
}

export interface AudioTrack {
  id: string;
  project_id: string;
  scene_id?: string | null;
  shot_id?: string | null;
  track_type: 'VOICEOVER' | 'MUSIC' | 'SFX';
  file_url: string;
  start_time_seconds: number;
  duration_seconds: number;
  volume_level: number;
  ducking_enabled: boolean;
  metadata?: {
    transcript?: string;
    cues?: Array<{ start: number; end: number; text: string }>;
    [key: string]: any;
  };
  created_at?: string;
}

export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

export interface SubtitleTrack {
  id: string;
  project_id: string;
  srt_content: string;
  vtt_content: string;
  json_cues: SubtitleCue[];
  created_at?: string;
}

export interface GenerationJob {
  id: string;
  user_id?: string;
  project_id: string;
  scene_id?: string | null;
  shot_id?: string | null;
  job_type: JobType;
  target_entity_id: string;
  provider?: string;
  provider_operation_id?: string | null;
  status: JobStatus;
  progress?: number;
  attempts: number;
  max_attempts: number;
  payload: Record<string, any>;
  result?: Record<string, any>;
  error?: string | null;
  error_log?: string | null;
  locked_at?: string | null;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at?: string;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  initial_prompt: string;
  raw_script?: string | null;
  target_duration_seconds: number;
  actual_duration_seconds?: number;
  aspect_ratio: AspectRatio;
  visual_style: string;
  pacing: string;
  status: ProjectStatus;
  progress_percentage: number;
  error_message?: string | null;
  final_video_url?: string | null;
  thumbnail_url?: string | null;
  created_at?: string;
  updated_at?: string;
  scenes?: Scene[];
  character_bibles?: CharacterBible[];
  style_bible?: StyleBible | null;
  audio_tracks?: AudioTrack[];
  subtitle_track?: SubtitleTrack | null;
  latest_jobs?: GenerationJob[];
}

export interface ProjectProgressResponse {
  status: ProjectStatus;
  progressPercentage: number;
  activeJobsCount: number;
  failedJobsCount: number;
  errorMessage?: string | null;
  scenes: Array<{
    id: string;
    sceneOrder: number;
    title: string;
    status: JobStatus;
    shotsCount: number;
    completedShotsCount: number;
    shots: Array<{
      id: string;
      shotOrder: number;
      status: JobStatus;
      visualAssetUrl?: string | null;
      errorMessage?: string | null;
      retryCount: number;
    }>;
  }>;
}

export interface ExportResponse {
  downloadUrl?: string | null;
  srtUrl?: string | null;
  vttUrl?: string | null;
  duration: number;
  resolution: string;
  status: ProjectStatus;
}
