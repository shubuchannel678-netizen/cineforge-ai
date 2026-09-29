import { z } from 'zod';

export const CreateProjectSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100, 'Title cannot exceed 100 characters'),
  description: z.string().max(500).optional(),
  initialPrompt: z.string().min(10, 'Prompt must be at least 10 characters').max(4000, 'Prompt cannot exceed 4000 characters'),
  rawScript: z.string().max(50000).optional(),
  targetDurationSeconds: z.number().int().min(10, 'Minimum duration is 10 seconds').max(7200, 'Maximum duration is 7200 seconds (2 hours)'),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).default('16:9'),
  visualStyle: z.string().min(2).default('Cinematic Realism'),
  pacing: z.enum(['Slow & Atmospheric', 'Balanced & Narrative', 'Fast & Intense']).default('Balanced & Narrative'),
});

export const RetryShotSchema = z.object({
  shotId: z.string().uuid(),
  customVisualPrompt: z.string().min(10).optional(),
  motionInstruction: z.enum([
    'STATIC', 'PAN_LEFT', 'PAN_RIGHT', 'TILT_UP', 'TILT_DOWN', 
    'ZOOM_IN', 'ZOOM_OUT', 'DOLLY_FORWARD', 'ORBIT'
  ]).optional(),
});

export const UpdateShotSchema = z.object({
  visualPrompt: z.string().min(5),
  motionInstruction: z.enum([
    'STATIC', 'PAN_LEFT', 'PAN_RIGHT', 'TILT_UP', 'TILT_DOWN', 
    'ZOOM_IN', 'ZOOM_OUT', 'DOLLY_FORWARD', 'ORBIT'
  ]).optional(),
  durationSeconds: z.number().min(2).max(30).optional(),
});

export const UpdateCharacterBibleSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().min(5).max(500),
  visualAttributes: z.record(z.string()),
  referenceImageUrl: z.string().url().optional().nullable(),
  voiceId: z.string().optional().nullable(),
});

export const UpdateStyleBibleSchema = z.object({
  styleName: z.string().min(2),
  lighting: z.string().min(3),
  cameraGear: z.string().min(3),
  colorPalette: z.array(z.string()),
  environmentRules: z.string(),
  negativePrompt: z.string(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type RetryShotInput = z.infer<typeof RetryShotSchema>;
export type UpdateShotInput = z.infer<typeof UpdateShotSchema>;
export type UpdateCharacterBibleInput = z.infer<typeof UpdateCharacterBibleSchema>;
export type UpdateStyleBibleInput = z.infer<typeof UpdateStyleBibleSchema>;
