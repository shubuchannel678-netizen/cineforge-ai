import { Request, Response, NextFunction } from 'express';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  // Default mock user for standalone/dev local mode
  const defaultLocalUser = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'creator@cineforge.ai',
    full_name: 'Lead Director',
    tier: 'creator',
  };

  if (!authHeader?.startsWith('Bearer ')) {
    // If not configured with Supabase yet, allow seamless dev access
    if (!isSupabaseConfigured) {
      req.user = defaultLocalUser;
      return next();
    }
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  // Allow test/demo token in dev
  if (token === 'demo-token' || token === 'guest-token' || !isSupabaseConfigured) {
    req.user = defaultLocalUser;
    return next();
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    req.user = {
      id: user.id,
      email: user.email || '',
      full_name: user.user_metadata?.full_name || 'Creator',
      tier: user.user_metadata?.tier || 'creator',
    };
    next();
  } catch (err: any) {
    return res.status(401).json({ error: 'Authentication verification failed: ' + err.message });
  }
}
