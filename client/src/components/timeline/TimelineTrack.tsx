import React from 'react';
import { Volume2, VolumeX, Eye, EyeOff } from 'lucide-react';

interface TimelineTrackProps {
  title: string;
  icon: React.ReactNode;
  isMuted?: boolean;
  onToggleMute?: () => void;
  children: React.ReactNode;
}

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
  title,
  icon,
  isMuted = false,
  onToggleMute,
  children,
}) => {
  return (
    <div className="flex border-b border-slate-800/80 group">
      {/* Track Left Header (Fixed) */}
      <div className="w-44 shrink-0 bg-slate-950/80 border-r border-slate-800/80 p-2.5 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="text-slate-400 group-hover:text-indigo-400 transition-colors">
            {icon}
          </div>
          <span className="text-xs font-semibold text-slate-300 font-mono tracking-tight">
            {title}
          </span>
        </div>

        {onToggleMute && (
          <button
            onClick={onToggleMute}
            className={`p-1.5 rounded transition-colors ${
              isMuted ? 'text-rose-400 bg-rose-500/10' : 'text-slate-500 hover:text-slate-200'
            }`}
            title={isMuted ? 'Unmute Track' : 'Mute Track'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Track Canvas Lane */}
      <div className="relative flex-1 min-h-[52px] bg-slate-900/30 flex items-center overflow-hidden">
        {children}
      </div>
    </div>
  );
};
