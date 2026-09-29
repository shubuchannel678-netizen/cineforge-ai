import rateLimit from 'express-rate-limit';

export const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Limit each IP to 2000 requests per `window`
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes'
  }
});

export const generationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 heavy generation requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Generation quota reached. Please wait a few minutes before starting new production pipelines.'
  }
});
