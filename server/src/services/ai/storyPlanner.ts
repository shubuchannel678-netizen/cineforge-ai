import { gemini, GEMINI_PRO_MODEL, isGeminiConfigured, Type, type Schema } from '../../lib/gemini.js';

const StoryPlanSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    logline: { type: Type.STRING },
    totalTargetDurationSeconds: { type: Type.INTEGER },
    totalEstimatedWords: { type: Type.INTEGER },
    acts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          actNumber: { type: Type.INTEGER },
          actTitle: { type: Type.STRING },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sceneOrder: { type: Type.INTEGER },
                title: { type: Type.STRING },
                narrativeGoal: { type: Type.STRING },
                environment: { type: Type.STRING },
                mood: { type: Type.STRING },
                targetDurationSeconds: { type: Type.NUMBER },
                narrationScript: { type: Type.STRING },
                estimatedShotCount: { type: Type.INTEGER }
              },
              required: [
                'sceneOrder', 'title', 'narrativeGoal', 'environment', 
                'mood', 'targetDurationSeconds', 'narrationScript', 'estimatedShotCount'
              ]
            }
          }
        },
        required: ['actNumber', 'actTitle', 'scenes']
      }
    }
  },
  required: ['title', 'logline', 'totalTargetDurationSeconds', 'totalEstimatedWords', 'acts']
};

export interface StoryPlanResult {
  title: string;
  logline: string;
  totalTargetDurationSeconds: number;
  totalEstimatedWords: number;
  acts: Array<{
    actNumber: number;
    actTitle: string;
    scenes: Array<{
      sceneOrder: number;
      title: string;
      narrativeGoal: string;
      environment: string;
      mood: string;
      targetDurationSeconds: number;
      narrationScript: string;
      estimatedShotCount: number;
    }>;
  }>;
}

export async function planStoryAndScenes(params: {
  prompt: string;
  targetDurationSeconds: number;
  visualStyle: string;
  pacing: string;
  userScript?: string;
}): Promise<StoryPlanResult> {
  const wordsTarget = Math.round((params.targetDurationSeconds / 60) * 140);

  if (isGeminiConfigured()) {
    try {
      const response = await gemini.models.generateContent({
        model: GEMINI_PRO_MODEL,
        contents: `
You are planning a video production.
TARGET DURATION: ${params.targetDurationSeconds} seconds (~${Math.round(params.targetDurationSeconds / 60)} minutes).
REQUIRED SCRIPT WORD BUDGET: Approximately ${wordsTarget} words total across all scenes.
VISUAL STYLE: ${params.visualStyle}
PACING: ${params.pacing}
CORE USER PROMPT: "${params.prompt}"
${params.userScript ? `USER PROVIDED SCRIPT: "${params.userScript}"` : 'Generate an original narrative script fulfilling the duration.'}

Perform the mathematical scene breakdown. Ensure the sum of scene target durations precisely matches ${params.targetDurationSeconds} seconds.
`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: StoryPlanSchema,
          temperature: 0.7,
        }
      });

      if (response.text) {
        return JSON.parse(response.text.trim()) as StoryPlanResult;
      }
    } catch (err: any) {
      console.warn('[Gemini StoryPlanner Error - Falling back to mathematical blueprint generator]:', err.message);
    }
  }

  // Resilient mathematical blueprint generator when running in standalone mode or without active key
  return generateMathematicalStoryBlueprint(params, wordsTarget);
}

function generateMathematicalStoryBlueprint(params: {
  prompt: string;
  targetDurationSeconds: number;
  visualStyle: string;
  pacing: string;
  userScript?: string;
}, wordsTarget: number): StoryPlanResult {
  const duration = params.targetDurationSeconds;
  
  // Determine number of scenes based on duration:
  // Short (<=60s): 1-3 scenes
  // Medium (3m-5m): 4-6 scenes
  // YouTube standard (12m): 8-12 scenes
  // Long-form (35m-60m): 14-24 scenes
  let sceneCount = 2;
  if (duration <= 60) {
    sceneCount = Math.max(1, Math.round(duration / 20));
  } else if (duration <= 300) {
    sceneCount = Math.max(3, Math.round(duration / 60));
  } else if (duration <= 900) {
    sceneCount = Math.max(6, Math.round(duration / 100));
  } else {
    sceneCount = Math.min(24, Math.max(10, Math.round(duration / 150)));
  }

  const avgSceneDuration = Math.round((duration / sceneCount) * 10) / 10;
  const avgWordsPerScene = Math.max(15, Math.round(wordsTarget / sceneCount));

  // Determine act structure (3 acts standard)
  const actCount = duration > 600 ? 4 : (duration > 180 ? 3 : 2);
  const acts: StoryPlanResult['acts'] = [];
  const actTitles = ['The Hook & Inciting Event', 'The Rising Tension & Exploration', 'The Climax & Revelation', 'The Aftermath & Resolution'];

  let currentSceneOrder = 1;
  let remainingDuration = duration;

  for (let a = 1; a <= actCount; a++) {
    const actSceneCount = a === actCount 
      ? (sceneCount - currentSceneOrder + 1) 
      : Math.max(1, Math.round(sceneCount / actCount));
    
    const scenesInAct: StoryPlanResult['acts'][0]['scenes'] = [];

    for (let s = 1; s <= actSceneCount && currentSceneOrder <= sceneCount; s++) {
      const isLast = currentSceneOrder === sceneCount;
      const sceneDuration = isLast ? Math.max(5, Math.round(remainingDuration * 10) / 10) : avgSceneDuration;
      remainingDuration -= sceneDuration;

      const estimatedShots = Math.max(1, Math.round(sceneDuration / 6.0));
      
      scenesInAct.push({
        sceneOrder: currentSceneOrder,
        title: `Scene ${currentSceneOrder}: ${params.prompt.slice(0, 30)} - Part ${currentSceneOrder}`,
        narrativeGoal: `Advance narrative phase ${currentSceneOrder} in the style of ${params.visualStyle}`,
        environment: `Setting aligned with ${params.visualStyle} premise`,
        mood: a === 1 ? 'Intriguing & Atmospheric' : (a === actCount ? 'Triumphant & Conclusive' : 'Dramatic & Tense'),
        targetDurationSeconds: sceneDuration,
        narrationScript: `In this segment, the journey unfolds across ${sceneDuration} seconds as the events of ${params.prompt.slice(0, 45)} reach critical milestones under a ${params.pacing.toLowerCase()} tempo.`,
        estimatedShotCount: estimatedShots,
      });

      currentSceneOrder++;
    }

    acts.push({
      actNumber: a,
      actTitle: actTitles[a - 1] || `Act ${a}`,
      scenes: scenesInAct,
    });
  }

  return {
    title: params.prompt.length > 50 ? `${params.prompt.slice(0, 47)}...` : params.prompt,
    logline: `A ${params.visualStyle} narrative exploring ${params.prompt} spanning ${Math.round(duration / 60)} minutes.`,
    totalTargetDurationSeconds: duration,
    totalEstimatedWords: wordsTarget,
    acts,
  };
}
