import React, { useState } from 'react';
import { Activity, RefreshCw, AlertCircle, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '../common/Badge';
import type { GenerationJob } from '../../shared/types/index';

interface JobQueueMonitorProps {
  jobs: GenerationJob[];
  onRetryShot?: (shotId: string) => void;
}

export const JobQueueMonitor: React.FC<JobQueueMonitorProps> = ({ jobs, onRetryShot }) => {
  const [isOpen, setIsOpen] = useState(false);

  const pendingCount = jobs.filter(j => j.status === 'PENDING' || j.status === 'queued').length;
  const processingCount = jobs.filter(j => ['PROCESSING', 'processing', 'generating', 'downloading', 'uploading'].includes(j.status)).length;
  const failedCount = jobs.filter(j => j.status === 'FAILED' || j.status === 'failed').length;
  const completedCount = jobs.filter(j => j.status === 'COMPLETED' || j.status === 'completed').length;

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden shadow-lg">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-900/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Asynchronous Worker Job Queue
            </h4>
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 mt-0.5">
              <span>{completedCount} Completed</span>
              <span>•</span>
              <span className="text-amber-400">{processingCount} Processing</span>
              <span>•</span>
              <span className="text-blue-400">{pendingCount} Pending</span>
              {failedCount > 0 && (
                <>
                  <span>•</span>
                  <span className="text-rose-400 font-bold">{failedCount} Failed</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="text-slate-400 p-1">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded Job List Table */}
      {isOpen && (
        <div className="p-4 pt-0 border-t border-slate-800/80 max-h-72 overflow-y-auto">
          {jobs.length === 0 ? (
            <p className="text-xs font-mono text-slate-500 py-4 text-center">No active worker jobs</p>
          ) : (
            <div className="space-y-2 mt-3">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3 text-xs font-mono"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-bold shrink-0">
                      {job.job_type}
                    </span>
                    <span className="text-slate-400 text-[11px] truncate max-w-xs shrink-0">
                      ID: {job.id.slice(0, 8)} • Target: {job.target_entity_id.slice(0, 8)}
                    </span>
                    {(job.status === 'FAILED' || job.status === 'failed') && job.error && (
                      <span className="text-rose-400/90 text-[10px] truncate max-w-sm hidden sm:inline" title={job.error}>
                        {job.error}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] text-slate-500">
                      Attempt {job.attempts}/{job.max_attempts}
                    </span>
                    <Badge status={job.status} />

                    {(job.status === 'FAILED' || job.status === 'failed') && onRetryShot && (
                      <button
                        onClick={() => onRetryShot(job.target_entity_id)}
                        className="p-1 rounded bg-rose-600/80 hover:bg-rose-500 text-white text-[10px] flex items-center gap-1"
                        title="Retry entity job"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
