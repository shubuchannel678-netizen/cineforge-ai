import fs from 'fs';
import path from 'path';

const ASSETS_DIR = path.resolve(process.cwd(), 'public', 'assets');
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

export async function generateBackgroundMusicTrack(params: {
  projectId: string;
  durationSeconds: number;
  mood: string;
}): Promise<string> {
  const filename = `music_${params.projectId}.wav`;
  const filePath = path.join(ASSETS_DIR, filename);

  if (fs.existsSync(filePath)) {
    return `/assets/${filename}`;
  }

  // Synthesize an atmospheric ambient soundscape WAV
  generateAmbientScoreWav(filePath, params.durationSeconds, params.mood);
  return `/assets/${filename}`;
}

export async function generateSfxTrack(params: {
  shotId: string;
  cue: string;
  durationSeconds: number;
}): Promise<string> {
  const filename = `sfx_${params.shotId}.wav`;
  const filePath = path.join(ASSETS_DIR, filename);

  if (fs.existsSync(filePath)) {
    return `/assets/${filename}`;
  }

  // Synthesize SFX riser/impact tone
  generateSfxWav(filePath, Math.min(3, params.durationSeconds));
  return `/assets/${filename}`;
}

function generateAmbientScoreWav(filePath: string, durationSeconds: number, mood: string) {
  const sampleRate = 22050;
  const numChannels = 2; // Stereo
  const bitsPerSample = 16;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = numSamples * blockAlign;

  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Deep cinematic pad / drone chords (Root + Minor 3rd / 5th)
  const isTense = mood.toLowerCase().includes('tense') || mood.toLowerCase().includes('dramatic');
  const baseFreq = isTense ? 65.41 : 55.0; // C2 or A1
  const freq2 = isTense ? baseFreq * 1.5 : baseFreq * 1.334;
  const freq3 = baseFreq * 2.0;

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Slow evolving LFO modulation
    const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.1 * t);
    const leftSig = (Math.sin(2 * Math.PI * baseFreq * t) + 0.6 * Math.sin(2 * Math.PI * freq2 * t)) * lfo * 0.15;
    const rightSig = (Math.sin(2 * Math.PI * baseFreq * 1.002 * t) + 0.6 * Math.sin(2 * Math.PI * freq3 * t)) * (1 - lfo * 0.3) * 0.15;

    const leftVal = Math.max(-32768, Math.min(32767, Math.round(leftSig * 32767)));
    const rightVal = Math.max(-32768, Math.min(32767, Math.round(rightSig * 32767)));

    buffer.writeInt16LE(leftVal, offset);
    buffer.writeInt16LE(rightVal, offset + 2);
    offset += 4;
  }

  fs.writeFileSync(filePath, buffer);
}

function generateSfxWav(filePath: string, durationSeconds: number) {
  const sampleRate = 22050;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const blockAlign = 2;
  const dataSize = numSamples * blockAlign;

  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Sub bass impact / whoosh envelope
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const decay = Math.exp(-3 * t);
    const freq = 120 * (1 - t / durationSeconds) + 40;
    const sample = Math.sin(2 * Math.PI * freq * t) * decay * 0.4 * 32767;
    const clamped = Math.max(-32768, Math.min(32767, Math.round(sample)));
    buffer.writeInt16LE(clamped, offset);
    offset += 2;
  }

  fs.writeFileSync(filePath, buffer);
}
