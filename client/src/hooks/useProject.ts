import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getProject, getProjectProgress, getProjectJobs, 
  generateProject, renderProject, retryShot, retryFailedShots, updateShot 
} from '../api/projects';

export function useProject(projectId?: string) {
  const queryClient = useQueryClient();

  // Fetch full project data
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: Boolean(projectId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      // Stop polling on COMPLETED or FAILED
      if (data.status === 'COMPLETED' || data.status === 'FAILED') {
        return false;
      }
      if (data.status === 'PLANNING' || data.status === 'GENERATING') {
        return 2000; // Poll while actively generating
      }
      return false;
    },
  });

  // Fetch telemetry progress
  const progressQuery = useQuery({
    queryKey: ['project-progress', projectId],
    queryFn: () => getProjectProgress(projectId!),
    enabled: Boolean(projectId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 1500;
      // Stop polling on COMPLETED or FAILED
      if (data.status === 'COMPLETED' || data.status === 'FAILED') {
        return false;
      }
      if (data.activeJobsCount > 0 || data.status === 'PLANNING' || data.status === 'GENERATING') {
        return 1500;
      }
      return false;
    },
  });

  // Fetch job queue telemetry
  const jobsQuery = useQuery({
    queryKey: ['project-jobs', projectId],
    queryFn: () => getProjectJobs(projectId!),
    enabled: Boolean(projectId),
    refetchInterval: (query) => {
      const jobs = query.state.data;
      const proj = projectQuery.data;
      const prog = progressQuery.data;

      // Stop polling if project is finished or failed
      if (proj?.status === 'COMPLETED' || proj?.status === 'FAILED' || prog?.status === 'COMPLETED' || prog?.status === 'FAILED') {
        return false;
      }

      const hasActiveJobs = jobs && jobs.some(j => 
        j.status === 'PENDING' || 
        j.status === 'PROCESSING' || 
        j.status === 'queued' || 
        j.status === 'generating' || 
        j.status === 'downloading' || 
        j.status === 'uploading'
      );

      if (hasActiveJobs || proj?.status === 'GENERATING' || proj?.status === 'PLANNING') {
        return 3000;
      }

      return false;
    },
  });

  // Generate / Produce mutation
  const generateMutation = useMutation({
    mutationFn: () => generateProject(projectId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-progress', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-jobs', projectId] });
    },
  });

  // Master render mutation
  const renderMutation = useMutation({
    mutationFn: () => renderProject(projectId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-progress', projectId] });
    },
  });

  // Granular single shot retry mutation
  const retryShotMutation = useMutation({
    mutationFn: ({ shotId, customPrompt, motion }: { shotId: string; customPrompt?: string; motion?: string }) =>
      retryShot(projectId!, shotId, customPrompt, motion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-progress', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-jobs', projectId] });
    },
  });

  // Bulk retry all failed shots mutation
  const retryFailedShotsMutation = useMutation({
    mutationFn: () => retryFailedShots(projectId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-progress', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-jobs', projectId] });
    },
  });

  // Update shot parameters mutation
  const updateShotMutation = useMutation({
    mutationFn: ({ shotId, data }: { shotId: string; data: any }) =>
      updateShot(projectId!, shotId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  return {
    project: projectQuery.data,
    isLoading: projectQuery.isLoading,
    isError: projectQuery.isError,
    error: projectQuery.error,
    progress: progressQuery.data,
    jobs: jobsQuery.data || [],
    generate: generateMutation.mutate,
    isGenerating: generateMutation.isPending,
    render: renderMutation.mutate,
    isRendering: renderMutation.isPending,
    retryShot: retryShotMutation.mutate,
    isRetryingShot: retryShotMutation.isPending,
    retryFailedShots: retryFailedShotsMutation.mutate,
    isRetryingFailedShots: retryFailedShotsMutation.isPending,
    updateShot: updateShotMutation.mutate,
    refetch: projectQuery.refetch,
  };
}
