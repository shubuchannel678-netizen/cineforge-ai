-- ==============================================================================
-- CineForge AI: Complete Production PostgreSQL Schema, RLS & Seed Data
-- Target Supabase Project: https://dpjkyfiehwpzxqavtdtm.supabase.co
-- Migration: 001_initial_schema.sql
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Define Custom Enum Types (Idempotent)
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

-- 3. Profiles Table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  tier TEXT DEFAULT 'creator',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Projects Table
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

-- 5. Character Bibles Table (Visual Continuity Anchors)
CREATE TABLE IF NOT EXISTS public.character_bibles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  visual_attributes JSONB NOT NULL DEFAULT '{}'::jsonb, 
  -- e.g., {"hair": "black", "clothing": "cyan tunic", "build": "athletic"}
  reference_image_url TEXT,
  voice_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Style Bibles Table (Cinematography & Negative Prompts)
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

-- 7. Scenes Table
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
  narration_script TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, scene_order)
);

-- 8. Shots Table (Under Scenes)
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

-- 9. Audio Tracks Table (Voiceover, Ambient Music, SFX)
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
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Subtitle Tracks Table
CREATE TABLE IF NOT EXISTS public.subtitle_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  srt_content TEXT NOT NULL,
  vtt_content TEXT NOT NULL,
  json_cues JSONB NOT NULL DEFAULT '[]'::jsonb, 
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Generation Jobs Queue Table
CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('STORY_ANALYSIS', 'SCENE_EXPANSION', 'SHOT_IMAGE', 'SHOT_VIDEO', 'VOICE_TTS', 'AUDIO_SFX_MUSIC', 'FINAL_RENDER')),
  target_entity_id UUID NOT NULL,
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

-- ==============================================================================
-- Indexes for High-Concurrency Querying
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_scenes_project_id ON public.scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_shots_scene_id ON public.shots(scene_id);
CREATE INDEX IF NOT EXISTS idx_shots_project_id ON public.shots(project_id);
CREATE INDEX IF NOT EXISTS idx_audio_tracks_project_id ON public.audio_tracks(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status_type ON public.generation_jobs(status, job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON public.generation_jobs(project_id);

-- ==============================================================================
-- Updated At Auto-Update Trigger
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
-- Auto-create Profile on Supabase Auth Signup
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, tier)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Lead Director'), 
    new.raw_user_meta_data->>'avatar_url', 
    'creator'
  )
  ON CONFLICT (id) DO UPDATE SET 
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- Row-Level Security (RLS) Policies
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_bibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.style_bibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtitle_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

-- 1. Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- 2. Projects
DROP POLICY IF EXISTS "Users can perform all actions on their own projects" ON public.projects;
CREATE POLICY "Users can perform all actions on their own projects" 
  ON public.projects FOR ALL 
  USING (auth.uid() = user_id);

-- 3. Character Bibles
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

-- 4. Style Bibles
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

-- 5. Scenes
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

-- 6. Shots
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

-- 7. Audio Tracks
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

-- 8. Subtitle Tracks
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

-- 9. Generation Jobs
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

-- ==============================================================================
-- Production Seed Data (Idempotent)
-- ==============================================================================

DO $$
DECLARE
  v_user_id UUID := '00000000-0000-0000-0000-000000000001';
  v_project_id UUID := '11111111-1111-1111-1111-111111111111';
  v_scene1_id UUID := '22222222-2222-2222-2222-222222222221';
  v_scene2_id UUID := '22222222-2222-2222-2222-222222222222';
  v_scene3_id UUID := '22222222-2222-2222-2222-222222222223';
  v_char_id UUID := '33333333-3333-3333-3333-333333333331';
  v_shot1_id UUID := '44444444-4444-4444-4444-444444444441';
  v_shot2_id UUID := '44444444-4444-4444-4444-444444444442';
  v_shot3_id UUID := '44444444-4444-4444-4444-444444444443';
