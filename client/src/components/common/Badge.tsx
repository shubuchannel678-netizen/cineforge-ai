import React from 'react';
import type { ProjectStatus, JobStatus } from '../../shared/types/index';

interface BadgeProps {
  status: ProjectStatus | JobStatus | string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, className = '' }) => {
  let colorStyles = 'bg-slate-800 text-slate-300 border-slate-700';
  const upper = (status || '').toUpperCase();

  switch (upper) {
    case 'COMPLETED':
      colorStyles = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      break;
    case 'GENERATING':
    case 'PROCESSING':
    case 'DOWNLOADING':
    case 'UPLOADING':
      colorStyles = 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse';
      break;
    case 'PLANNING':
      colorStyles = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      break;
    case 'PENDING':
    case 'QUEUED':
      colorStyles = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      break;
    case 'FAILED':
      colorStyles = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      break;
    case 'DRAFT':
    case 'CANCELLED':
      colorStyles = 'bg-slate-800/80 text-slate-400 border-slate-700';
      break;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorStyles} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        upper === 'COMPLETED' ? 'bg-emerald-400' :
        upper === 'PROCESSING' || upper === 'GENERATING' || upper === 'DOWNLOADING' || upper === 'UPLOADING' ? 'bg-amber-400' :
        upper === 'FAILED' ? 'bg-rose-400' :
        upper === 'PLANNING' ? 'bg-indigo-400' : 'bg-slate-400'
      }`} />
      {status}
    </span>
  );
};
