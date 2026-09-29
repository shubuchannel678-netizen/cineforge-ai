import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Film, Trash2, ArrowRight, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '../common/Badge';
import type { Project } from '../../shared/types/index';

interface ProjectCardProps {
  project: Project;
  onDelete: (id: string) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onDelete }) => {
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return mins > 0 ? `${mins}m ${s > 0 ? `${s}s` : ''}` : `${s}s`;
  };

  const getAspectClass = () => {
    if (project.aspect_ratio === '9:16') return 'aspect-[9/16]';
    if (project.aspect_ratio === '1:1') return 'aspect-square';
    return 'aspect-video';
  };

  return (
    <div className="group glass-panel rounded-2xl overflow-hidden border border-slate-800/80 hover:border-indigo-500/40 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col justify-between">
      <div>
        {/* Preview / Thumbnail */}
        <div className={`relative w-full ${getAspectClass()} max-h-56 bg-slate-900 overflow-hidden flex items-center justify-center`}>
          {project.thumbnail_url ? (
            <img
              src={project.thumbnail_url}
              alt={project.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500">
              <Film className="w-10 h-10 mb-2 text-slate-600 group-hover:text-indigo-400 transition-colors" />
              <p className="text-xs font-mono">Generating Visual Frames</p>
            </div>
          )}

          {/* Duration overlay badge */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-white/10 text-xs font-mono font-medium text-slate-200">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>{formatTime(project.target_duration_seconds)}</span>
          </div>

          {/* Aspect ratio pill */}
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-[11px] font-mono bg-black/60 backdrop-blur-md border border-white/10 text-slate-300">
            {project.aspect_ratio}
          </div>

          {/* Status overlay */}
          <div className="absolute bottom-3 left-3">
            <Badge status={project.status} />
          </div>
        </div>

        {/* Content Details */}
        <div className="p-5">
          <h3 className="font-bold text-base text-slate-100 line-clamp-1 group-hover:text-indigo-300 transition-colors">
            {project.title}
          </h3>
          <p className="text-xs text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
            {project.initial_prompt}
          </p>

          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800/60 text-xs text-slate-400">
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-medium text-indigo-300">
              {project.visual_style}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-[11px] text-slate-400">{project.pacing}</span>
          </div>

          {/* Pipeline progress bar */}
          {(project.status === 'PLANNING' || project.status === 'GENERATING') && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
                <span className="text-indigo-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 animate-spin" /> Orchestrating
                </span>
                <span>{project.progress_percentage}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 rounded-full"
                  style={{ width: `${project.progress_percentage}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="p-5 pt-0 flex items-center justify-between gap-3">
        <button
          onClick={() => onDelete(project.id)}
          className="p-2.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all duration-150"
          title="Delete Project"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <Link
          to={`/project/${project.id}`}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white border border-slate-700 hover:border-indigo-500 transition-all duration-200"
        >
          <span>Open Studio</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
