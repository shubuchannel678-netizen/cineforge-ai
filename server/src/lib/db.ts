import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { supabase, isSupabaseConfigured } from './supabase.js';
import type { 
  Project, Scene, Shot, CharacterBible, StyleBible, 
  AudioTrack, SubtitleTrack, GenerationJob, UserProfile, JobStatus 
} from '../shared/types/index.js';

interface DatabaseSchema {
  profiles: UserProfile[];
  projects: Project[];
  character_bibles: CharacterBible[];
  style_bibles: StyleBible[];
  scenes: Scene[];
  shots: Shot[];
  audio_tracks: AudioTrack[];
  subtitle_tracks: SubtitleTrack[];
  generation_jobs: GenerationJob[];
}

const LOCAL_DB_PATH = path.resolve(process.cwd(), 'local_cineforge_db.json');

// Initialize in-memory store
let localDb: DatabaseSchema = {
  profiles: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'creator@cineforge.ai',
      full_name: 'Lead Director',
      tier: 'creator',
      created_at: new Date().toISOString(),
    }
  ],
  projects: [],
  character_bibles: [],
  style_bibles: [],
  scenes: [],
  shots: [],
  audio_tracks: [],
  subtitle_tracks: [],
  generation_jobs: [],
};

// Load saved local data if available
try {
  if (fs.existsSync(LOCAL_DB_PATH)) {
    const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
    localDb = { ...localDb, ...JSON.parse(raw) };
  }
} catch (e) {
  console.warn('[DB] Could not load local database file, using in-memory store.');
}

function persistLocalDb() {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(localDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Failed to persist local database:', err);
  }
}

