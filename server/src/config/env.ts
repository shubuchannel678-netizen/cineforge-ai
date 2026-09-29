import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Candidate paths for server/.env
const candidateEnvPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), 'server', '.env'),
  path.resolve(process.cwd(), '.env'),
];

export function loadEnvironment(): void {
  for (const p of candidateEnvPaths) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
      break;
    }
  }
}

// Initial load
loadEnvironment();

export const env = {
  get PORT(): number {
    return parseInt(process.env.PORT || '5000', 10);
  },
  get NODE_ENV(): string {
    return process.env.NODE_ENV || 'development';
  },
  get CLIENT_URL(): string {
    return process.env.CLIENT_URL || 'http://localhost:5173';
  },
  
  // Google Gemini API Key
  get GEMINI_API_KEY(): string {
    return process.env.GEMINI_API_KEY || '';
  },
  
  // Supabase
  get SUPABASE_URL(): string {
    return process.env.SUPABASE_URL || '';
  },
  get SUPABASE_ANON_KEY(): string {
    return process.env.SUPABASE_ANON_KEY || '';
  },
  get SUPABASE_SERVICE_ROLE_KEY(): string {
    return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  },
  get SUPABASE_STORAGE_BUCKET(): string {
    return process.env.SUPABASE_STORAGE_BUCKET || 'cineforge-assets';
  },
  
  // Media Synthesis Provider Keys & Models
  get VEO_MODEL(): string {
    return process.env.VEO_MODEL || 'veo-3.1-generate-preview';
  },
  get IMAGE_MODEL(): string {
    return process.env.IMAGE_MODEL || 'gemini-2.5-flash-image';
  },
  get TTS_API_KEY(): string {
    return process.env.TTS_API_KEY || '';
  },
  get IMAGE_GEN_API_KEY(): string {
    return process.env.IMAGE_GEN_API_KEY || '';
  },
  get VIDEO_GEN_API_KEY(): string {
    return process.env.VIDEO_GEN_API_KEY || '';
  },
  
  // FFmpeg Paths
  get FFMPEG_PATH(): string {
    return process.env.FFMPEG_PATH || '';
  },
  get FFPROBE_PATH(): string {
    return process.env.FFPROBE_PATH || '';
  },
};