BEGIN
  -- 1. Ensure Seed User exists in auth.users
  INSERT INTO auth.users (
    id, 
    instance_id, 
    aud, 
    role, 
    email, 
    encrypted_password, 
    email_confirmed_at, 
    raw_app_meta_data, 
    raw_user_meta_data, 
    created_at, 
    updated_at
  )
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'director@cineforge.ai',
    crypt('CineForge2025!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Lead Director","tier":"creator"}'::jsonb,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Ensure Profile exists
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    avatar_url, 
    tier
  )
  VALUES (
    v_user_id,
    'director@cineforge.ai',
    'Lead Director',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    'creator'
  )
  ON CONFLICT (id) DO UPDATE SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;

  -- 3. Seed Project: "Echoes of the Deep Caverns"
  INSERT INTO public.projects (
    id,
    user_id,
    title,
    description,
    initial_prompt,
    target_duration_seconds,
    actual_duration_seconds,
    aspect_ratio,
    visual_style,
    pacing,
    status,
    progress_percentage,
    final_video_url,
    thumbnail_url
  )
  VALUES (
    v_project_id,
    v_user_id,
    'Echoes of the Deep Caverns',
    'A cinematic Minecraft survival documentary exploring the ruins beneath the bedrock.',
    'A cinematic Minecraft survival story about discovering an ancient underground civilization beneath the deep slate caverns.',
    180,
    180.0,
    '16:9',
    'Minecraft Lore',
    'Balanced & Narrative',
    'COMPLETED',
    100,
    '/assets/master_demo.mp4',
    '/assets/thumb_demo.png'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 4. Seed Character Bible: Steve / Explorer
  INSERT INTO public.character_bibles (
    id,
    project_id,
    name,
    description,
    visual_attributes,
    voice_id
  )
  VALUES (
    v_char_id,
    v_project_id,
    'Steve / Explorer',
    'A seasoned survivalist crafting their destiny in dangerous subterranean biomes.',
    '{
      "hair": "Blocky dark brown hair with square fringe",
      "clothing": "Cyan tunic shirt, reinforced indigo utility trousers, iron buckle belt",
      "build": "Voxel cubic proportions, athletic adventurer stature",
      "distinguishingFeatures": "Carries an enchanted pickaxe holster on right hip"
    }'::jsonb,
    'voice_narrator_deep'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 5. Seed Style Bible
  INSERT INTO public.style_bibles (
    project_id,
    style_name,
    lighting,
    camera_gear,
    color_palette,
    environment_rules,
    negative_prompt
  )
  VALUES (
    v_project_id,
    'Minecraft Lore',
    'Golden hour volumetric block rays, soft ambient occlusion, warm torchlight glow',
    'ARRI Alexa LF, 35mm Anamorphic Master Prime lens, subtle depth of field',
    '["#10b981", "#0f172a", "#f59e0b", "#38bdf8"]'::jsonb,
    'Pristine voxel photographic texture continuity, hyper-detailed backgrounds without blur anomalies',
    'blurry, oversaturated, deformed anatomy, low quality, artifacts, floating limbs, modern watermarks, text'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 6. Seed Scenes
  INSERT INTO public.scenes (
    id,
    project_id,
    scene_order,
    title,
    narrative_goal,
    environment,
    mood,
    target_duration_seconds,
    actual_duration_seconds,
    status,
    narration_script
  )
  VALUES 
  (
    v_scene1_id,
    v_project_id,
    1,
    'The Descent into Deep Slate',
    'Establish the solitude and scale of the subterranean caverns',
    'Stalactite cavern with subterranean waterfalls and glowing lichen',
    'Mysterious & Atmospheric',
    45.0,
    45.0,
    'COMPLETED',
    'Beneath the familiar surface lies a forgotten realm carved in obsidian and deep slate. Few who venture past the bedrock ever return.'
  ),
  (
    v_scene2_id,
    v_project_id,
    2,
    'The Ancient City Library',
    'Uncover the lore of the ancient builders',
    'Vast subterranean library with towering basalt pillars and abandoned lecterns',
    'Wonder & Reverence',
    75.0,
    75.0,
    'COMPLETED',
    'Here, in chambers untouched for centuries, the architectural achievements of the first civilization stand silent, bathed in torchlight.'
  ),
  (
    v_scene3_id,
    v_project_id,
    3,
    'The Portal Chamber Awakening',
    'Climactic activation of the reinforced deep slate gateway',
    'Enormous central cavern with an inactive warden portal altar',
    'Tense & Epic',
    60.0,
    60.0,
    'COMPLETED',
    'As the final echoes resonate through the hall, ancient runes ignite along the reinforced frame. The journey to what lies beyond has just begun.'
  )
  ON CONFLICT (project_id, scene_order) DO NOTHING;

  -- 7. Seed Shots
  INSERT INTO public.shots (
    id,
    scene_id,
    project_id,
    shot_order,
    visual_prompt,
    motion_instruction,
    duration_seconds,
    visual_asset_url,
    character_ids,
    status,
    retry_count
  )
  VALUES
  (
    v_shot1_id,
    v_scene1_id,
    v_project_id,
    1,
    'Wide landscape of a colossal cavern, Steve with blocky dark hair and cyan tunic holding a flickering torch on a high ledge. Golden hour volumetric block rays.',
    'DOLLY_FORWARD',
    5.0,
    '/assets/shot_demo_1.mp4',
    ARRAY[v_char_id],
    'COMPLETED',
    0
  ),
  (
    v_shot2_id,
    v_scene1_id,
    v_project_id,
    2,
    'Slow panning camera across cascading water pouring into the dark abyss. Glowing lichen illuminated by warm torchlight glow on deep slate textures.',
    'PAN_RIGHT',
    6.0,
    '/assets/shot_demo_2.mp4',
    ARRAY[]::UUID[],
    'COMPLETED',
    0
  ),
  (
    v_shot3_id,
    v_scene2_id,
    v_project_id,
    3,
    'Steve inspecting an ancient carved stone lectern. Warm rim light catches the cyan tunic and leather tool belt. 35mm anamorphic depth of field.',
    'ZOOM_IN',
    6.5,
    '/assets/shot_demo_3.mp4',
    ARRAY[v_char_id],
    'COMPLETED',
    0
  )
  ON CONFLICT (scene_id, shot_order) DO NOTHING;

  -- 8. Seed Audio Tracks
  INSERT INTO public.audio_tracks (
    project_id,
    scene_id,
    track_type,
    file_url,
    start_time_seconds,
    duration_seconds,
    volume_level,
    ducking_enabled,
    metadata
  )
  VALUES
  (
    v_project_id,
    v_scene1_id,
    'VOICEOVER',
    '/assets/voice_demo.wav',
    0.0,
    45.0,
    1.0,
    TRUE,
    '{"transcript": "Beneath the familiar surface lies a forgotten realm carved in obsidian and deep slate."}'::jsonb
  ),
  (
    v_project_id,
    NULL,
    'MUSIC',
    '/assets/music_demo.wav',
    0.0,
    180.0,
    0.65,
    FALSE,
    '{"genre": "Subterranean Ambient", "tempo": "Adagio"}'::jsonb
  );

  -- 9. Seed Subtitle Track
  INSERT INTO public.subtitle_tracks (
    project_id,
    srt_content,
    vtt_content,
    json_cues
  )
  VALUES
  (
    v_project_id,
    '1
00:00:00,000 --> 00:00:04,500
Beneath the familiar surface lies a forgotten realm

2
00:00:04,500 --> 00:00:09,200
carved in obsidian and deep slate.',
    'WEBVTT

1
00:00:00.000 --> 00:00:04.500
Beneath the familiar surface lies a forgotten realm

2
00:00:04.500 --> 00:00:09.200
carved in obsidian and deep slate.',
    '[
      {"start": 0.0, "end": 4.5, "text": "Beneath the familiar surface lies a forgotten realm"},
      {"start": 4.5, "end": 9.2, "text": "carved in obsidian and deep slate."}
    ]'::jsonb
  );

END $$;
