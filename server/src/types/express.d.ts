import { UserProfile } from '../shared/types/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: UserProfile | { id: string; email?: string; [key: string]: any };
    }
  }
}

export {};
