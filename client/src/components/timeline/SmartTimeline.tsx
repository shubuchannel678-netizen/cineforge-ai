import React, { useRef } from 'react';
import { 
  ZoomIn, ZoomOut, Film, Mic, Music, Radio, 
  Subtitles, Scissors, Layers, RefreshCw 
} from 'lucide-react';
import { TimelineTrack } from './TimelineTrack';
import { VisualClipBlock } from './VisualClipBlock';
import { AudioClipBlock } from './AudioClipBlock';
import { SubtitleTrackBlock } from './SubtitleTrackBlock';
import { useTimelineStore } from '../../store/useTimelineStore';
import type { Project, Shot } from '../../shared/types/index';

interface SmartTimelineProps {
  project: Project;
  onRetryShot: (shotId: string) => void;
}

export const SmartTimeline: React.FC<SmartTimelineProps> = ({ project, onRetryShot }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const {
    currentTime,
    totalDuration,
    zoomLevel,
    selectedShot,
    trackMutes,
    setZoomLevel,
    setCurrentTime,
    setSelectedShot,
    toggleTrackMute,
  } = useTimelineStore();

  // Calculate pixel width based on duration and zoom level (default 30px per second at zoom 1.0)
  const basePxPerSecond = 25 * zoomLevel;
  const totalTimelineWidthPx = Math.max(900, totalDuration * basePxPerSecond);

  // Playhead position in pixels
  const playheadLeftPx = (currentTime / Math.max(1, totalDuration)) * totalTimelineWidthPx;

  // Handle timeline ruler scrub click
  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left + (scrollContainerRef.current?.scrollLeft || 0);
    const newRatio = Math.max(0, Math.min(1, clickX / totalTimelineWidthPx));
    setCurrentTime(newRatio * totalDuration);
  };

  // Extract all shots in flat order
  const allShots: Shot[] = [];
  if (project.scenes) {
    for (const scene of project.scenes) {
      if (scene.shots) {
        allShots.push(...scene.shots);
      }
    }
  }

  // Audio tracks
  const voiceTracks = (project.audio_tracks || []).filter(t => t.track_type === 'VOICEOVER');
  const musicTracks = (project.audio_tracks || []).filter(t => t.track_type === 'MUSIC');
  const sfxTracks = (project.audio_tracks || []).filter(t => t.track_type === 'SFX');
  const subtitleCues = project.subtitle_track?.json_cues || [];

  // Generate ruler tick marks
  const tickIntervalSecs = zoomLevel > 3 ? 1 : (zoomLevel > 1.5 ? 5 : 10);
  const tickCount = Math.floor(totalDuration / tickIntervalSecs);
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => i * tickIntervalSecs);

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col shadow-xl">
      {/* Timeline Controls Header */}
      <div className="p-3 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300 font-bold">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Smart Multi-Track Timeline</span>
          </div>

          <span className="text-slate-600">|</span>

          <div className="text-[11px] font-mono text-slate-400">
            {allShots.length} Shots • {project.scenes?.length || 0} Scenes
          </div>
        </div>

        {/* Zoom & Track Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1 border border-slate-800">
            <button
              onClick={() => setZoomLevel(zoomLevel - 0.25)}
              className="p-1 rounded text-slate-400 hover:text-white transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono px-1.5 text-slate-300 font-semibold">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(zoomLevel + 0.25)}
              className="p-1 rounded text-slate-400 hover:text-white transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Multi-track Scroll Container */}
      <div
        ref={scrollContainerRef}
        className="relative overflow-x-auto overflow-y-hidden select-none bg-slate-950/40"
      >
        {/* Playhead Scrub Needle (spanning all tracks) */}
        <div
          style={{ left: `${playheadLeftPx + 176}px` }} // 176px is track header width
          className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-30 pointer-events-none transition-all duration-75 shadow-lg shadow-rose-500/50"
        >
          {/* Top Handle Flag */}
          <div className="w-3 h-3 bg-rose-500 transform -translate-x-[5px] rotate-45 rounded-sm shadow-md animate-playhead" />
        </div>

        {/* Timecode Ruler Bar */}
        <div className="flex border-b border-slate-800 bg-slate-950/90 h-7 sticky top-0 z-20">
          <div className="w-44 shrink-0 border-r border-slate-800/80 px-3 flex items-center font-mono text-[10px] text-slate-500 uppercase tracking-wider font-bold">
            TIMECODE
          </div>
          <div
            onClick={handleRulerClick}
            style={{ width: `${totalTimelineWidthPx}px` }}
            className="relative h-full cursor-pointer overflow-hidden"
          >
            {ticks.map((t) => {
              const tickPos = (t / totalDuration) * totalTimelineWidthPx;
              const mins = Math.floor(t / 60);
              const secs = Math.floor(t % 60);
              const label = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
              return (
                <div
                  key={t}
                  style={{ left: `${tickPos}px` }}
                  className="absolute top-0 bottom-0 border-l border-slate-800 text-[9px] font-mono text-slate-500 pl-1 pt-1"
                >
                  {label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Track 1: Visuals & Shots */}
        <TimelineTrack
          title="VISUAL CLIPS"
          icon={<Film className="w-4 h-4 text-indigo-400" />}
          isMuted={trackMutes.visual}
          onToggleMute={() => toggleTrackMute('visual')}
        >
          <div style={{ width: `${totalTimelineWidthPx}px` }} className="flex items-center h-full">
            {allShots.map((shot) => {
              const shotWidthPx = (shot.duration_seconds / totalDuration) * totalTimelineWidthPx;
              return (
                <VisualClipBlock
                  key={shot.id}
                  shot={shot}
                  widthPx={shotWidthPx}
                  isSelected={selectedShot?.id === shot.id}
                  onSelect={setSelectedShot}
                  onRetry={(id, e) => {
                    e.stopPropagation();
                    onRetryShot(id);
                  }}
                />
              );
            })}
          </div>
        </TimelineTrack>

        {/* Track 2: Voiceover Narration */}
        <TimelineTrack
          title="VOICEOVER (TTS)"
          icon={<Mic className="w-4 h-4 text-violet-400" />}
          isMuted={trackMutes.voiceover}
          onToggleMute={() => toggleTrackMute('voiceover')}
        >
          <div style={{ width: `${totalTimelineWidthPx}px` }} className="flex items-center h-full">
            {voiceTracks.map((vt) => {
              const trackWidth = (vt.duration_seconds / totalDuration) * totalTimelineWidthPx;
              return (
                <AudioClipBlock
                  key={vt.id}
                  track={vt}
                  widthPx={trackWidth}
                />
              );
            })}
          </div>
        </TimelineTrack>

        {/* Track 3: Background Score */}
        <TimelineTrack
          title="MUSIC SCORE"
          icon={<Music className="w-4 h-4 text-emerald-400" />}
          isMuted={trackMutes.music}
          onToggleMute={() => toggleTrackMute('music')}
        >
          <div style={{ width: `${totalTimelineWidthPx}px` }} className="flex items-center h-full">
            {musicTracks.map((mt) => {
              const trackWidth = (mt.duration_seconds / totalDuration) * totalTimelineWidthPx;
              return (
                <AudioClipBlock
                  key={mt.id}
                  track={mt}
                  widthPx={trackWidth}
                />
              );
            })}
          </div>
        </TimelineTrack>

        {/* Track 4: Sound Effects (SFX) */}
        <TimelineTrack
          title="SFX ATMOSPHERE"
          icon={<Radio className="w-4 h-4 text-amber-400" />}
          isMuted={trackMutes.sfx}
          onToggleMute={() => toggleTrackMute('sfx')}
        >
          <div style={{ width: `${totalTimelineWidthPx}px` }} className="flex items-center h-full">
            {sfxTracks.map((st) => {
              const trackWidth = (st.duration_seconds / totalDuration) * totalTimelineWidthPx;
              return (
                <AudioClipBlock
                  key={st.id}
                  track={st}
                  widthPx={trackWidth}
                />
              );
            })}
          </div>
        </TimelineTrack>

        {/* Track 5: Subtitles */}
        <TimelineTrack
          title="SUBTITLES (SRT)"
          icon={<Subtitles className="w-4 h-4 text-cyan-400" />}
          isMuted={trackMutes.subtitles}
          onToggleMute={() => toggleTrackMute('subtitles')}
        >
          <SubtitleTrackBlock
            cues={subtitleCues}
            totalDuration={totalDuration}
            timelineWidthPx={totalTimelineWidthPx}
          />
        </TimelineTrack>
      </div>
    </div>
  );
};
