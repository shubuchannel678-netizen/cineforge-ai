import { app } from './app.js';
import { env } from './config/env.js';
import { globalJobQueue } from './services/queue/jobQueue.js';
import { initializeQueueWorkers } from './services/queue/workers.js';

const PORT = env.PORT || 5000;

// Initialize workers
initializeQueueWorkers();
globalJobQueue.startWorker(1000);

const server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🎬 CineForge AI Server Online`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`⚙️  Environment: ${env.NODE_ENV}`);
  console.log(`🤖 Gemini SDK: Configured (Official @google/genai)`);
  console.log(`🎥 FFmpeg Engine: Active`);
  console.log(`=======================================================`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Stopping workers and closing server...');
  globalJobQueue.stopWorker();
  server.close(() => {
    console.log('Server terminated cleanly.');
  });
});
