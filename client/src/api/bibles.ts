import { apiClient } from './client';
import type { CharacterBible, StyleBible } from '../shared/types/index';
import type { UpdateCharacterBibleInput, UpdateStyleBibleInput } from '../shared/validators/projectSchemas';

export interface BiblesResponse {
  characterBibles: CharacterBible[];
  styleBible: StyleBible | null;
}

export async function getBibles(projectId: string): Promise<BiblesResponse> {
  return apiClient<BiblesResponse>(`/projects/${projectId}/bibles`);
}

export async function updateCharacterBible(
  projectId: string, 
  charId: string, 
  data: UpdateCharacterBibleInput
): Promise<CharacterBible> {
  return apiClient<CharacterBible>(`/projects/${projectId}/bibles/character/${charId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function updateStyleBible(
  projectId: string, 
  data: UpdateStyleBibleInput
): Promise<StyleBible> {
  return apiClient<StyleBible>(`/projects/${projectId}/bibles/style`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
