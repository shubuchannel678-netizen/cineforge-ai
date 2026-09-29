import { gemini, GEMINI_FLASH_MODEL, isGeminiConfigured, Type, type Schema } from '../../lib/gemini.js';

const BibleSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          visualAttributes: {
            type: Type.OBJECT,
            properties: {
              hair: { type: Type.STRING },
              clothing: { type: Type.STRING },
              build: { type: Type.STRING },
              distinguishingFeatures: { type: Type.STRING }
            },
            required: ['hair', 'clothing', 'build', 'distinguishingFeatures']
          }
        },
        required: ['name', 'description', 'visualAttributes']
      }
    },
    style: {
      type: Type.OBJECT,
      properties: {
        styleName: { type: Type.STRING },
        lighting: { type: Type.STRING },
        cameraGear: { type: Type.STRING },
        colorPalette: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        environmentRules: { type: Type.STRING },
        negativePrompt: { type: Type.STRING }
      },
      required: ['styleName', 'lighting', 'cameraGear', 'colorPalette', 'environmentRules', 'negativePrompt']
    }
  },
  required: ['characters', 'style']
};

export interface ExtractedBibles {
  characters: Array<{
    name: string;
    description: string;
    visualAttributes: {
      hair: string;
      clothing: string;
      build: string;
      distinguishingFeatures: string;
      [key: string]: string;
    };
  }>;
  style: {
    styleName: string;
    lighting: string;
    cameraGear: string;
    colorPalette: string[];
    environmentRules: string;
    negativePrompt: string;
  };
}

export async function extractBibles(storyBlueprint: any, visualStyle: string): Promise<ExtractedBibles> {
  if (isGeminiConfigured()) {
    try {
      const response = await gemini.models.generateContent({
        model: GEMINI_FLASH_MODEL,
        contents: `
Analyze this story blueprint and establish invariant Character Bibles and a Style Bible for:
VISUAL STYLE: ${visualStyle}
STORY CONTEXT:
${JSON.stringify(storyBlueprint, null, 2)}

Create detailed continuity prompts for recurring characters and universal visual directives.
`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: BibleSchema,
          temperature: 0.2,
        }
      });

      if (response.text) {
        return JSON.parse(response.text.trim()) as ExtractedBibles;
      }
    } catch (err: any) {
      console.warn('[Gemini BibleExtractor Error - Falling back to preset bibles]:', err.message);
    }
  }

  // Fallback continuity bibles tailored to visual style and concept
  return generateFallbackBibles(storyBlueprint, visualStyle);
}

function generateFallbackBibles(storyBlueprint: any, visualStyle: string): ExtractedBibles {
  const isMinecraft = visualStyle.toLowerCase().includes('minecraft');
  const isAnime = visualStyle.toLowerCase().includes('anime') || visualStyle.toLowerCase().includes('ghibli');
  const isCyberpunk = visualStyle.toLowerCase().includes('cyberpunk');

  let defaultCharName = 'Protagonist';
  let defaultCharDesc = 'The central protagonist driving the narrative arc.';
  let visualAttributes = {
    hair: 'Dark windswept hair',
    clothing: 'Rugged travel jacket with brass fasteners, durable charcoal trousers, leather boots',
    build: 'Athletic, determined stance',
    distinguishingFeatures: 'Weathered mechanical compass attached to left chest belt'
  };

  if (isMinecraft) {
    defaultCharName = 'Steve / Explorer';
    defaultCharDesc = 'A seasoned survivalist crafting their destiny in dangerous biomes.';
    visualAttributes = {
      hair: 'Blocky dark brown hair',
      clothing: 'Cyan tunic shirt, indigo utility trousers, iron reinforced belt',
      build: 'Voxel cubic proportions, athletic adventurer stature',
      distinguishingFeatures: 'Carries an enchanted pickaxe holster on right hip'
    };
  } else if (isAnime) {
    defaultCharName = 'Ren';
    defaultCharDesc = 'A contemplative traveler uncovering ancient secrets.';
    visualAttributes = {
      hair: 'Tousled raven hair with wind highlights',
      clothing: 'Flowing cream-white haori cloak over dark traveler garments',
      build: 'Slender, agile',
      distinguishingFeatures: 'Silver pendant glowing with subtle inner luminescence'
    };
  } else if (isCyberpunk) {
    defaultCharName = 'Vance';
    defaultCharDesc = 'A rogue cybernetic specialist navigating neon megacity alleys.';
    visualAttributes = {
      hair: 'Undercut with electric cyan dyed streaks',
      clothing: 'Reflective holographic trenchcoat, carbon-fiber tactical vest',
      build: 'Lean cyber-enhanced frame',
      distinguishingFeatures: 'Subdermal chrome optics with amber HUD flicker'
    };
  }

  return {
    characters: [
      {
        name: defaultCharName,
        description: defaultCharDesc,
        visualAttributes,
      }
    ],
    style: {
      styleName: visualStyle,
      lighting: isMinecraft 
        ? 'Golden hour volumetric block rays, soft ambient occlusion, warm torchlight glow'
        : (isCyberpunk ? 'High-contrast neon pink and teal rim light, wet asphalt reflections' : 'Cinematic Rembrandt lighting with soft 35mm golden haze'),
      cameraGear: 'ARRI Alexa LF, 35mm Anamorphic Master Prime lens, subtle depth of field',
      colorPalette: isCyberpunk 
        ? ['#00f0ff', '#ff0055', '#1a0b2e', '#f9f9f9'] 
        : ['#e2a855', '#243b55', '#141e30', '#f5f7fa'],
      environmentRules: 'Pristine photographic texture continuity, hyper-detailed backgrounds without blur anomalies',
      negativePrompt: 'blurry, oversaturated, deformed anatomy, low quality, artifacts, floating limbs, modern watermarks, text',
    }
  };
}
