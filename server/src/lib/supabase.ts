import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

export const isSupabaseConfigured = Boolean(
  env.SUPABASE_URL && 
  env.SUPABASE_SERVICE_ROLE_KEY && 
  !env.SUPABASE_URL.includes('your-project') &&
  env.SUPABASE_URL.startsWith('http') &&
  !env.SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_publishable_') &&
  !env.SUPABASE_SERVICE_ROLE_KEY.includes('your-')
);

export const supabase = createClient(
  env.SUPABASE_URL && env.SUPABASE_URL.startsWith('http') ? env.SUPABASE_URL : 'https://dummy.supabase.co',
  env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_service_role_key'
);
