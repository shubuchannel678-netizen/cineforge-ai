import React from 'react';
import { Mic, Music, Volume2, Radio } from 'lucide-react';
import type { AudioTrack } from '../../shared/types/index';

interface AudioClipBlockProps {
  track: AudioTrack;
  widthPx: number;
}

export const AudioClipBlock: React.FC<AudioClipBlockProps> = ({ track, widthPx }) => {
  const isVoice = track.track_type === 'VOICEOVER';
  const isMusic = track.track_type === 'MUSIC';
  const isSfx = track.track_type === 'SFX';

  const bgStyles = isVoice
    ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300'
    : isMusic
    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
    : 'bg-amber-950/40 border-amber-500/40 text-amber-300';

  return (
    <div
      style={{ width: `${Math.max(80, widthPx)}px` }}
      className={`h-[40px] shrink-0 border rounded-lg mx-0.5 relative overflow-hidden flex items-center px-2.5 justify-between select-none ${bgStyles}`}
    >
      {/* Waveform graphic imitation */}
      <div className="absolute inset-0 flex items-center justify-around opacity-30 pointer-events-none px-2">
        {Array.from({ length: Math.min(30, Math.floor(widthPx / 8)) }).map((_, i) => {
          const heightPct = Math.sin(i * 0.8) * 35 + 50;
          return (
            <div
              key={i}
              className="w-1 bg-current rounded-full"
              style={{ height: `${heightPct}%` }}
            />
          );
        })}
      </div>

      {/* Info label */}
      <div className="relative z-10 flex items-center gap-1.5 font-mono text-[10px] font-bold">
        {isVoice && <Mic className="w-3 h-3 text-indigo-400" />}
        {isMusic && <Music className="w-3 h-3 text-emerald-400" />}
        {isSfx && <Radio className="w-3 h-3 text-amber-400" />}
        <span>{track.track_type}</span>
      </div>

      <div className="relative z-10 flex items-center gap-1.5 font-mono text-[9px] text-slate-400">
        {track.ducking_enabled && (
          <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[8px] font-bold">
            -14dB DUCK
          </span>
        )}
        <span>{track.duration_seconds}s</span>
      </div>
    </div>
  );
};
