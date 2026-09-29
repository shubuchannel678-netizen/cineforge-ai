import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Film, Layers, User, Camera, Activity, 
  ArrowLeft, RefreshCw, Sparkles, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { useProject } from '../hooks/useProject';
import { useTimelineStore } from '../store/useTimelineStore';
import { PipelineProgressHeader } from '../components/telemetry/PipelineProgressHeader';
import { MasterVideoPlayer } from '../components/player/MasterVideoPlayer';
import { SmartTimeline } from '../components/timeline/SmartTimeline';
import { ShotInspectorModal } from '../components/inspector/ShotInspectorModal';
import { CharacterBibleManager } from '../components/inspector/CharacterBibleManager';
import { StyleBibleManager } from '../components/inspector/StyleBibleManager';
import { JobQueueMonitor } from '../components/telemetry/JobQueueMonitor';
import { exportProject } from '../api/projects';
import { updateCharacterBible, updateStyleBible } from '../api/bibles';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const ProjectWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'TIMELINE' | 'CHARACTERS' | 'STYLE' | 'JOBS'>('TIMELINE');

  const {
    project,
    isLoading,
    isError,
    error,
    progress,
    jobs,
    generate,
    isGenerating,
    render,
    isRendering,
    retryShot,
    isRetryingShot,
    retryFailedShots,
    isRetryingFailedShots,
    updateShot,
  } = useProject(id);

  const { setTotalDuration } = useTimelineStore();

  useEffect(() => {
    if (project) {
      setTotalDuration(Number(project.actual_duration_seconds) || project.target_duration_seconds || 60);
    }
  }, [project, setTotalDuration]);

  // Mutations for Bibles
  const saveCharacterMutation = useMutation({
    mutationFn: ({ charId, data }: { charId: string; data: any }) =>
      fetch(`/api/v1/projects/${id}/bibles/character/${charId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('cineforge_auth_token') || 'demo-token'}`,
        },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
  });

  const saveStyleMutation = useMutation({
    mutationFn: (data: any) =>
      fetch(`/api/v1/projects/${id}/bibles/style`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('cineforge_auth_token') || 'demo-token'}`,
        },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-16 flex flex-col items-center justify-center space-y-4 text-center">
        <Sparkles className="w-10 h-10 text-indigo-400 animate-spin" />
        <h3 className="text-lg font-bold text-white font-mono">Loading Production Workspace...</h3>
        <p className="text-xs text-slate-400">Synchronizing scene graph, assets, and queue state.</p>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Project Not Found</h2>
        <p className="text-xs text-slate-400">
          {(error as any)?.message || 'The requested video production does not exist or has been removed.'}
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Workspace Header & Action Hub */}
      <PipelineProgressHeader
        project={project}
        progress={progress}
        onGenerate={generate}
        onRender={render}
        onExport={() => exportProject(project.id)}
        onRetryFailed={retryFailedShots}
        isGenerating={isGenerating}
        isRendering={isRendering}
        isRetryingFailed={isRetryingFailedShots}
      />

      {/* Main Studio Stage: Master Video Player */}
      <div className="w-full">
        <MasterVideoPlayer project={project} />
      </div>

      {/* Workspace Stage Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-1">
        <div className="flex items-center gap-2">
          {[
            { id: 'TIMELINE', label: 'Timeline Studio', icon: Layers },
            { id: 'CHARACTERS', label: 'Character Bibles', icon: User },
            { id: 'STYLE', label: 'Style Bible', icon: Camera },
            { id: 'JOBS', label: 'Telemetry Queue', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Live sync indicator */}
        <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>State Machine Synchronized</span>
        </div>
      </div>

      {/* Active Tab View */}
      {activeTab === 'TIMELINE' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <SmartTimeline
            project={project}
            onRetryShot={(shotId) => retryShot({ shotId })}
          />
        </div>
      )}

      {activeTab === 'CHARACTERS' && (
        <div className="animate-in fade-in duration-150">
          <CharacterBibleManager
            characterBibles={project.character_bibles || []}
            onSaveCharacter={(charId, data) => saveCharacterMutation.mutate({ charId, data })}
          />
        </div>
      )}

      {activeTab === 'STYLE' && (
        <div className="animate-in fade-in duration-150">
          <StyleBibleManager
            styleBible={project.style_bible || null}
            onSaveStyle={(data) => saveStyleMutation.mutate(data)}
          />
        </div>
      )}

      {activeTab === 'JOBS' && (
        <div className="animate-in fade-in duration-150">
          <JobQueueMonitor
            jobs={jobs}
            onRetryShot={(shotId) => retryShot({ shotId })}
          />
        </div>
      )}

      {/* Granular Shot Inspector Modal */}
      <ShotInspectorModal
        onRetry={(shotId, customPrompt, motion) => retryShot({ shotId, customPrompt, motion })}
        onUpdate={(shotId, data) => updateShot({ shotId, data })}
        isRetrying={isRetryingShot}
      />
    </div>
  );
};
