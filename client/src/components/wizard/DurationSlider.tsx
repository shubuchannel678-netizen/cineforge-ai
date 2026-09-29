import React from 'react';
import * as Slider from '@radix-ui/react-slider';
import { Clock, Calculator, BookOpen, Film, Clapperboard } from 'lucide-react';

interface DurationSliderProps {
  value: number; // in seconds
  onChange: (value: number) => void;
}

export const DurationSlider: React.FC<DurationSliderProps> = ({ value, onChange }) => {
  const presets = [
    { label: '10s', seconds: 10, desc: 'Demo (6s+4s)' },
    { label: '15s', seconds: 15, desc: 'Demo (3 shots)' },
    { label: '30s', seconds: 30, desc: 'Quick Teaser' },
    { label: '1m', seconds: 60, desc: 'Reels / Shorts' },
    { label: '3m', seconds: 180, desc: 'Trailer / Song' },
    { label: '5m', seconds: 300, desc: 'Deep Overview' },
    { label: '12m', seconds: 720, desc: 'YouTube Standard' },
    { label: '35m', seconds: 2100, desc: 'Documentary Feature' },
  ];

  // Mathematical pacing calculations:
  // Narration: 140 WPM
  const wordsTarget = Math.round((value / 60) * 140);
  
  // Shots: avg 6 seconds per shot
  const estimatedShots = Math.max(1, Math.round(value / 6.0));
  
  // Scenes: ~100-150s per scene for long-form, 20-30s for short
  let estimatedScenes = 1;
  if (value <= 60) estimatedScenes = Math.max(1, Math.round(value / 20));
  else if (value <= 300) estimatedScenes = Math.max(3, Math.round(value / 60));
  else if (value <= 900) estimatedScenes = Math.max(6, Math.round(value / 100));
  else estimatedScenes = Math.min(24, Math.max(10, Math.round(value / 150)));

  // Acts
  const estimatedActs = value > 600 ? 4 : (value > 180 ? 3 : 2);

  const formatDisplayTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hrs}h ${remainingMins}m`;
    }
    return mins > 0 ? `${mins}m ${s > 0 ? `${s}s` : ''}` : `${s}s`;
  };

  return (
    <div className="space-y-6">
      {/* Preset Buttons */}
      <div>
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2.5">
          Select Duration Preset
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {presets.map((preset) => {
            const isSelected = value === preset.seconds;
            return (
              <button
                key={preset.seconds}
                type="button"
                onClick={() => onChange(preset.seconds)}
                className={`p-3 rounded-xl border text-center transition-all duration-200 ${
                  isSelected
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-500'
                    : 'glass-panel border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="font-extrabold text-sm">{preset.label}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{preset.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Slider */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
            <Clock className="w-4 h-4 text-indigo-400" />
            Precise Runtime Scrubbing
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl font-extrabold text-white text-glow">
              {formatDisplayTime(value)}
            </span>
            <span className="text-xs font-mono text-slate-500">({value}s)</span>
          </div>
        </div>

        <Slider.Root
          className="relative flex items-center select-none touch-none w-full h-5 cursor-pointer"
          value={[value]}
          onValueChange={(vals) => onChange(vals[0])}
          max={3600}
          min={10}
          step={5}
        >
          <Slider.Track className="bg-slate-800 relative grow rounded-full h-2 overflow-hidden">
            <Slider.Range className="absolute bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full h-full" />
          </Slider.Track>
          <Slider.Thumb className="block w-5 h-5 bg-white shadow-lg shadow-indigo-500/50 rounded-full hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-transform" />
        </Slider.Root>

        <div className="flex justify-between text-[11px] font-mono text-slate-500">
          <span>10s (Demo)</span>
          <span>1m (Short)</span>
          <span>5m (Mid)</span>
          <span>15m</span>
          <span>35m (Doc)</span>
          <span>60m (Master)</span>
        </div>
      </div>

      {/* Real-time Mathematical Budget Engine */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-panel p-3.5 rounded-xl border border-slate-800/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400">Script Word Budget</div>
            <div className="text-sm font-bold text-white font-mono">~{wordsTarget.toLocaleString()} words</div>
            <div className="text-[9px] text-slate-500">@ 140 words/min</div>
          </div>
        </div>

        <div className="glass-panel p-3.5 rounded-xl border border-slate-800/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400">Narrative Structure</div>
            <div className="text-sm font-bold text-white font-mono">{estimatedActs} Acts</div>
            <div className="text-[9px] text-slate-500">Classical 3-Act Curve</div>
          </div>
        </div>

        <div className="glass-panel p-3.5 rounded-xl border border-slate-800/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400">Scene Partitioning</div>
            <div className="text-sm font-bold text-white font-mono">{estimatedScenes} Scenes</div>
            <div className="text-[9px] text-slate-500">~{Math.round(value / estimatedScenes)}s / scene</div>
          </div>
        </div>

        <div className="glass-panel p-3.5 rounded-xl border border-slate-800/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Clapperboard className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400">Shot Decomposition</div>
            <div className="text-sm font-bold text-white font-mono">~{estimatedShots} Shots</div>
            <div className="text-[9px] text-emerald-400 font-medium">5–8s per AI Clip</div>
          </div>
        </div>
      </div>

      {/* Veo Duration Architecture Callout */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Clapperboard className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            <strong className="text-white">Orchestration Rule:</strong> Requested Final Duration: <span className="text-indigo-400 font-mono font-bold">{formatDisplayTime(value)}</span>
          </span>
        </div>
        <div className="text-[11px] text-slate-400 bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-700/60 font-mono">
          Individual AI Clip Duration: <span className="text-emerald-400 font-bold">5.0s – 8.0s</span> (Veo Generative Engine)
        </div>
      </div>
    </div>
  );
};
