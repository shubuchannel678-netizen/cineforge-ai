import React from 'react';
import { Camera, AlertCircle, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';
import type { Shot } from '../../shared/types/index';

interface VisualClipBlockProps {
  shot: Shot;
  widthPx: number;
  isSelected: boolean;
  onSelect: (shot: Shot) => void;
  onRetry: (shotId: string, e: React.MouseEvent) => void;
}

export const VisualClipBlock: React.FC<VisualClipBlockProps> = ({
  shot,
  widthPx,
  isSelected,
  onSelect,
  onRetry,
}) => {
  const getStatusBorder = () => {
    switch (shot.status) {
      case 'COMPLETED':
      case 'completed':
        return isSelected 
          ? 'border-indigo-400 ring-2 ring-indigo-500/40 bg-indigo-950/30' 
          : 'border-slate-700/80 hover:border-slate-500 bg-slate-900/60';
      case 'PROCESSING':
      case 'generating':
      case 'downloading':
      case 'uploading':
      case 'processing':
        return 'border-amber-500/60 ring-1 ring-amber-500/30 bg-amber-950/30 animate-pulse';
      case 'FAILED':
      case 'failed':
        return 'border-rose-500 ring-1 ring-rose-500/40 bg-rose-950/40';
      default:
        return 'border-slate-800 bg-slate-900/40';
    }
  };

  const isCompleted = shot.status === 'COMPLETED' || shot.status === 'completed';
  const isProcessing = ['PROCESSING', 'processing', 'generating', 'downloading', 'uploading'].includes(shot.status);
  const isFailed = shot.status === 'FAILED' || shot.status === 'failed';

  return (
    <div
      onClick={() => onSelect(shot)}
      style={{ width: `${Math.max(60, widthPx)}px` }}
      className={`h-[48px] shrink-0 border rounded-lg mx-0.5 relative cursor-pointer overflow-hidden transition-all duration-150 flex items-center justify-between p-1.5 select-none ${getStatusBorder()}`}
      title={`Shot #${shot.shot_order}: ${shot.visual_prompt}${shot.error_message ? `\nError: ${shot.error_message}` : ''}`}
    >
      {/* Background keyframe thumbnail if available */}
      {shot.visual_asset_url && (
        <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
          <img
            src={shot.visual_asset_url}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Left Info: Shot # and Duration */}
      <div className="relative z-10 flex flex-col justify-between h-full">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold font-mono text-slate-200">
            #{shot.shot_order}
          </span>
          <span className="text-[9px] font-mono text-indigo-300">
            {shot.motion_instruction.replace('_', ' ')}
          </span>
          {isFailed && (
            <span className="text-[8px] font-mono font-bold text-rose-300 bg-rose-950/90 border border-rose-600/50 px-1 py-0.5 rounded uppercase">
              FAILED
            </span>
          )}
        </div>
        <span className="text-[9px] font-mono text-slate-400">
          {shot.duration_seconds}s
        </span>
      </div>

      {/* Right Info: Status Icon or Retry Action */}
      <div className="relative z-10 flex items-center gap-1">
        {isCompleted && (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        )}

        {isProcessing && (
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
        )}

        {isFailed && (
          <div className="flex items-center gap-1">
            <span title={shot.error_message || 'Shot failed'}>
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            </span>
            <button
              onClick={(e) => onRetry(shot.id, e)}
              className="p-1 rounded bg-rose-600/80 hover:bg-rose-500 text-white text-[9px] font-semibold transition-colors"
              title={shot.error_message ? `Error: ${shot.error_message}. Click to retry.` : "Regenerate Failed Shot"}
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
