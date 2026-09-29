import React, { useState } from 'react';
import { 
  Sparkles, Clapperboard, Download, CheckCircle, 
  Clock, RefreshCw, AlertCircle, FileText, Share2 
} from 'lucide-react';
import { Badge } from '../common/Badge';
import type { Project, ProjectProgressResponse, ExportResponse } from '../../shared/types/index';

interface PipelineProgressHeaderProps {
  project: Project;
  progress?: ProjectProgressResponse;
  onGenerate: () => void;
  onRender: () => void;
  onExport: () => Promise<ExportResponse>;
  onRetryFailed?: () => void;
  isGenerating: boolean;
  isRendering: boolean;
  isRetryingFailed?: boolean;
}

export const PipelineProgressHeader: React.FC<PipelineProgressHeaderProps> = ({
  project,
  progress,
  onGenerate,
  onRender,
  onExport,
  onRetryFailed,
  isGenerating,
  isRendering,
  isRetryingFailed = false,
}) => {
  const [exportData, setExportData] = useState<ExportResponse | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const stages = [
    { key: 'STORY', label: 'Story Analysis' },
    { key: 'SCENES', label: 'Scene Planning' },
    { key: 'ASSETS', label: 'Asset Synthesis' },
    { key: 'AUDIO', label: 'Audio & Ducking' },
    { key: 'RENDER', label: 'Master Assembly' },
  ];

  const projectShots: Array<{ id: string; status: string; errorMessage?: string | null }> = [];
  if (project.scenes && project.scenes.length > 0) {
    for (const sc of project.scenes) {
      if (sc.shots) {
        for (const sh of sc.shots) {
          projectShots.push({
            id: sh.id,
            status: sh.status,
            errorMessage: sh.error_message,
          });
        }
      }
    }
  } else if (progress?.scenes) {
    for (const sc of progress.scenes) {
      if (sc.shots) {
        for (const sh of sc.shots) {
          projectShots.push({
            id: sh.id,
            status: sh.status,
            errorMessage: sh.errorMessage,
          });
        }
      }
    }
  }

  const failedShots = projectShots.filter(s => s.status === 'FAILED' || s.status === 'failed');
  const completedShots = projectShots.filter(s => s.status === 'COMPLETED' || s.status === 'completed');
  const hasFailedShots = failedShots.length > 0 || (progress?.failedJobsCount !== undefined && progress.failedJobsCount > 0);
  const isFailed = project.status === 'FAILED' || hasFailedShots;

  const rawErrorMessage = 
    progress?.errorMessage || 
    project.error_message || 
    failedShots.find(s => s.errorMessage)?.errorMessage || 
    null;

  let activeErrorMessage = rawErrorMessage;
  if (rawErrorMessage && typeof rawErrorMessage === 'string' && (rawErrorMessage.startsWith('{') || rawErrorMessage.includes('"error"'))) {
    try {
      const parsed = JSON.parse(rawErrorMessage);
      if (parsed?.error?.message) {
        activeErrorMessage = parsed.error.message;
      }
    } catch {}
  }

  // Redact any potential API key patterns from error message
  if (typeof activeErrorMessage === 'string') {
    activeErrorMessage = activeErrorMessage.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');
    activeErrorMessage = activeErrorMessage.replace(/AQ\.[0-9A-Za-z-_]{40,}/g, '[REDACTED_API_KEY]');
  }

  const isQuotaExhausted = Boolean(
    activeErrorMessage && 
    (activeErrorMessage.includes('429') || 
     activeErrorMessage.includes('quota') || 
     activeErrorMessage.includes('RESOURCE_EXHAUSTED') ||
     activeErrorMessage.includes('exceeded your current quota'))
  );

  const getStageStatus = (stageIndex: number) => {
    const pct = project.progress_percentage || 0;
    if (project.status === 'COMPLETED') return 'completed';
    if (project.status === 'FAILED' && pct < (stageIndex + 1) * 20 && pct >= stageIndex * 20) return 'failed';
    if (pct >= (stageIndex + 1) * 20) return 'completed';
    if (pct >= stageIndex * 20) return 'active';
    return 'pending';
  };

  const handleExportClick = async () => {
    setIsExporting(true);
    try {
      const data = await onExport();
      setExportData(data);
      setShowExportModal(true);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const formatSecs = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return mins > 0 ? `${mins}m ${s > 0 ? `${s}s` : ''}` : `${s}s`;
  };

  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 space-y-4">
      {/* Top Row: Title, Target Runtime, and Action CTAs */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              {project.title}
            </h1>
            <Badge status={project.status} />
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-900 border border-slate-800 text-indigo-400">
              {project.visual_style}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1.5 font-mono">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Target: {formatSecs(project.target_duration_seconds)}
            </span>
            <span>•</span>
            <span>Aspect Ratio: {project.aspect_ratio}</span>
            <span>•</span>
            <span>Pacing: {project.pacing}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 self-stretch md:self-auto flex-wrap sm:flex-nowrap">
          {/* Retry Failed Shots CTA */}
          {(hasFailedShots || isFailed) && onRetryFailed && (
            <button
              onClick={onRetryFailed}
              disabled={isRetryingFailed || isGenerating}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 disabled:opacity-50 transition-all shadow-md shadow-rose-900/20 cursor-pointer"
              title="Retry only failed shots without resetting completed shots"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetryingFailed ? 'animate-spin' : ''}`} />
              <span>{isRetryingFailed ? 'Retrying...' : `Retry Failed Shots (${failedShots.length || 'All'})`}</span>
            </button>
          )}

          {/* Generate / Orchestrate CTA */}
          <button
            onClick={onGenerate}
            disabled={isGenerating || project.status === 'GENERATING'}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 transition-all"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : 'text-indigo-400'}`} />
            <span>{isGenerating ? 'Orchestrating...' : 'Generate Shots'}</span>
          </button>

          {/* Render Master MP4 CTA */}
          <button
            onClick={onRender}
            disabled={isRendering || isGenerating || project.status === 'GENERATING'}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-600/25 disabled:opacity-50 transition-all active:scale-95"
          >
            <Clapperboard className={`w-3.5 h-3.5 ${isRendering ? 'animate-spin' : ''}`} />
            <span>{isRendering ? 'Rendering Master...' : 'Render Master MP4'}</span>
          </button>

          {/* Export Assets Dropdown / Modal CTA */}
          <button
            onClick={handleExportClick}
            disabled={isExporting}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            title="Export Video & Subtitles"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Provider & Telemetry Badge Bar (TASK 7 UI Requirement) */}
      <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
          <span className="text-slate-500">Provider:</span>
          <strong className="text-indigo-200">Google Veo</strong>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
          <span className="text-slate-500">Generation:</span>
          <strong className="text-emerald-300">REAL</strong>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
          <span className="text-slate-500">Quota:</span>
          <strong className={isQuotaExhausted ? 'text-amber-400' : 'text-emerald-400'}>
            {isQuotaExhausted ? 'Exhausted (429)' : 'Active'}
          </strong>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
          <span className="text-slate-500">Status:</span>
          <strong className="text-white">{project.status}</strong>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
          <span className="text-slate-500">Completed:</span>
          <strong className="text-emerald-400">{completedShots.length}</strong>
          <span className="text-slate-600">/</span>
          <span>{projectShots.length}</span>
        </div>

        {failedShots.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300">
            <span className="text-slate-500">Failed:</span>
            <strong className="text-rose-400 font-bold">{failedShots.length}</strong>
          </div>
        )}

        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 sm:ml-auto">
          <span className="text-slate-500">Final Assembly:</span>
          <strong className={project.final_video_url ? 'text-emerald-400' : 'text-slate-400'}>
            {project.final_video_url ? 'Master Rendered' : (project.status === 'COMPLETED' ? 'Ready to Render' : 'Pending')}
          </strong>
        </div>
      </div>

      {/* Error & Retry Notification Banner */}
      {(isFailed || activeErrorMessage) && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-rose-300">
                {isQuotaExhausted 
                  ? 'Google API Quota Exhausted (HTTP 429 RESOURCE_EXHAUSTED)' 
                  : (project.status === 'FAILED' ? 'Generation Stopped — Provider Error' : 'Media Generation Error')}
              </span>
              {isQuotaExhausted && (
                <p className="text-amber-300/90 mt-1 text-[11px] leading-relaxed">
                  The Google Gemini / Veo API key configured in backend environment has exceeded its request quota. Update <code>GEMINI_API_KEY</code> with active quota and click <strong>Retry Failed Shots</strong> to continue without losing progress.
                </p>
              )}
              <p className="text-rose-400/90 mt-1 text-[11px] leading-relaxed break-words font-mono whitespace-pre-line">
                {activeErrorMessage || 'Media synthesis provider encountered a terminal error. Review parameters and retry.'}
              </p>
            </div>
          </div>

          {onRetryFailed && (
            <button
              onClick={onRetryFailed}
              disabled={isRetryingFailed || isGenerating}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shrink-0 shadow-md shadow-rose-600/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetryingFailed ? 'animate-spin' : ''}`} />
              <span>{isRetryingFailed ? 'Retrying...' : `Retry Failed Shots (${failedShots.length || 'All'})`}</span>
            </button>
          )}
        </div>
      )}

      {/* Pipeline Stage Breadcrumbs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-800/80">
        {stages.map((stage, idx) => {
          const status = getStageStatus(idx);
          return (
            <div
              key={stage.key}
              className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-mono transition-all ${
                status === 'completed'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : status === 'failed'
                  ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                  : status === 'active'
                  ? 'bg-indigo-500/15 border-indigo-500 text-indigo-300 shadow-sm animate-pulse'
                  : 'bg-slate-900/40 border-slate-800/80 text-slate-500'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                status === 'failed' ? 'bg-rose-500/20 text-rose-400' :
                status === 'active' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'
              }`}>
                {idx + 1}
              </div>
            </div>
          );
        })}
      </div>

      {/* Export Modal */}
      {showExportModal && exportData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md glass-panel-glow rounded-3xl p-6 border border-slate-700 space-y-4">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-indigo-400" />
              <span>Export Production Master</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your broadcast assembly is complete with synchronized narration, ducked soundtrack, and timed subtitles.
            </p>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-300">
                <span>Master Video:</span>
                <span className="font-bold text-white">{exportData.resolution}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Actual Duration:</span>
                <span>{exportData.duration.toFixed(1)}s</span>
              </div>
            </div>

            <div className="space-y-2">
              {exportData.downloadUrl && (
                <a
                  href={exportData.downloadUrl}
                  download
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/30"
                >
                  <Clapperboard className="w-4 h-4" />
                  <span>Download Master MP4 Video</span>
                </a>
              )}

              {exportData.srtUrl && (
                <a
                  href={exportData.srtUrl}
                  download
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all border border-slate-700"
                >
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>Download Subtitles (.SRT)</span>
                </a>
              )}
            </div>

            <button
              onClick={() => setShowExportModal(false)}
              className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
