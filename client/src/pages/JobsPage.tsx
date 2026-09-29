import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Activity, RefreshCw } from 'lucide-react';
import { useProject } from '../hooks/useProject';
import { JobQueueMonitor } from '../components/telemetry/JobQueueMonitor';

export const JobsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { project, jobs, retryShot, isLoading } = useProject(id);

  if (isLoading || !project) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 text-center text-slate-400 font-mono">
        Loading job queue telemetry...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            to={`/project/${project.id}`}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Production Job Queue & Logs</h1>
            <p className="text-xs text-slate-400">{project.title}</p>
          </div>
        </div>
      </div>

      <JobQueueMonitor
        jobs={jobs}
        onRetryShot={(shotId) => retryShot({ shotId })}
      />
    </div>
  );
};
