import { gemini, GEMINI_FLASH_MODEL, isGeminiConfigured, Type, type Schema } from '../../lib/gemini.js';
import type { ShotCameraMotion } from '../../shared/types/index.js';

// Schema enforcing strict integer duration matching Google Veo supported clip durations (4, 6, 8)
const SceneShotsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    shots: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          shotOrder: { type: Type.INTEGER },
          durationSeconds: { 
            type: Type.INTEGER, 
            description: 'Native clip duration in seconds. Must strictly be 4, 6, or 8 seconds (Google Veo supported durations).' 
          },
          visualPrompt: { type: Type.STRING },
          motionInstruction: { 
            type: Type.STRING, 
            enum: ['STATIC', 'PAN_LEFT', 'PAN_RIGHT', 'TILT_UP', 'TILT_DOWN', 'ZOOM_IN', 'ZOOM_OUT', 'DOLLY_FORWARD', 'ORBIT'] 
          },
          associatedDialogueExcerpt: { type: Type.STRING },
          charactersInShot: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          sfxCue: { type: Type.STRING }
        },
        required: [
          'shotOrder', 'durationSeconds', 'visualPrompt', 
          'motionInstruction', 'associatedDialogueExcerpt', 'charactersInShot', 'sfxCue'
        ]
      }
    }
  },
  required: ['shots']
};

export interface DecomposedShot {
  shotOrder: number;
  durationSeconds: number;
  visualPrompt: string;
  motionInstruction: ShotCameraMotion;
  associatedDialogueExcerpt: string;
  charactersInShot: string[];
  sfxCue: string;
}

export interface DecomposedSceneResult {
  shots: DecomposedShot[];
}

/**
 * Normalizes any duration strictly into a Google Veo supported clip duration (4, 6, or 8 seconds)
 */
export function normalizeToVeoDuration(sec: number): number {
  const parsed = Math.round(Number(sec) || 6);
  if (parsed <= 4) return 4;
  if (parsed >= 8) return 8;
  return 6;
}

/**
 * Mathematically partitions any arbitrary total target duration into a sequence of
 * native Google Veo clip durations: strictly 4s, 6s, and 8s clips.
 */
export function partitionIntoVeoDurations(totalSeconds: number): number[] {
  const t = Math.max(4, Math.round(totalSeconds));
  
  if (t <= 5) return [4];
  if (t <= 7) return [6];
  if (t <= 9) return [8];
  if (t === 10) return [6, 4];
  if (t === 11 || t === 12) return [6, 6];
  if (t === 13 || t === 14) return [8, 6];
  if (t === 15 || t === 16) return [6, 6, 4];
  if (t === 17 || t === 18) return [6, 6, 6];
  if (t === 19 || t === 20) return [8, 6, 6];

  const result: number[] = [];
  let rem = t;
  while (rem >= 16) {
    result.push(6);
    rem -= 6;
  }

  if (rem >= 13) { result.push(8, 6); }
  else if (rem >= 11) { result.push(6, 6); }
  else if (rem >= 9) { result.push(6, 4); }
  else if (rem >= 7) { result.push(8); }
  else if (rem >= 5) { result.push(6); }
  else { result.push(4); }

  return result;
}

export async function decomposeSceneIntoShots(params: {
  scene: any;
  characterBibles: any[];
  styleBible: any;
}): Promise<DecomposedSceneResult> {
  if (isGeminiConfigured()) {
    try {
      const response = await gemini.models.generateContent({
        model: GEMINI_FLASH_MODEL,
        contents: `
You are decomposing Scene ${params.scene.sceneOrder}: "${params.scene.title}" into individual camera shots.
SCENE DURATION TARGET: ${params.scene.targetDurationSeconds} seconds.
NARRATION FOR THIS SCENE: "${params.scene.narrationScript || ''}"
ENVIRONMENT: ${params.scene.environment}
MOOD: ${params.scene.mood}

CONTINUITY BIBLES TO ENFORCE IN EVERY VISUAL PROMPT:
CHARACTER BIBLES:
${JSON.stringify(params.characterBibles, null, 2)}

STYLE BIBLE:
${JSON.stringify(params.styleBible, null, 2)}

STRICT DURATION RULES (GOOGLE VEO 3.1 SPECIFICATION):
1. Every shot's 'durationSeconds' MUST STRICTLY be 4, 6, or 8 (Google Veo supports only 4s, 6s, and 8s native clip generations). Never output 5, 7, 3, or other non-Veo durations.
2. The total sum of durationSeconds for all shots should fulfill the scene duration (${params.scene.targetDurationSeconds}s).
3. Every 'visualPrompt' MUST incorporate the physical attributes of any character present and the lighting/lens instructions from the Style Bible.
`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: SceneShotsSchema,
          temperature: 0.4,
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text.trim()) as DecomposedSceneResult;
        if (parsed.shots && Array.isArray(parsed.shots) && parsed.shots.length > 0) {
          // Normalize every shot's duration to strictly 4, 6, or 8
          parsed.shots = parsed.shots.map((sh, idx) => ({
            ...sh,
            shotOrder: idx + 1,
            durationSeconds: normalizeToVeoDuration(sh.durationSeconds),
          }));
          return parsed;
        }
      }
    } catch (err: any) {
      console.warn('[Gemini ShotDecomposer Error - Falling back to mathematical decomposition]:', err.message);
    }
  }

  // Mathematical shot decomposition fallback guaranteeing only 4, 6, 8s clips
  return generateMathematicalShots(params);
}

function generateMathematicalShots(params: {
  scene: any;
  characterBibles: any[];
  styleBible: any;
}): DecomposedSceneResult {
  const targetDuration = Number(params.scene.targetDurationSeconds) || 12;
  const shotDurations = partitionIntoVeoDurations(targetDuration);
  
  const cameraMotions: ShotCameraMotion[] = [
    'DOLLY_FORWARD', 'PAN_RIGHT', 'ORBIT', 'ZOOM_IN', 'PAN_LEFT', 'TILT_UP', 'STATIC'
  ];

  const primaryChar = params.characterBibles[0];
  const charDetails = primaryChar 
    ? `${primaryChar.name} (${primaryChar.visualAttributes?.hair || 'dark hair'}, wearing ${primaryChar.visualAttributes?.clothing || 'travel attire'})`
    : 'A solitary explorer';

  const styleDetails = params.styleBible 
    ? `${params.styleBible.style_name || params.styleBible.styleName || 'Cinematic'}, ${params.styleBible.lighting || 'cinematic lighting'}, shot on ${params.styleBible.camera_gear || params.styleBible.cameraGear || '35mm anamorphic'}`
    : 'Cinematic lighting, 35mm lens';

  const shots: DecomposedShot[] = [];

  for (let i = 0; i < shotDurations.length; i++) {
    const duration = shotDurations[i];
    const motion = cameraMotions[i % cameraMotions.length];
    
    shots.push({
      shotOrder: i + 1,
      durationSeconds: duration,
      visualPrompt: `Shot ${i + 1} of Scene ${params.scene.sceneOrder}: ${charDetails} in ${params.scene.environment}, mood ${params.scene.mood}. ${styleDetails}. Camera executing ${motion}. Ultra high-fidelity visual rendering.`,
      motionInstruction: motion,
      associatedDialogueExcerpt: `Excerpt of narration corresponding to shot ${i + 1} at ${duration}s mark.`,
      charactersInShot: primaryChar ? [primaryChar.name] : [],
      sfxCue: i % 2 === 0 ? 'Subtle ambient wind and environmental footsteps' : 'Deep atmospheric bass drone and cinematic riser',
    });
  }

  return { shots };
}
