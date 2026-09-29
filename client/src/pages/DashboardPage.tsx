import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Film, Clock, CheckCircle2, Sparkles } from 'lucide-react';
import { listProjects, deleteProject } from '../api/projects';
import { ProjectGrid } from '../components/dashboard/ProjectGrid';

export const DashboardPage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
    refetchInterval: 5000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const totalProjects = projects.length;
  const completedProjects = projects.filter((p) => p.status === 'COMPLETED').length;
  const totalSeconds = projects.reduce((acc, p) => acc + (p.actual_duration_seconds || p.target_duration_seconds), 0);
  const totalMinutes = Math.round(totalSeconds / 60);

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-6 py-8">
      {/* Top Banner & Quick Metrics */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Production Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Autonomous video pipelines orchestrated from prompt to final broadcast MP4.
          </p>
        </div>

        {/* Action Button */}
        <Link
          to="/create"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-600/25 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New AI Production</span>
        </Link>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Film className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Total Productions</div>
            <div className="text-2xl font-black text-white font-mono mt-0.5">{totalProjects}</div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Master Rendered</div>
            <div className="text-2xl font-black text-white font-mono mt-0.5">{completedProjects}</div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Orchestrated Runtime</div>
            <div className="text-2xl font-black text-white font-mono mt-0.5">~{totalMinutes} min</div>
          </div>
        </div>
      </div>

      {/* Project Grid */}
      <ProjectGrid
        projects={projects}
        isLoading={isLoading}
        onDeleteProject={(id) => {
          if (confirm('Are you sure you want to delete this project?')) {
            deleteMutation.mutate(id);
          }
        }}
      />
    </div>
  );
};
