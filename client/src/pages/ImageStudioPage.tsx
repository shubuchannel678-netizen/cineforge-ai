import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Image as ImageIcon, Download, RefreshCw, AlertTriangle, 
  CheckCircle2, Copy, Film, Layers, ArrowRight, ExternalLink 
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

interface ImageJobStatusResponse {
  jobId: string;
  status: 'queued' | 'generating' | 'downloading' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  error: string | null;
  assetUrl: string | null;
  storagePath: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt?: string;
  completedAt?: string;
}

interface ImageConfigResponse {
  configured: boolean;
  model: string;
  provider: string;
}

interface ProjectSummary {
  id: string;
  title: string;
}

export const ImageStudioPage: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [showNegative, setShowNegative] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1' | '4:3' | '3:4'>('16:9');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Fetch provider configuration
  const { data: config, isLoading: isConfigLoading } = useQuery<ImageConfigResponse>({
    queryKey: ['image-config'],
    queryFn: () => apiClient<ImageConfigResponse>('/images/config'),
  });

  // Fetch user projects for video-reference workflow
  const { data: projects } = useQuery<ProjectSummary[]>({
    queryKey: ['user-projects-list'],
    queryFn: () => apiClient<ProjectSummary[]>('/projects'),
  });

  // Poll active generation job status
  const { data: jobStatus, isError: isJobError, error: jobQueryError } = useQuery<ImageJobStatusResponse>({
    queryKey: ['image-job-status', activeJobId],
    queryFn: () => apiClient<ImageJobStatusResponse>(`/images/jobs/${activeJobId}`),
    enabled: Boolean(activeJobId),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      if (s === 'completed' || s === 'failed' || s === 'cancelled') {
        return false;
      }
      return 1500;
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const res = await apiClient<{ jobId: string; status: string }>('/images/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: prompt.trim(),
          negativePrompt: negativePrompt.trim() || undefined,
          aspectRatio,
          projectId: selectedProjectId || undefined,
        }),
      });

      setActiveJobId(res.jobId);
    } catch (err: any) {
      setSubmissionError(err.message || 'Failed to submit image generation job');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(window.location.origin + url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isGenerating = activeJobId && jobStatus && jobStatus.status !== 'completed' && jobStatus.status !== 'failed';

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'queued': return 'Queued in orchestrator...';
      case 'generating': return 'Google Gemini AI synthesizing pixels...';
      case 'downloading': return 'Streaming high-resolution image...';
      case 'uploading': return 'Saving asset to Supabase Storage...';
      case 'completed': return 'Image generation completed!';
      case 'failed': return 'Generation failed';
      default: return 'Initializing...';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
                Real AI Image Studio
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                  Gemini GenAI
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                High-fidelity keyframe generation powered by official Google Gemini & Imagen models
              </p>
            </div>
          </div>
        </div>

        {/* Model Indicator */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono flex items-center gap-2.5">
            <span className={`w-2 h-2 rounded-full ${config?.configured ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <div>
              <span className="text-slate-400">Model: </span>
              <span className="text-slate-200 font-bold">{config?.model || 'gemini-2.5-flash-image'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Alert if Unconfigured */}
      {config && !config.configured && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Real AI Image Generation Not Configured</h4>
            <p className="text-xs text-amber-400/90 mt-1">
              Add a valid <code>GEMINI_API_KEY</code> and optionally <code>IMAGE_MODEL</code> in your backend <code>.env</code> file. No simulated placeholders will be generated.
            </p>
          </div>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Input Form */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleGenerate} className="glass-panel-glow rounded-3xl border border-slate-800/80 p-6 space-y-5">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Image Prompt & Composition
            </h3>

            {/* Prompt input */}
            <div>
              <label htmlFor="image-prompt" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Visual Prompt
              </label>
              <textarea
                id="image-prompt"
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. A futuristic cybernetic vehicle gliding through a rainy neo-Tokyo metropolis, neon reflections, volumetric lighting, ultra-detailed 8k cinematography..."
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all resize-none"
                required
              />
            </div>

            {/* Negative Prompt toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowNegative(!showNegative)}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
              >
                <span>{showNegative ? '− Hide Negative Constraints' : '+ Add Negative Constraints'}</span>
              </button>

              {showNegative && (
                <div className="mt-2 animate-in fade-in duration-200">
                  <textarea
                    rows={2}
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="e.g. blurry, low quality, oversaturated, deformed, cartoon"
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all resize-none"
                  />
                </div>
              )}
            </div>

            {/* Aspect Ratio Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Aspect Ratio
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: '16:9', label: '16:9', desc: 'Landscape' },
                  { id: '9:16', label: '9:16', desc: 'Vertical' },
                  { id: '1:1', label: '1:1', desc: 'Square' },
                  { id: '4:3', label: '4:3', desc: 'Standard' },
                  { id: '3:4', label: '3:4', desc: 'Portrait' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAspectRatio(item.id as any)}
                    className={`py-2.5 px-2 rounded-xl text-center border transition-all ${
                      aspectRatio === item.id
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold font-mono">{item.label}</div>
                    <div className="text-[10px] text-slate-400 tracking-tight">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Project association (Optional) */}
            {projects && projects.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Attach to Project (Optional)
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  <option value="">Standalone Asset (Not tied to project)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Submission Error Banner */}
            {submissionError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {submissionError}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || Boolean(isGenerating) || !prompt.trim()}
              className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-600/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {isSubmitting || isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Synthesizing Image...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>Generate AI Image</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Preview & Status */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-panel-glow rounded-3xl border border-slate-800/80 p-6 flex flex-col min-h-[460px]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-400" />
                Render Canvas & Storage Metadata
              </h3>
              {jobStatus?.status && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase border ${
                  jobStatus.status === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : jobStatus.status === 'failed'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 animate-pulse'
                }`}>
                  {jobStatus.status}
                </span>
              )}
            </div>

            {/* Active Polling Status Bar */}
            {isGenerating && (
              <div className="py-6 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-indigo-300 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    {getStatusText(jobStatus?.status)}
                  </span>
                  <span className="text-slate-400">{jobStatus?.progress || 35}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full transition-all duration-500"
                    style={{ width: `${jobStatus?.progress || 35}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error Message Display */}
            {jobStatus?.status === 'failed' && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 my-4 space-y-1">
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Generation Error
                </div>
                <p className="text-xs text-rose-300/90 font-mono break-all">
                  {jobStatus.error || 'Provider execution failed'}
                </p>
              </div>
            )}

            {/* Preview Card */}
            <div className="flex-1 flex items-center justify-center bg-slate-950/80 rounded-2xl border border-slate-800/80 p-4 relative overflow-hidden my-4">
              {jobStatus?.assetUrl ? (
                <div className="space-y-4 w-full flex flex-col items-center">
                  <img
                    src={jobStatus.assetUrl}
                    alt="AI Generated"
                    className="max-h-[380px] w-auto object-contain rounded-xl shadow-2xl border border-slate-700/50"
                  />
                </div>
              ) : isGenerating ? (
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 animate-pulse">
                    <Sparkles className="w-6 h-6 animate-spin" />
                  </div>
                  <p className="text-sm font-semibold text-slate-200">Generating High-Fidelity Image</p>
                  <p className="text-xs text-slate-500 font-mono max-w-sm">
                    Connecting to Google GenAI pipeline without placeholders...
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-2 text-slate-500">
                  <ImageIcon className="w-12 h-12 text-slate-700 stroke-[1.5]" />
                  <p className="text-sm font-medium text-slate-400">No Image Rendered Yet</p>
                  <p className="text-xs text-slate-600 max-w-xs font-mono">
                    Enter your prompt and click Generate to produce a real Gemini keyframe.
                  </p>
                </div>
              )}
            </div>

            {/* Asset Actions & Storage Meta */}
            {jobStatus?.assetUrl && (
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <a
                      href={jobStatus.assetUrl}
                      download={`cineforge_${jobStatus.jobId}.png`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-colors shadow-md shadow-indigo-600/20"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>

                    <button
                      onClick={() => handleCopyUrl(jobStatus.assetUrl!)}
                      className="px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 flex items-center gap-1.5 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copied ? 'Copied!' : 'Copy URL'}</span>
                    </button>
                  </div>

                  {/* Video Reference Workflow Link */}
                  {selectedProjectId && (
                    <Link
                      to={`/project/${selectedProjectId}`}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                    >
                      <span>Open in Project Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>

                {/* Storage metadata row */}
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-slate-500">Storage: </span>
                    <span className="text-slate-300">{jobStatus.storagePath || 'Local / Supabase Bucket'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">MIME: </span>
                    <span className="text-slate-300">{jobStatus.mimeType || 'image/png'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageStudioPage;
