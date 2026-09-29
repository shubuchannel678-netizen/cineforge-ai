-- ==============================================================================
-- CineForge AI: Complete Production PostgreSQL Schema & Row-Level Security
-- Migration: 20250101000000_cineforge_init.sql
-- ==============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define Custom Enum Types
DO $$ BEGIN
  CREATE TYPE project_status AS ENUM (
    'DRAFT', 
    'PLANNING', 
    'GENERATING', 
    'COMPLETED', 
    'FAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM (
    'PENDING', 
    'PROCESSING', 
    'COMPLETED', 
    'FAILED', 
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE aspect_ratio AS ENUM (
    '16:9', 
    '9:16', 
    '1:1'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE shot_camera_motion AS ENUM (
    'STATIC', 
    'PAN_LEFT', 
    'PAN_RIGHT', 
    'TILT_UP', 
    'TILT_DOWN', 
    'ZOOM_IN', 
    'ZOOM_OUT', 
    'DOLLY_FORWARD', 
    'ORBIT'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1. Profiles Table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  tier TEXT DEFAULT 'creator',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  initial_prompt TEXT NOT NULL,
  raw_script TEXT,
  target_duration_seconds INTEGER NOT NULL CHECK (target_duration_seconds > 0),
  actual_duration_seconds NUMERIC(10, 2) DEFAULT 0,
  aspect_ratio aspect_ratio DEFAULT '16:9',
  visual_style TEXT NOT NULL DEFAULT 'Cinematic Realism',
  pacing TEXT NOT NULL DEFAULT 'Balanced & Narrative',
  status project_status DEFAULT 'DRAFT',
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  final_video_url TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Character Bibles Table
CREATE TABLE IF NOT EXISTS public.character_bibles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  visual_attributes JSONB NOT NULL DEFAULT '{}'::jsonb, 
  -- e.g., {"hair": "black", "outfit": "blue hoodie", "build": "athletic"}
  reference_image_url TEXT,
  voice_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Style Bibles Table
CREATE TABLE IF NOT EXISTS public.style_bibles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  style_name TEXT NOT NULL,
  lighting TEXT NOT NULL,
  camera_gear TEXT NOT NULL,
  color_palette JSONB NOT NULL DEFAULT '[]'::jsonb,
  environment_rules TEXT NOT NULL,
  negative_prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Scenes Table
CREATE TABLE IF NOT EXISTS public.scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scene_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  narrative_goal TEXT NOT NULL,
  environment TEXT NOT NULL,
  mood TEXT NOT NULL,
  target_duration_seconds NUMERIC(8, 2) NOT NULL,
  actual_duration_seconds NUMERIC(8, 2) DEFAULT 0,
  status job_status DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, scene_order)
);

-- 6. Shots Table (Under Scenes)
CREATE TABLE IF NOT EXISTS public.shots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scene_id UUID NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  shot_order INTEGER NOT NULL,
  visual_prompt TEXT NOT NULL,
  motion_instruction shot_camera_motion DEFAULT 'STATIC',
  duration_seconds NUMERIC(6, 2) NOT NULL DEFAULT 5.0,
  visual_asset_url TEXT,
  character_ids UUID[] DEFAULT ARRAY[]::UUID[],
  status job_status DEFAULT 'PENDING',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scene_id, shot_order)
);

-- 7. Audio Tracks Table
CREATE TABLE IF NOT EXISTS public.audio_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES public.scenes(id) ON DELETE CASCADE,
  shot_id UUID REFERENCES public.shots(id) ON DELETE CASCADE,
  track_type TEXT NOT NULL CHECK (track_type IN ('VOICEOVER', 'MUSIC', 'SFX')),
  file_url TEXT NOT NULL,
  start_time_seconds NUMERIC(10, 2) NOT NULL,
  duration_seconds NUMERIC(10, 2) NOT NULL,
  volume_level NUMERIC(3, 2) DEFAULT 1.0 CHECK (volume_level BETWEEN 0.0 AND 2.0),
  ducking_enabled BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb, -- e.g. {"transcript": "text", "cues": []}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Subtitle Tracks Table
