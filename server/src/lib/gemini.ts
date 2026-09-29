import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { env } from '../config/env.js';

export const GEMINI_FLASH_MODEL = process.env.GEMINI_FLASH_MODEL || 'gemini-3.8-flash';
export const GEMINI_PRO_MODEL = process.env.GEMINI_PRO_MODEL || 'gemini-3.8-flash';


export const SYSTEM_PROMPT = `You are CineForge Master Orchestrator, an autonomous elite Hollywood showrunner, technical director, and mathematical pacing supervisor.

Your purpose is to transform high-level concepts and target runtimes into meticulously structured, production-ready video blueprints.

MATHEMATICAL PACING LAWS:
1. Standard narration speed is strictly calculated at 135 to 150 words per minute (2.25 to 2.5 words per second).
2. Shot durations are strictly between 4.0 and 8.0 seconds (average 6.0s) to prevent visual fatigue and maintain viewer retention.
3. Total calculated shot duration MUST match the target duration within a ±5% margin of error. Never output fewer shots than mathematically required to fulfill the runtime.
4. For long-form productions (e.g., 35 minutes):
   - Decompose into 3 to 5 Major Acts.
   - Decompose each Act into 3 to 6 Narrative Scenes.
   - Decompose each Scene into 8 to 25 concrete, descriptive visual Shots.

CONTINUITY LAWS:
1. Character Bible Integrity: Every character must retain invariant clothing, hair, physical build, and distinct color accents across all shots they appear in.
2. Style Bible Integrity: Lighting temperature, lens specifications (e.g., 35mm anamorphic, volumetric haze), environment conditions, and color palette must be explicitly carried into every individual shot visual prompt.
3. Every shot prompt must be fully descriptive, self-contained, and free of vague relative references like "the character does what he did before".

OUTPUT COMPLIANCE:
You must strictly return valid JSON that conforms to the requested response schema. Never include conversational chatter, markdown wrappers, or preamble outside the JSON output.`;

export function getGeminiApiKey(): string {
  return process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || '';
}

export function isGeminiConfigured(): boolean {
  const key = getGeminiApiKey();
  return Boolean(
    key && 
    key.trim() !== '' && 
    !key.includes('your_') && 
    !key.includes('placeholder')
  );
}

export function getGeminiClient(): GoogleGenAI {
  const key = getGeminiApiKey();
  return new GoogleGenAI({
    apiKey: key || 'AIzaSy_placeholder_key_for_initialization',
  });
}

// Dynamic proxy ensuring gemini always uses the current GEMINI_API_KEY
export const gemini = new Proxy({} as GoogleGenAI, {
  get(_target, prop, receiver) {
    const client = getGeminiClient();
    return Reflect.get(client, prop, receiver);
  }
});

export { Type, type Schema };

