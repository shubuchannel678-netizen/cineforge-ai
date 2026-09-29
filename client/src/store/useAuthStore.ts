import { create } from 'zustand';
import type { UserProfile } from '../shared/types/index';

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: UserProfile) => void;
  logout: () => void;
  loginAsDemo: () => void;
}

const DEFAULT_USER: UserProfile = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'director@cineforge.ai',
  full_name: 'Lead Director',
  tier: 'Creator Pro',
};

export const useAuthStore = create<AuthState>((set) => {
  const savedToken = localStorage.getItem('cineforge_auth_token') || 'demo-token';
  const hasSavedToken = Boolean(savedToken);

  return {
    user: hasSavedToken ? DEFAULT_USER : null,
    token: savedToken,
    isAuthenticated: hasSavedToken,

    login: (token, user) => {
      localStorage.setItem('cineforge_auth_token', token);
      set({ token, user, isAuthenticated: true });
    },

    logout: () => {
      localStorage.removeItem('cineforge_auth_token');
      set({ token: null, user: null, isAuthenticated: false });
    },

    loginAsDemo: () => {
      localStorage.setItem('cineforge_auth_token', 'demo-token');
      set({ token: 'demo-token', user: DEFAULT_USER, isAuthenticated: true });
    },
  };
});
