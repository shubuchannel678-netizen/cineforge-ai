import { apiClient } from './client';
import type { 
  Project, ProjectProgressResponse, ExportResponse, 
  GenerationJob, Shot 
} from '../shared/types/index';
import type { 
  CreateProjectInput, RetryShotInput, UpdateShotInput 
} from '../shared/validators/projectSchemas';

export async function createProject(data: CreateProjectInput): Promise<Project> {
  return apiClient<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listProjects(): Promise<Project[]> {
  return apiClient<Project[]>('/projects');
}

export async function getProject(id: string): Promise<Project> {
  return apiClient<Project>(`/projects/${id}`);
}

export async function deleteProject(id: string): Promise<{ success: boolean }> {
  return apiClient<{ success: boolean }>(`/projects/${id}`, {
    method: 'DELETE',
  });
}

export async function planProject(id: string): Promise<any> {
  return apiClient<any>(`/projects/${id}/plan`, {
    method: 'POST',
  });
}

export async function generateProject(id: string): Promise<{ message: string; jobId?: string }> {
  return apiClient<{ message: string; jobId?: string }>(`/projects/${id}/generate`, {
    method: 'POST',
  });
}

export async function getProjectProgress(id: string): Promise<ProjectProgressResponse> {
  return apiClient<ProjectProgressResponse>(`/projects/${id}/progress`);
}

export async function getProjectJobs(id: string): Promise<GenerationJob[]> {
  return apiClient<GenerationJob[]>(`/projects/${id}/jobs`);
}

export async function retryShot(projectId: string, shotId: string, customPrompt?: string, motion?: string): Promise<{ message: string; shot: Shot }> {
  return apiClient<{ message: string; shot: Shot }>(`/projects/${projectId}/shots/${shotId}/retry`, {
    method: 'POST',
    body: JSON.stringify({
      shotId,
      customVisualPrompt: customPrompt,
      motionInstruction: motion,
    }),
  });
}

export async function retryFailedShots(projectId: string): Promise<{ message: string; retriedCount: number }> {
  return apiClient<{ message: string; retriedCount: number }>(`/projects/${projectId}/retry-failed`, {
    method: 'POST',
  });
}

export async function updateShot(projectId: string, shotId: string, data: UpdateShotInput): Promise<Shot> {
  return apiClient<Shot>(`/projects/${projectId}/shots/${shotId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function renderProject(projectId: string): Promise<{ message: string; jobId: string }> {
  return apiClient<{ message: string; jobId: string }>(`/projects/${projectId}/render`, {
    method: 'POST',
  });
}

export async function exportProject(projectId: string): Promise<ExportResponse> {
  return apiClient<ExportResponse>(`/projects/${projectId}/export`);
}
