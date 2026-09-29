import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { env } from '../config/env.js';

const ffmpegPath = env.FFMPEG_PATH || ffmpegInstaller.path;
const ffprobePath = env.FFPROBE_PATH || ffprobeInstaller.path;

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

if (ffprobePath) {
  ffmpeg.setFfprobePath(ffprobePath);
}

export { ffmpeg, ffmpegPath, ffprobePath };