CREATE TABLE IF NOT EXISTS public.subtitle_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  srt_content TEXT NOT NULL,
  vtt_content TEXT NOT NULL,
  json_cues JSONB NOT NULL DEFAULT '[]'::jsonb, 
  -- e.g., [{"start": 0.0, "end": 2.5, "text": "In the beginning..."}]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Generation Jobs Queue Table
CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('STORY_ANALYSIS', 'SCENE_EXPANSION', 'SHOT_IMAGE', 'SHOT_VIDEO', 'VOICE_TTS', 'AUDIO_SFX_MUSIC', 'FINAL_RENDER')),
  target_entity_id UUID NOT NULL, -- references projects.id, scenes.id, or shots.id
  status job_status DEFAULT 'PENDING',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB DEFAULT '{}'::jsonb,
  error_log TEXT,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_scenes_project_id ON public.scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_shots_scene_id ON public.shots(scene_id);
CREATE INDEX IF NOT EXISTS idx_shots_project_id ON public.shots(project_id);
CREATE INDEX IF NOT EXISTS idx_audio_tracks_project_id ON public.audio_tracks(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status_type ON public.generation_jobs(status, job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON public.generation_jobs(project_id);

-- Updated At Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Triggers
DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_character_bibles_updated_at ON public.character_bibles;
CREATE TRIGGER trg_character_bibles_updated_at BEFORE UPDATE ON public.character_bibles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_style_bibles_updated_at ON public.style_bibles;
CREATE TRIGGER trg_style_bibles_updated_at BEFORE UPDATE ON public.style_bibles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_scenes_updated_at ON public.scenes;
CREATE TRIGGER trg_scenes_updated_at BEFORE UPDATE ON public.scenes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_shots_updated_at ON public.shots;
CREATE TRIGGER trg_shots_updated_at BEFORE UPDATE ON public.shots FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_generation_jobs_updated_at ON public.generation_jobs;
CREATE TRIGGER trg_generation_jobs_updated_at BEFORE UPDATE ON public.generation_jobs FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ==============================================================================
-- Section 11: Row-Level Security (RLS) / Data Isolation Rules
-- ==============================================================================

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_bibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.style_bibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtitle_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

-- 1. Profiles: Users can view and update their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- 2. Projects: Strict user ownership
DROP POLICY IF EXISTS "Users can perform all actions on their own projects" ON public.projects;
CREATE POLICY "Users can perform all actions on their own projects" 
  ON public.projects FOR ALL 
  USING (auth.uid() = user_id);

-- 3. Character Bibles: Accessible if user owns parent project
DROP POLICY IF EXISTS "Users can manage character bibles for their projects" ON public.character_bibles;
CREATE POLICY "Users can manage character bibles for their projects" 
  ON public.character_bibles FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = character_bibles.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- 4. Style Bibles: Accessible if user owns parent project
DROP POLICY IF EXISTS "Users can manage style bibles for their projects" ON public.style_bibles;
CREATE POLICY "Users can manage style bibles for their projects" 
  ON public.style_bibles FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = style_bibles.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- 5. Scenes: Accessible if user owns parent project
DROP POLICY IF EXISTS "Users can manage scenes for their projects" ON public.scenes;
CREATE POLICY "Users can manage scenes for their projects" 
  ON public.scenes FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = scenes.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- 6. Shots: Accessible if user owns parent project
DROP POLICY IF EXISTS "Users can manage shots for their projects" ON public.shots;
CREATE POLICY "Users can manage shots for their projects" 
  ON public.shots FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = shots.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- 7. Audio Tracks: Accessible if user owns parent project
DROP POLICY IF EXISTS "Users can manage audio tracks for their projects" ON public.audio_tracks;
CREATE POLICY "Users can manage audio tracks for their projects" 
  ON public.audio_tracks FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = audio_tracks.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- 8. Subtitle Tracks: Accessible if user owns parent project
DROP POLICY IF EXISTS "Users can manage subtitle tracks for their projects" ON public.subtitle_tracks;
CREATE POLICY "Users can manage subtitle tracks for their projects" 
  ON public.subtitle_tracks FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = subtitle_tracks.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- 9. Generation Jobs: Accessible if user owns parent project
DROP POLICY IF EXISTS "Users can view jobs for their projects" ON public.generation_jobs;
CREATE POLICY "Users can view jobs for their projects" 
  ON public.generation_jobs FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = generation_jobs.project_id 
      AND projects.user_id = auth.uid()
    )
  );
