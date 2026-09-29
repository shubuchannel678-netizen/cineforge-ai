import React, { useState, useEffect } from 'react';
import { 
  X, RefreshCw, Save, Camera, Clock, AlertTriangle, 
  Sparkles, CheckCircle2, Film, Image as ImageIcon 
} from 'lucide-react';
import { useTimelineStore } from '../../store/useTimelineStore';
import { apiClient } from '../../api/client';
import type { Shot, ShotCameraMotion } from '../../shared/types/index';

interface ShotInspectorModalProps {
  onRetry: (shotId: string, customPrompt?: string, motion?: string) => void;
  onUpdate: (shotId: string, data: any) => void;
  isRetrying: boolean;
}

export const ShotInspectorModal: React.FC<ShotInspectorModalProps> = ({
  onRetry,
  onUpdate,
  isRetrying,
}) => {
  const { selectedShot, setSelectedShot } = useTimelineStore();
  const [prompt, setPrompt] = useState('');
  const [motion, setMotion] = useState<ShotCameraMotion>('STATIC');
  const [duration, setDuration] = useState(5);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedShot) {
      setPrompt(selectedShot.visual_prompt);
      setMotion(selectedShot.motion_instruction);
      setDuration(selectedShot.duration_seconds);
    }
  }, [selectedShot]);

  if (!selectedShot) return null;

  const cameraMotions: ShotCameraMotion[] = [
    'STATIC', 'PAN_LEFT', 'PAN_RIGHT', 'TILT_UP', 'TILT_DOWN', 
    'ZOOM_IN', 'ZOOM_OUT', 'DOLLY_FORWARD', 'ORBIT'
  ];

  const handleSave = () => {
    onUpdate(selectedShot.id, {
      visualPrompt: prompt,
      motionInstruction: motion,
      durationSeconds: duration,
    });
  };

  const handleRegenerate = () => {
    onRetry(selectedShot.id, prompt, motion);
  };

  const handleGenerateReferenceImage = async () => {
    if (!selectedShot) return;
    setIsGeneratingImage(true);
    setImageError(null);
    try {
      const res = await apiClient<{ jobId: string }>('/images/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: prompt || selectedShot.visual_prompt,
          aspectRatio: '16:9',
          projectId: selectedShot.project_id,
          shotId: selectedShot.id,
        }),
      });

      // Poll until completed
      const pollTimer = setInterval(async () => {
        try {
          const statusRes = await apiClient<any>(`/images/jobs/${res.jobId}`);
          if (statusRes.status === 'completed' && statusRes.assetUrl) {
            clearInterval(pollTimer);
            setIsGeneratingImage(false);
            onUpdate(selectedShot.id, {
              visual_asset_url: statusRes.assetUrl,
            });
            setSelectedShot({
              ...selectedShot,
              visual_asset_url: statusRes.assetUrl,
            });
          } else if (statusRes.status === 'failed') {
            clearInterval(pollTimer);
            setIsGeneratingImage(false);
            setImageError(statusRes.error || 'Failed to generate reference image');
          }
        } catch (e: any) {
          clearInterval(pollTimer);
          setIsGeneratingImage(false);
          setImageError(e.message);
        }
      }, 1500);
    } catch (err: any) {
      setIsGeneratingImage(false);
      setImageError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl glass-panel-glow rounded-3xl border border-slate-700/80 p-6 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white">Shot Inspector</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  #{selectedShot.shot_order}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">ID: {selectedShot.id}</p>
            </div>
          </div>

          <button
            onClick={() => setSelectedShot(null)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="py-4 space-y-4 overflow-y-auto pr-1">
          {/* Failure Alert Banner (if failed) */}
          {(selectedShot.status === 'FAILED' || selectedShot.status === 'failed') && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-bold">Shot Generation Encountered an Error</p>
                <p className="text-rose-400/90 mt-0.5">
                  {selectedShot.error_message || 'Media synthesis worker timeout or connection error. You can modify prompt parameters and retry below.'}
                </p>
              </div>
            </div>
          )}

          {/* Visual Asset Preview */}
          {selectedShot.visual_asset_url && (
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video relative flex items-center justify-center">
              {selectedShot.visual_asset_url.endsWith('.mp4') ? (
                <video
                  src={selectedShot.visual_asset_url}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={selectedShot.visual_asset_url}
                  alt={selectedShot.visual_prompt}
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          )}

          {/* Visual Prompt Editor */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Visual Prompt & Continuity Directives</span>
              <span className="text-[10px] text-indigo-400 font-mono">Bible Injected</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="w-full p-3 rounded-xl glass-input text-xs text-slate-200 leading-relaxed font-mono"
              placeholder="Enter visual camera prompt..."
            />
          </div>

          {/* Controls Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Motion Instruction */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-indigo-400" />
                <span>Camera Motion</span>
              </label>
              <select
                value={motion}
                onChange={(e) => setMotion(e.target.value as ShotCameraMotion)}
                className="w-full p-2.5 rounded-xl glass-input text-xs text-slate-200 font-mono"
              >
                {cameraMotions.map((m) => (
                  <option key={m} value={m} className="bg-slate-900 text-slate-200">
                    {m.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>AI Clip Duration</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">Veo (5-8s)</span>
              </label>
              <input
                type="number"
                min={4}
                max={8}
                step={0.5}
                value={duration}
                onChange={(e) => setDuration(parseFloat(e.target.value))}
                className="w-full p-2.5 rounded-xl glass-input text-xs text-slate-200 font-mono"
              />
            </div>
          </div>

          {/* Telemetry info */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>Status: <strong className="text-slate-200">{selectedShot.status}</strong></span>
            <span>Retries: <strong className="text-indigo-300">{selectedShot.retry_count || 0}</strong></span>
            <span>Motion: <strong className="text-slate-200">{selectedShot.motion_instruction}</strong></span>
          </div>

          {/* Reference Image Generation Error (if any) */}
          {imageError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{imageError}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Save</span>
            </button>

            <button
              type="button"
              onClick={handleGenerateReferenceImage}
              disabled={isGeneratingImage || isRetrying}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all disabled:opacity-50"
            >
              <ImageIcon className={`w-3.5 h-3.5 ${isGeneratingImage ? 'animate-spin' : ''}`} />
              <span>{isGeneratingImage ? 'Generating Image...' : 'AI Reference Image'}</span>
            </button>
          </div>

          <button
            onClick={handleRegenerate}
            disabled={isRetrying || isGeneratingImage}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-600/25 disabled:opacity-50 transition-all active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>Regenerate This Shot Only</span>
          </button>
        </div>
      </div>
    </div>
  );
};
