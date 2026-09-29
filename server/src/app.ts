import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { standardLimiter } from './middleware/rateLimiter.js';
import { projectRouter } from './routes/projectRoutes.js';
import { bibleRouter } from './routes/bibleRoutes.js';
import { shotRouter } from './routes/shotRoutes.js';
import { renderRouter } from './routes/renderRoutes.js';
import { imageRouter } from './routes/imageRoutes.js';
import { getVideoProvider } from './providers/video/index.js';
import { getImageProvider } from './providers/image/index.js';

export const app = express();

// Security and utility middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: env.CLIENT_URL || '*',
  credentials: true,
}));

app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static asset serving for generated media & previews
const publicAssetsDir = path.resolve(process.cwd(), 'public', 'assets');
app.use('/assets', express.static(publicAssetsDir));

function getHealthReport() {
  const videoProvider = getVideoProvider() as any;
  const imageProvider = getImageProvider() as any;
  const geminiConfigured = Boolean(
    env.GEMINI_API_KEY && 
    env.GEMINI_API_KEY.trim() !== '' && 
    !env.GEMINI_API_KEY.includes('your_') &&
    !env.GEMINI_API_KEY.includes('placeholder')
  );

  const isVideoQuotaExhausted = typeof videoProvider.isQuotaExhausted === 'function' ? videoProvider.isQuotaExhausted() : false;
  const isImageQuotaExhausted = typeof imageProvider.isQuotaExhausted === 'function' ? imageProvider.isQuotaExhausted() : false;
  const isQuotaExhausted = isVideoQuotaExhausted || isImageQuotaExhausted;

  let providerStatus: string;
  let generationAvailability: string;

  if (!videoProvider.isConfigured()) {
    providerStatus = 'Not Configured';
    generationAvailability = 'API Key Required for Generation';
  } else if (isQuotaExhausted) {
    providerStatus = 'Quota Unavailable (HTTP 429)';
    generationAvailability = 'Google API quota is unavailable for this key/project.';
  } else {
    providerStatus = 'Configured (Active Key)';
    generationAvailability = 'API Key Configured (Live Quota Verification Active)';
  }

  return {
    status: isQuotaExhausted ? 'degraded' : 'healthy',
    service: 'CineForge AI Backend Orchestration Service',
    timestamp: new Date().toISOString(),
    providerStatus,
    apiConfigurationStatus: geminiConfigured ? 'GEMINI_API_KEY Configured' : 'Missing / Incomplete API Key',
    quotaStatus: isQuotaExhausted ? 'Exhausted (429)' : 'Active',
    quotaAvailable: !isQuotaExhausted && geminiConfigured,
    videoProvider: videoProvider.name,
    videoModel: env.VEO_MODEL,
    imageProvider: imageProvider.name,
    imageModel: env.IMAGE_MODEL,
    generationAvailability,
    geminiConfigured,
    supabaseConfigured: Boolean(env.SUPABASE_URL && !env.SUPABASE_URL.includes('your-project')),
    veoConfigured: videoProvider.isConfigured(),
    veoModel: env.VEO_MODEL,
    imageConfigured: imageProvider.isConfigured(),
  };
}

// System Health Check
app.get('/health', (req, res) => {
  res.json(getHealthReport());
});

// API Routes with rate limiting & auth protection
const apiRouter = express.Router();
apiRouter.use(standardLimiter);

// Public health route under /api/v1
apiRouter.get('/health', (req, res) => {
  res.json(getHealthReport());
});

apiRouter.use(requireAuth);

// Mount resource routes
apiRouter.use('/projects', projectRouter);
apiRouter.use('/projects/:id/bibles', bibleRouter);
apiRouter.use('/projects/:id/shots', shotRouter);
apiRouter.use('/projects/:id', renderRouter);
apiRouter.use('/images', imageRouter);

app.use('/api/v1', apiRouter);

// Global Error Handler
app.use(errorHandler);
