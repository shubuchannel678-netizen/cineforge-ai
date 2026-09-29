import fs from 'fs';
import path from 'path';
import type { SubtitleCue } from '../../shared/types/index.js';

const ASSETS_DIR = path.resolve(process.cwd(), 'public', 'assets');
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

export interface TTSResult {
  audioUrl: string;
  durationSeconds: number;
  cues: SubtitleCue[];
  srtContent: string;
  vttContent: string;
}

export async function synthesizeVoiceover(params: {
  sceneId: string;
  projectId: string;
  text: string;
  targetDurationSeconds: number;
}): Promise<TTSResult> {
  const filename = `voice_${params.sceneId}.wav`;
  const filePath = path.join(ASSETS_DIR, filename);

  const words = params.text.trim().split(/\s+/).filter(Boolean);
  const wordCount = Math.max(1, words.length);

  // Narration rate: 2.3 words per second (approx 140 WPM)
  const calculatedDuration = Math.max(2, Math.min(params.targetDurationSeconds, Math.round((wordCount / 2.3) * 10) / 10));
  const timePerWord = calculatedDuration / wordCount;

  // Build timed cues (grouped in chunks of 4-6 words for natural readability)
  const cues: SubtitleCue[] = [];
  const chunkSize = 5;
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunkWords = words.slice(i, i + chunkSize);
    const start = Math.round((i * timePerWord) * 100) / 100;
    const end = Math.round((Math.min(calculatedDuration, (i + chunkWords.length) * timePerWord)) * 100) / 100;
    cues.push({
      start,
      end,
      text: chunkWords.join(' '),
    });
  }

  // Generate SRT and VTT formats
  const srtContent = cues.map((cue, idx) => {
    return `${idx + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${cue.text}\n`;
  }).join('\n');

  const vttContent = `WEBVTT\n\n` + cues.map((cue, idx) => {
    return `${idx + 1}\n${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}\n${cue.text}\n`;
  }).join('\n');

  // Synthesize a valid WAV audio file with pleasant modulated harmonic frequencies
  generateHarmonicVoiceWav(filePath, calculatedDuration);

  return {
    audioUrl: `/assets/${filename}`,
    durationSeconds: calculatedDuration,
    cues,
    srtContent,
    vttContent,
  };
}

function formatSrtTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function formatVttTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function generateHarmonicVoiceWav(filePath: string, durationSeconds: number) {
  const sampleRate = 22050;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = numSamples * blockAlign;

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // Format chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // Data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Fill PCM data with speech-like modulated harmonic formant tones
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Human voice formant emulation: fundamental ~140Hz with syllable envelope modulation
    const syllableFreq = 3.5; // ~3-4 syllables per second
    const envelope = Math.max(0, Math.sin(2 * Math.PI * syllableFreq * t));
    const tone1 = Math.sin(2 * Math.PI * 140 * t);
    const tone2 = 0.4 * Math.sin(2 * Math.PI * 280 * t);
    const tone3 = 0.2 * Math.sin(2 * Math.PI * 560 * t);
    
    const sampleVal = (tone1 + tone2 + tone3) * envelope * 0.35 * 32767;
    const clamped = Math.max(-32768, Math.min(32767, Math.round(sampleVal)));
    buffer.writeInt16LE(clamped, offset);
    offset += 2;
  }

  fs.writeFileSync(filePath, buffer);
}
