import { create } from 'zustand';
import type { Shot } from '../shared/types/index';

interface TimelineState {
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  isLooping: boolean;
  zoomLevel: number; // 1 to 10
  volume: number;
  isMuted: boolean;
  selectedShot: Shot | null;
  trackMutes: {
    visual: boolean;
    voiceover: boolean;
    music: boolean;
    sfx: boolean;
    subtitles: boolean;
  };

  // Actions
  setCurrentTime: (time: number) => void;
  setTotalDuration: (duration: number) => void;
  setIsPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  setIsLooping: (looping: boolean) => void;
  setZoomLevel: (zoom: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setSelectedShot: (shot: Shot | null) => void;
  toggleTrackMute: (track: 'visual' | 'voiceover' | 'music' | 'sfx' | 'subtitles') => void;
}

export const useTimelineStore = create<TimelineState>((set) => ({
  currentTime: 0,
  totalDuration: 60,
  isPlaying: false,
  isLooping: false,
  zoomLevel: 1.5,
  volume: 1,
  isMuted: false,
  selectedShot: null,
  trackMutes: {
    visual: false,
    voiceover: false,
    music: false,
    sfx: false,
    subtitles: false,
  },

  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  setTotalDuration: (totalDuration) => set({ totalDuration }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setIsLooping: (isLooping) => set({ isLooping }),
  setZoomLevel: (zoomLevel) => set({ zoomLevel: Math.max(0.5, Math.min(10, zoomLevel)) }),
  setVolume: (volume) => set({ volume }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setSelectedShot: (selectedShot) => set({ selectedShot }),
  toggleTrackMute: (track) => set((state) => ({
    trackMutes: {
      ...state.trackMutes,
      [track]: !state.trackMutes[track],
    }
  })),
}));
