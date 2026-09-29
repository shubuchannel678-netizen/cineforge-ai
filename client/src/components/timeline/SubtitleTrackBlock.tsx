import React from 'react';
import type { SubtitleCue } from '../../shared/types/index';

interface SubtitleTrackBlockProps {
  cues: SubtitleCue[];
  totalDuration: number;
  timelineWidthPx: number;
}

export const SubtitleTrackBlock: React.FC<SubtitleTrackBlockProps> = ({
  cues,
  totalDuration,
  timelineWidthPx,
}) => {
  if (!cues || cues.length === 0) {
    return (
      <div className="text-[11px] font-mono text-slate-500 px-4 italic">
        No subtitle cues generated yet
      </div>
    );
  }

  const pxPerSec = timelineWidthPx / Math.max(1, totalDuration);

  return (
    <div className="relative w-full h-[36px] flex items-center">
      {cues.map((cue, idx) => {
        const leftPx = cue.start * pxPerSec;
        const widthPx = Math.max(30, (cue.end - cue.start) * pxPerSec);

        return (
          <div
            key={idx}
            style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
            className="absolute h-[26px] bg-slate-800/80 hover:bg-indigo-900/50 border border-slate-700/80 rounded px-1.5 flex items-center overflow-hidden text-ellipsis whitespace-nowrap cursor-default transition-colors"
            title={`[${cue.start}s - ${cue.end}s]: "${cue.text}"`}
          >
            <span className="text-[10px] font-medium text-slate-200 truncate">
              {cue.text}
            </span>
          </div>
        );
      })}
    </div>
  );
};
