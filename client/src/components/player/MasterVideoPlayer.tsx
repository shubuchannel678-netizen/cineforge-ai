import React, { useRef, useEffect, useState } from 'react';
import { 
  Play, Pause, RotateCcw, Volume2, VolumeX, 
  Maximize, SkipBack, SkipForward, Repeat, Sparkles, Film 
} from 'lucide-react';
import { useTimelineStore } from '../../store/useTimelineStore';
import type { Project } from '../../shared/types/index';

interface MasterVideoPlayerProps {
  project: Project;
}

export const MasterVideoPlayer: React.FC<MasterVideoPlayerProps> = ({ project }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    currentTime,
    totalDuration,
    isPlaying,
    isLooping,
    volume,
    isMuted,
    setCurrentTime,
    setIsPlaying,
    togglePlay,
    setIsLooping,
    setVolume,
    toggleMute,
  } = useTimelineStore();

  const [activeSubtitle, setActiveSubtitle] = useState<string>('');

  // Sync video element with store play state
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.play().catch(() => setIsPlaying(false));
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying, setIsPlaying]);

  // Sync video time when user scrubs on timeline
  useEffect(() => {
    if (!videoRef.current) return;
    if (Math.abs(videoRef.current.currentTime - currentTime) > 0.4) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  // Sync volume and mute
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Video timeupdate callback
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);

    // Synchronize subtitle track cue
    if (project.subtitle_track?.json_cues) {
      const activeCue = project.subtitle_track.json_cues.find(
        (c) => t >= c.start && t <= c.end
      );
      setActiveSubtitle(activeCue ? activeCue.text : '');
    }
  };

  const handleEnded = () => {
    if (isLooping && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    } else {
      setIsPlaying(false);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  };

  // Format timecode HH:MM:SS.FF
  const formatTimecode = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30); // 30fps
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(frames).padStart(2, '0')}`;
  };

  const hasMasterVideo = Boolean(project.final_video_url);

  // Find currently active shot based on currentTime
  let currentActiveShot = null;
  let accumulatedTime = 0;
  if (project.scenes) {
    for (const scene of project.scenes) {
      if (scene.shots) {
        for (const shot of scene.shots) {
          const shotDur = Number(shot.duration_seconds) || 6;
          if (currentTime >= accumulatedTime && currentTime <= accumulatedTime + shotDur) {
            currentActiveShot = shot;
            break;
          }
          accumulatedTime += shotDur;
        }
      }
      if (currentActiveShot) break;
    }
  }

  return (
    <div ref={containerRef} className="relative rounded-2xl overflow-hidden glass-panel border border-slate-800/80 shadow-2xl flex flex-col bg-black">
      {/* Video Screen Stage */}
      <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
        {hasMasterVideo ? (
          <video
            ref={videoRef}
            src={project.final_video_url!}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            className="w-full h-full object-contain"
            playsInline
          />
        ) : currentActiveShot?.visual_asset_url?.endsWith('.mp4') ? (
          <video
            ref={videoRef}
            src={currentActiveShot.visual_asset_url}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            className="w-full h-full object-contain"
            playsInline
            autoPlay
            loop
            muted
          />
        ) : currentActiveShot?.visual_asset_url ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={currentActiveShot.visual_asset_url}
              alt={currentActiveShot.visual_prompt}
              className="w-full h-full object-contain"
            />
            <div className="absolute top-4 left-4 px-3 py-1 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-xs font-mono text-indigo-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Shot #{currentActiveShot.shot_order} Keyframe ({currentActiveShot.motion_instruction})</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <Film className="w-14 h-14 mb-3 text-slate-700 animate-pulse" />
            <h4 className="text-sm font-bold text-slate-300">Rendering Stage Ready</h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Click &quot;Generate Video&quot; or &quot;Render Master&quot; to synthesize shots and compile the final high-definition MP4.
            </p>
          </div>
        )}

        {/* Subtitle Overlay Banner */}
        {activeSubtitle && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-[85%] text-center px-4 py-2 rounded-lg bg-black/80 backdrop-blur-md border border-white/15 text-sm sm:text-base font-semibold text-white tracking-wide shadow-2xl transition-all">
            {activeSubtitle}
          </div>
        )}

        {/* Aspect Ratio Guide Watermark */}
        <div className="absolute top-4 right-4 px-2.5 py-1 rounded bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-mono text-slate-300">
          {project.aspect_ratio} • 1080p
        </div>
      </div>

      {/* Control Bar */}
      <div className="p-3.5 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between gap-4">
        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentTime(0)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Jump to Start"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setCurrentTime(Math.max(0, currentTime - 5))}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Rewind 5s"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-transform active:scale-95"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>

          <button
            onClick={() => setCurrentTime(Math.min(totalDuration, currentTime + 5))}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Forward 5s"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`p-2 rounded-lg transition-colors ${
              isLooping ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle Loop"
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Timecode Display */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-white font-bold bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-glow">
            {formatTimecode(currentTime)}
          </span>
          <span className="text-slate-500">/</span>
          <span className="text-slate-400">
            {formatTimecode(totalDuration)}
          </span>
        </div>

        {/* Right Tools: Volume & Fullscreen */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-16 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Fullscreen"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
