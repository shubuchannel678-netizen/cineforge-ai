import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { 
  Sparkles, ArrowRight, ArrowLeft, Clapperboard, 
  Layers, Volume2, ShieldCheck, Check, AlertCircle 
} from 'lucide-react';
import { DurationSlider } from '../components/wizard/DurationSlider';
import { StylePresetPicker } from '../components/wizard/StylePresetPicker';
import { BiblePreviewDrawer } from '../components/wizard/BiblePreviewDrawer';
import { createProject } from '../api/projects';
import type { AspectRatio } from '../shared/types/index';

export const CreateWizardPage: React.FC = () => {
  const navigate = useNavigate();

  // Wizard state
  const [step, setStep] = useState<number>(1);

  // Form Fields
  const [title, setTitle] = useState('');
  const [initialPrompt, setInitialPrompt] = useState(
    'A cinematic Minecraft survival story about discovering an ancient underground civilization beneath the deep slate caverns.'
  );
  const [rawScript, setRawScript] = useState('');
  const [targetDurationSeconds, setTargetDurationSeconds] = useState(180); // 3m default
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [visualStyle, setVisualStyle] = useState('Minecraft Lore');
  const [pacing, setPacing] = useState<'Slow & Atmospheric' | 'Balanced & Narrative' | 'Fast & Intense'>('Balanced & Narrative');
  const [enableVoiceover, setEnableVoiceover] = useState(true);
  const [enableMusic, setEnableMusic] = useState(true);
  const [enableSfx, setEnableSfx] = useState(true);
  const [autoDuck, setAutoDuck] = useState(true);
  const [formError, setFormError] = useState('');

  const handleLoadHackathonDemoPreset = () => {
    setTitle('Hackathon Demo');
    setInitialPrompt('A cinematic Minecraft-style ancient jungle temple discovered deep inside a mysterious jungle, dramatic sunlight, camera slowly moves toward the temple, atmospheric fog.');
    setTargetDurationSeconds(10);
    setAspectRatio('16:9');
    setVisualStyle('Minecraft Lore');
    setRawScript('');
    setFormError('');
  };

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: (newProj) => {
      navigate(`/project/${newProj.id}`);
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to initialize project');
    },
  });

  const handleNext = () => {
    setFormError('');
    if (step === 1) {
      if (title.trim().length === 0) {
        setTitle(initialPrompt.slice(0, 35) + '...');
      }
      if (initialPrompt.trim().length < 10) {
        setFormError('Premise prompt must be at least 10 characters.');
        return;
      }
    }
    setStep((prev) => Math.min(3, prev + 1));
  };

  const handleBack = () => {
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleLaunch = () => {
    createMutation.mutate({
      title: title || initialPrompt.slice(0, 40),
      initialPrompt,
      rawScript: rawScript.trim() || undefined,
      targetDurationSeconds,
      aspectRatio,
      visualStyle,
      pacing,
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* Wizard Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-mono font-bold text-indigo-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Autonomous Production Wizard</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          CineForge Video Creator
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
          Specify your story premise and runtime. CineForge calculates scene budgets, generates continuity bibles, and compiles the master video.
        </p>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 pt-4">
          {[
            { num: 1, label: 'Premise & Runtime' },
            { num: 2, label: 'Style & Bibles' },
            { num: 3, label: 'Blueprint & Launch' },
          ].map((st) => (
            <div key={st.num} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-all ${
                  step === st.num
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-500/50'
                    : step > st.num
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {step > st.num ? <Check className="w-3.5 h-3.5" /> : st.num}
              </div>
              <span className={`text-xs font-semibold hidden sm:inline ${step === st.num ? 'text-white' : 'text-slate-500'}`}>
                {st.label}
              </span>
              {st.num < 3 && <div className="w-6 h-0.5 bg-slate-800 hidden sm:block" />}
            </div>
          ))}
        </div>
      </div>

      {formError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Step 1: Concept, Tone, Duration */}
      {step === 1 && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
          {/* Hackathon Demo Quick Preset Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900/60 border border-indigo-500/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Hackathon Demo Preset</span>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono font-medium">10s (6s+4s Veo) • 16:9</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Pre-loads rapid 10s ancient jungle temple prompt (2 native Veo clips: 6s + 4s) minimizing API cost.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLoadHackathonDemoPreset}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all shrink-0 flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load Preset</span>
            </button>
          </div>

          {/* Project Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Project Title (Optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Echoes of the Deep Caverns"
              className="w-full p-3 rounded-xl glass-input text-sm text-slate-200"
            />
          </div>

          {/* Premise Prompt */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Core Premise / Story Idea</span>
              <span className="text-[11px] text-slate-500 font-mono">10 to 4,000 chars</span>
            </label>
            <textarea
              value={initialPrompt}
              onChange={(e) => setInitialPrompt(e.target.value)}
              rows={4}
              placeholder="Describe your video story, key characters, and narrative arcs..."
              className="w-full p-3.5 rounded-xl glass-input text-sm text-slate-200 leading-relaxed font-sans"
            />
          </div>

          {/* Optional Raw Script */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Custom Script (Optional)</span>
              <span className="text-[11px] text-indigo-400 font-mono">If blank, AI writes original narrative</span>
            </label>
            <textarea
              value={rawScript}
              onChange={(e) => setRawScript(e.target.value)}
              rows={2}
              placeholder="Paste custom voiceover script if you already have one..."
              className="w-full p-3 rounded-xl glass-input text-xs text-slate-200 font-mono"
            />
          </div>

          {/* Target Duration Selector & Mathematical Engine */}
          <DurationSlider
            value={targetDurationSeconds}
            onChange={setTargetDurationSeconds}
          />

          {/* Aspect Ratio Picker */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Format & Aspect Ratio
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: '16:9', label: '16:9 Landscape', desc: 'YouTube, Web, TV' },
                { id: '9:16', label: '9:16 Vertical', desc: 'Reels, TikTok, Shorts' },
                { id: '1:1', label: '1:1 Square', desc: 'Social Feeds' },
              ].map((ratio) => (
                <button
                  key={ratio.id}
                  type="button"
                  onClick={() => setAspectRatio(ratio.id as AspectRatio)}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    aspectRatio === ratio.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm ring-1 ring-indigo-500'
                      : 'glass-panel border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-sm">{ratio.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{ratio.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Visual Style & Continuity Bibles */}
      {step === 2 && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
          {/* Style Preset Selector */}
          <StylePresetPicker
            value={visualStyle}
            onChange={setVisualStyle}
          />

          {/* Narrative Pacing */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Narrative Pacing & Camera Rhythm
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'Slow & Atmospheric', desc: 'Contemplative 6–8s shots, ambient score' },
                { id: 'Balanced & Narrative', desc: 'Classic 5–6s cinematic cadence' },
                { id: 'Fast & Intense', desc: 'High-energy 4–5s dynamic camera cuts' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPacing(p.id as any)}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    pacing === p.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500'
                      : 'glass-panel border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-xs sm:text-sm">{p.id}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Continuity Guardrails Preview */}
          <BiblePreviewDrawer
            visualStyle={visualStyle}
            pacing={pacing}
            aspectRatio={aspectRatio}
          />
        </div>
      )}

      {/* Step 3: Audio Layers & Production Kickoff */}
      {step === 3 && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-indigo-400" />
            <span>Audio Architecture & Ducking Envelopes</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="p-3.5 rounded-xl glass-panel border border-slate-800 flex items-center justify-between cursor-pointer">
              <span className="text-xs font-semibold text-slate-200">Synthesize Voiceover Narration</span>
              <input
                type="checkbox"
                checked={enableVoiceover}
                onChange={(e) => setEnableVoiceover(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="p-3.5 rounded-xl glass-panel border border-slate-800 flex items-center justify-between cursor-pointer">
              <span className="text-xs font-semibold text-slate-200">Compose Ambient Background Music</span>
              <input
                type="checkbox"
                checked={enableMusic}
                onChange={(e) => setEnableMusic(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="p-3.5 rounded-xl glass-panel border border-slate-800 flex items-center justify-between cursor-pointer">
              <span className="text-xs font-semibold text-slate-200">Generate Dynamic SFX Atmospheric Cues</span>
              <input
                type="checkbox"
                checked={enableSfx}
                onChange={(e) => setEnableSfx(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="p-3.5 rounded-xl glass-panel border border-slate-800 flex items-center justify-between cursor-pointer">
              <span className="text-xs font-semibold text-slate-200">Auto-Duck Music (-14dB during speech)</span>
              <input
                type="checkbox"
                checked={autoDuck}
                onChange={(e) => setAutoDuck(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>

          {/* Production Blueprint Review Summary */}
          <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 space-y-3 font-mono text-xs">
            <div className="text-indigo-300 font-bold uppercase tracking-wider text-[11px]">
              Production Blueprint Summary
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-300">
              <div>Title: <strong className="text-white">{title || 'Untitled Production'}</strong></div>
              <div>Runtime: <strong className="text-white">{targetDurationSeconds}s ({Math.round(targetDurationSeconds / 60)}m)</strong></div>
              <div>Style: <strong className="text-white">{visualStyle}</strong></div>
              <div>Ratio: <strong className="text-white">{aspectRatio}</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-4">
        {step > 1 ? (
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous Step</span>
          </button>
        ) : <div />}

        {step < 3 ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all active:scale-95"
          >
            <span>Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleLaunch}
            disabled={createMutation.isPending}
            className="flex items-center gap-2 px-8 py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-xl shadow-indigo-600/30 disabled:opacity-50 transition-all active:scale-95"
          >
            <Sparkles className={`w-4 h-4 ${createMutation.isPending ? 'animate-spin' : ''}`} />
            <span>{createMutation.isPending ? 'Initializing Studio Pipeline...' : 'Launch Autonomous Production'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