export const db = {
  // --- Profiles ---
  async getProfile(userId: string): Promise<UserProfile | null> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
    return localDb.profiles.find(p => p.id === userId) || null;
  },

  async upsertProfile(profile: UserProfile): Promise<UserProfile> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('profiles').upsert(profile).select().single();
      if (error) throw error;
      return data;
    }
    const idx = localDb.profiles.findIndex(p => p.id === profile.id);
    if (idx >= 0) {
      localDb.profiles[idx] = { ...localDb.profiles[idx], ...profile, updated_at: new Date().toISOString() };
    } else {
      localDb.profiles.push({ ...profile, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    persistLocalDb();
    return profile;
  },

  // --- Projects ---
  async listProjects(userId: string): Promise<Project[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (err: any) {
        console.warn(`[DB] Supabase listProjects failed (${err.message}), falling back to local DB.`);
      }
    }
    return localDb.projects
      .filter(p => p.user_id === userId)
      .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
  },

  async getProject(projectId: string): Promise<Project | null> {
    if (isSupabaseConfigured) {
      const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      if (error) return null;

      // Join children
      const [scenesRes, charRes, styleRes, audioRes, subRes, jobRes] = await Promise.all([
        supabase.from('scenes').select('*').eq('project_id', projectId).order('scene_order', { ascending: true }),
        supabase.from('character_bibles').select('*').eq('project_id', projectId),
        supabase.from('style_bibles').select('*').eq('project_id', projectId).single(),
        supabase.from('audio_tracks').select('*').eq('project_id', projectId),
        supabase.from('subtitle_tracks').select('*').eq('project_id', projectId).single(),
        supabase.from('generation_jobs').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(50),
      ]);

      const shotsRes = await supabase.from('shots').select('*').eq('project_id', projectId).order('shot_order', { ascending: true });
      const shotsByScene = (shotsRes.data || []).reduce((acc: any, shot: Shot) => {
        if (!acc[shot.scene_id]) acc[shot.scene_id] = [];
        acc[shot.scene_id].push(shot);
        return acc;
      }, {});

      const populatedScenes = (scenesRes.data || []).map((s: Scene) => ({
        ...s,
        shots: shotsByScene[s.id] || []
      }));

      return {
        ...project,
        scenes: populatedScenes,
        character_bibles: charRes.data || [],
        style_bible: styleRes.data || null,
        audio_tracks: audioRes.data || [],
        subtitle_track: subRes.data || null,
        latest_jobs: jobRes.data || [],
      };
    }

    const project = localDb.projects.find(p => p.id === projectId);
    if (!project) return null;

    const scenes = localDb.scenes
      .filter(s => s.project_id === projectId)
      .sort((a, b) => a.scene_order - b.scene_order)
      .map(scene => ({
        ...scene,
        shots: localDb.shots
          .filter(shot => shot.scene_id === scene.id)
          .sort((a, b) => a.shot_order - b.shot_order)
      }));

    return {
      ...project,
      scenes,
      character_bibles: localDb.character_bibles.filter(c => c.project_id === projectId),
      style_bible: localDb.style_bibles.find(s => s.project_id === projectId) || null,
      audio_tracks: localDb.audio_tracks.filter(a => a.project_id === projectId),
      subtitle_track: localDb.subtitle_tracks.find(s => s.project_id === projectId) || null,
      latest_jobs: localDb.generation_jobs
        .filter(j => j.project_id === projectId)
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()),
    };
  },

  async createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project> {
    const newProject: Project = {
      ...project,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('projects').insert(newProject).select().single();
      if (error) throw error;
      return data;
    }

    localDb.projects.push(newProject);
    persistLocalDb();
    return newProject;
  },

  async updateProject(projectId: string, updates: Partial<Project>): Promise<Project> {
    if (isSupabaseConfigured) {
      let { data, error } = await supabase
        .from('projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .select()
        .single();
      if (error && error.message?.includes('error_message')) {
        const { error_message, ...dbUpdates } = updates as any;
        const res = await supabase
          .from('projects')
          .update({ ...dbUpdates, updated_at: new Date().toISOString() })
          .eq('id', projectId)
          .select()
          .single();
        if (res.error) throw res.error;
        return { ...res.data, error_message: error_message ?? null };
      }
      if (error) throw error;
      return data;
    }

    const idx = localDb.projects.findIndex(p => p.id === projectId);
    if (idx === -1) throw new Error('Project not found');
    localDb.projects[idx] = {
      ...localDb.projects[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    persistLocalDb();
    return localDb.projects[idx];
  },

  async deleteProject(projectId: string): Promise<boolean> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) throw error;
      return true;
    }

    localDb.projects = localDb.projects.filter(p => p.id !== projectId);
    localDb.scenes = localDb.scenes.filter(s => s.project_id !== projectId);
    localDb.shots = localDb.shots.filter(s => s.project_id !== projectId);
    localDb.character_bibles = localDb.character_bibles.filter(c => c.project_id !== projectId);
    localDb.style_bibles = localDb.style_bibles.filter(s => s.project_id !== projectId);
    localDb.audio_tracks = localDb.audio_tracks.filter(a => a.project_id !== projectId);
    localDb.subtitle_tracks = localDb.subtitle_tracks.filter(s => s.project_id !== projectId);
    localDb.generation_jobs = localDb.generation_jobs.filter(j => j.project_id !== projectId);
    persistLocalDb();
    return true;
  },

  // --- Character Bibles ---
  async getCharacterBibles(projectId: string): Promise<CharacterBible[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('character_bibles').select('*').eq('project_id', projectId);
      if (error) throw error;
      return data || [];
    }
    return localDb.character_bibles.filter(c => c.project_id === projectId);
  },

  async createCharacterBible(bible: Omit<CharacterBible, 'id' | 'created_at' | 'updated_at'>): Promise<CharacterBible> {
    const newBible: CharacterBible = {
      ...bible,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('character_bibles').insert(newBible).select().single();
      if (error) throw error;
      return data;
    }

    localDb.character_bibles.push(newBible);
    persistLocalDb();
    return newBible;
  },

  async updateCharacterBible(charId: string, updates: Partial<CharacterBible>): Promise<CharacterBible> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('character_bibles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', charId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const idx = localDb.character_bibles.findIndex(c => c.id === charId);
    if (idx === -1) throw new Error('Character bible not found');
    localDb.character_bibles[idx] = {
      ...localDb.character_bibles[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    persistLocalDb();
    return localDb.character_bibles[idx];
  },

  // --- Style Bibles ---
  async getStyleBible(projectId: string): Promise<StyleBible | null> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('style_bibles').select('*').eq('project_id', projectId).maybeSingle();
      if (error) throw error;
      return data;
    }
    return localDb.style_bibles.find(s => s.project_id === projectId) || null;
  },

  async upsertStyleBible(bible: Omit<StyleBible, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<StyleBible> {
    const existing = await this.getStyleBible(bible.project_id);
    const id = existing?.id || bible.id || uuidv4();
    const payload: StyleBible = {
      ...bible,
      id,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('style_bibles').upsert(payload).select().single();
      if (error) throw error;
      return data;
    }

    const idx = localDb.style_bibles.findIndex(s => s.project_id === bible.project_id);
    if (idx >= 0) {
      localDb.style_bibles[idx] = payload;
    } else {
      localDb.style_bibles.push(payload);
    }
    persistLocalDb();
    return payload;
  },

  // --- Scenes ---
  async getScenes(projectId: string): Promise<Scene[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('scenes')
        .select('*')
        .eq('project_id', projectId)
        .order('scene_order', { ascending: true });
      if (error) throw error;
      return data || [];
    }
    return localDb.scenes
      .filter(s => s.project_id === projectId)
      .sort((a, b) => a.scene_order - b.scene_order);
  },

  async createScene(scene: Omit<Scene, 'id' | 'created_at' | 'updated_at'>): Promise<Scene> {
    const newScene: Scene = {
      ...scene,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('scenes').insert(newScene).select().single();
      if (error) throw error;
      return data;
    }

    localDb.scenes.push(newScene);
    persistLocalDb();
    return newScene;
  },

  async updateScene(sceneId: string, updates: Partial<Scene>): Promise<Scene> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('scenes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', sceneId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const idx = localDb.scenes.findIndex(s => s.id === sceneId);
    if (idx === -1) throw new Error('Scene not found');
    localDb.scenes[idx] = {
      ...localDb.scenes[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    persistLocalDb();
    return localDb.scenes[idx];
  },

  // --- Shots ---
  async getShots(projectId: string): Promise<Shot[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('shots')
        .select('*')
        .eq('project_id', projectId)
        .order('shot_order', { ascending: true });
      if (error) throw error;
      return data || [];
    }
    return localDb.shots
      .filter(s => s.project_id === projectId)
      .sort((a, b) => a.shot_order - b.shot_order);
  },

  async getShot(shotId: string): Promise<Shot | null> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('shots').select('*').eq('id', shotId).single();
      if (error) return null;
      return data;
    }
    return localDb.shots.find(s => s.id === shotId) || null;
  },

  async createShot(shot: Omit<Shot, 'id' | 'created_at' | 'updated_at'>): Promise<Shot> {
    const newShot: Shot = {
      ...shot,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('shots').insert(newShot).select().single();
      if (error) throw error;
      return data;
    }

    localDb.shots.push(newShot);
    persistLocalDb();
    return newShot;
  },

  async updateShot(shotId: string, updates: Partial<Shot>): Promise<Shot> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('shots')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', shotId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const idx = localDb.shots.findIndex(s => s.id === shotId);
    if (idx === -1) throw new Error('Shot not found');
    localDb.shots[idx] = {
      ...localDb.shots[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    persistLocalDb();
    return localDb.shots[idx];
  },

  // --- Audio Tracks ---
  async getAudioTracks(projectId: string): Promise<AudioTrack[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('audio_tracks').select('*').eq('project_id', projectId);
      if (error) throw error;
      return data || [];
    }
    return localDb.audio_tracks.filter(a => a.project_id === projectId);
  },

  async createAudioTrack(track: Omit<AudioTrack, 'id' | 'created_at'>): Promise<AudioTrack> {
    const newTrack: AudioTrack = {
      ...track,
      id: uuidv4(),
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('audio_tracks').insert(newTrack).select().single();
      if (error) throw error;
      return data;
    }

    localDb.audio_tracks.push(newTrack);
    persistLocalDb();
    return newTrack;
  },

  // --- Subtitle Tracks ---
  async getSubtitleTrack(projectId: string): Promise<SubtitleTrack | null> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('subtitle_tracks').select('*').eq('project_id', projectId).maybeSingle();
      if (error) throw error;
      return data;
    }
    return localDb.subtitle_tracks.find(s => s.project_id === projectId) || null;
  },

  async upsertSubtitleTrack(track: Omit<SubtitleTrack, 'id' | 'created_at'> & { id?: string }): Promise<SubtitleTrack> {
    const existing = await this.getSubtitleTrack(track.project_id);
    const id = existing?.id || track.id || uuidv4();
    const payload: SubtitleTrack = {
      ...track,
      id,
      created_at: existing?.created_at || new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('subtitle_tracks').upsert(payload).select().single();
      if (error) throw error;
      return data;
    }

    const idx = localDb.subtitle_tracks.findIndex(s => s.project_id === track.project_id);
    if (idx >= 0) {
      localDb.subtitle_tracks[idx] = payload;
    } else {
      localDb.subtitle_tracks.push(payload);
    }
    persistLocalDb();
    return payload;
  },

  // --- Generation Jobs Queue ---
  async enqueueJob(job: Omit<GenerationJob, 'id' | 'created_at' | 'updated_at' | 'status' | 'attempts'> & { status?: JobStatus }): Promise<GenerationJob> {
    const newJob: GenerationJob = {
      ...job,
      id: uuidv4(),
      status: job.status || 'PENDING',
      attempts: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('generation_jobs').insert(newJob).select().single();
        if (error) throw error;
        return data;
      } catch (err: any) {
        console.warn(`[DB] Supabase enqueueJob failed (${err.message}), storing in local DB.`);
      }
    }

    localDb.generation_jobs.push(newJob);
    persistLocalDb();
    return newJob;
  },

  async getNextPendingJob(): Promise<GenerationJob | null> {
    if (isSupabaseConfigured) {
      // Find oldest pending job and atomically lock
      const { data, error } = await supabase
        .from('generation_jobs')
        .select('*')
        .in('status', ['PENDING', 'queued', 'generating'])
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      // If generating, only poll if 3s has passed since last lock
      if (data.status === 'generating' && data.locked_at) {
        const diff = Date.now() - new Date(data.locked_at).getTime();
        if (diff < 3000) return null;
      }

      const nextStatus = data.status === 'generating' ? 'generating' : 'PROCESSING';
      const { data: locked, error: lockErr } = await supabase
        .from('generation_jobs')
        .update({
          status: nextStatus,
          locked_at: new Date().toISOString(),
          attempts: data.attempts + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id)
        .select()
        .single();

      if (lockErr || !locked) return null;
      return locked;
    }

    const job = localDb.generation_jobs
      .filter(j => {
        if (j.status === 'PENDING' || j.status === 'queued') return true;
        if (j.status === 'generating') {
          if (!j.locked_at) return true;
          return Date.now() - new Date(j.locked_at).getTime() >= 3000;
        }
        return false;
      })
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())[0];

    if (!job) return null;

    if (job.status !== 'generating') {
      job.status = 'PROCESSING';
      job.attempts += 1;
    }
    job.locked_at = new Date().toISOString();
    job.updated_at = new Date().toISOString();
    persistLocalDb();
    return job;
  },

  async updateJob(jobId: string, updates: Partial<GenerationJob>): Promise<GenerationJob> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('generation_jobs')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', jobId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const idx = localDb.generation_jobs.findIndex(j => j.id === jobId);
    if (idx === -1) throw new Error('Job not found');
    localDb.generation_jobs[idx] = {
      ...localDb.generation_jobs[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    persistLocalDb();
    return localDb.generation_jobs[idx];
  },

  async getJob(jobId: string): Promise<GenerationJob | null> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('generation_jobs')
        .select('*')
        .eq('id', jobId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      if (data) return data;
    }

    return localDb.generation_jobs.find(j => j.id === jobId) || null;
  },

  async listJobs(projectId: string): Promise<GenerationJob[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('generation_jobs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }

    return localDb.generation_jobs
      .filter(j => j.project_id === projectId)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }
};
