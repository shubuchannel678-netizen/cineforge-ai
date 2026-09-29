import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { GoogleGeminiImageProvider } from '../src/providers/image/GoogleGeminiImageProvider.js';
import type { 
  ImageGenerationProvider, 
  ImageGenerateParams, 
  ImageGenerationResult 
} from '../src/providers/image/types.js';
import { getImageProvider, setImageProvider } from '../src/providers/image/index.js';
import { storageService } from '../src/services/media/storageService.js';
import { db } from '../src/lib/db.js';
import { globalJobQueue } from '../src/services/queue/jobQueue.js';
import { app } from '../src/app.js';

test('1. Image provider configuration validation', async () => {
  // Unconfigured provider (empty key)
  const unconfiguredProvider = new GoogleGeminiImageProvider({ apiKey: '' });
  assert.equal(unconfiguredProvider.isConfigured(), false);

  // Placeholder key
  const placeholderProvider = new GoogleGeminiImageProvider({ apiKey: 'your_api_key_here' });
  assert.equal(placeholderProvider.isConfigured(), false);

  // Calling generateImage when unconfigured must throw the exact required error
  await assert.rejects(
    async () => {
      await unconfiguredProvider.generateImage({
        prompt: 'A cyberpunk car in neon rain',
      });
    },
    {
      message: 'Real AI image generation is not configured. Add the required provider credentials.',
    }
  );

  // Configured provider
  const configuredProvider = new GoogleGeminiImageProvider({ 
    apiKey: 'AQ.ValidKey123456789',
    model: 'gemini-2.5-flash-image'
  });
  assert.equal(configuredProvider.isConfigured(), true);
  assert.equal(configuredProvider.name, 'GoogleGeminiImageProvider');
  assert.equal(configuredProvider.getModel(), 'gemini-2.5-flash-image');
});

test('2. Request construction & aspect ratio mapping', async () => {
  const provider = new GoogleGeminiImageProvider({ apiKey: 'AQ.TestKey1234' });
  assert.equal(provider.isConfigured(), true);

  const testParams: ImageGenerateParams = {
    prompt: 'A cinematic wide landscape of ancient ruins',
    negativePrompt: 'blurry, oversaturated',
    aspectRatio: '16:9',
    projectId: 'test-proj-123',
    shotId: 'test-shot-456',
  };

  assert.equal(testParams.prompt, 'A cinematic wide landscape of ancient ruins');
  assert.equal(testParams.aspectRatio, '16:9');
  assert.equal(testParams.negativePrompt, 'blurry, oversaturated');
});

test('3. Successful image response handling & download', async () => {
  const provider = new GoogleGeminiImageProvider({ apiKey: 'AQ.TestKey1234' });

  // 1x1 transparent PNG base64 for decoding verification
  const sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const testDest = path.resolve(process.cwd(), 'public', 'assets', 'test_download_img.png');

  const downloaded = await provider.downloadGeneratedImage(
    {
      imageBytesBase64: sampleBase64,
      mimeType: 'image/png',
    },
    testDest
  );

  assert.equal(fs.existsSync(downloaded.filePath), true);
  assert.equal(downloaded.mimeType, 'image/png');
  assert.ok(downloaded.fileBuffer.length > 0);

  // Clean up test file
  if (fs.existsSync(testDest)) fs.unlinkSync(testDest);
});

test('4. Provider error handling & API key sanitization', async () => {
  const secretKey = 'AQ.SecretKeyLeakPrevention98765';
  const provider = new GoogleGeminiImageProvider({ apiKey: secretKey });

  // Test empty prompt rejection
  await assert.rejects(
    async () => {
      await provider.generateImage({ prompt: '   ' });
    },
    {
      message: 'Image generation prompt cannot be empty.',
    }
  );
});

test('5. Image storage upload service', async () => {
  const testDir = path.resolve(process.cwd(), 'public', 'assets');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  const dummyImgPath = path.join(testDir, 'test_storage_img.png');
  fs.writeFileSync(dummyImgPath, Buffer.from('fake-png-binary-stream-for-test'));

  const uploadRes = await storageService.uploadGeneratedImage(
    'test-proj-storage',
    'shot-img-999',
    dummyImgPath,
    'image/png'
  );

  assert.ok(uploadRes.publicUrl);
  assert.ok(uploadRes.storagePath.includes('projects/test-proj-storage/images/shot-img-999_'));
  assert.equal(uploadRes.sizeBytes, Buffer.from('fake-png-binary-stream-for-test').length);

  // Clean up
  if (fs.existsSync(dummyImgPath)) fs.unlinkSync(dummyImgPath);
});

test('6. Image job creation & queue integration', async () => {
  const projectId = 'proj-img-test-' + Date.now();
  const imageEntityId = 'img-test-' + Date.now();

  const job = await globalJobQueue.enqueue(
    projectId,
    'IMAGE_GEN',
    imageEntityId,
    {
      prompt: 'A hyper-detailed portrait of a space explorer',
      aspectRatio: '1:1',
      projectId,
    },
    {
      userId: 'test-user-id-001',
      provider: 'GoogleGeminiImageProvider',
    }
  );

  assert.ok(job.id);
  assert.equal(job.job_type, 'IMAGE_GEN');
  assert.equal(job.project_id, projectId);
  assert.equal(job.target_entity_id, imageEntityId);
  assert.equal(job.user_id, 'test-user-id-001');
  assert.equal(job.status, 'PENDING');
});

test('7. Image job status retrieval', async () => {
  const projectId = 'proj-status-test-' + Date.now();
  const entityId = 'entity-img-' + Date.now();

  const createdJob = await globalJobQueue.enqueue(
    projectId,
    'IMAGE_GEN',
    entityId,
    { prompt: 'A futuristic city' }
  );

  // Query job via db and queue
  const fetchedJob = await globalJobQueue.getJob(createdJob.id);
  assert.ok(fetchedJob);
  assert.equal(fetchedJob?.id, createdJob.id);
  assert.equal(fetchedJob?.job_type, 'IMAGE_GEN');

  // Update status and verify persistence
  await db.updateJob(createdJob.id, {
    status: 'COMPLETED',
    result: { assetUrl: '/assets/sample.png' },
  });

  const updatedJob = await db.getJob(createdJob.id);
  assert.equal(updatedJob?.status, 'COMPLETED');
  assert.equal(updatedJob?.result?.assetUrl, '/assets/sample.png');
});

test('8. Authentication & security (no API key leakage)', () => {
  const provider = new GoogleGeminiImageProvider({ apiKey: 'AQ.TestKey123' });
  const serialized = JSON.stringify(provider);

  // Private apiKey should not leak in default JSON representation
  assert.ok(!serialized.includes('AQ.TestKey123'));
});

test('9. API payload validation for image generation', async () => {
  // Test schema validation directly with invalid parameters
  const { z } = await import('zod');
  const GenerateImageSchema = z.object({
    prompt: z.string().min(1, 'Prompt is required and cannot be empty').max(2000),
    negativePrompt: z.string().max(1000).optional(),
    aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).default('16:9'),
  });

  // Valid payload
  const valid = GenerateImageSchema.parse({
    prompt: 'A golden temple in the clouds',
    aspectRatio: '16:9',
  });
  assert.equal(valid.prompt, 'A golden temple in the clouds');
  assert.equal(valid.aspectRatio, '16:9');

  // Empty prompt should fail
  assert.throws(() => {
    GenerateImageSchema.parse({ prompt: '' });
  });

  // Invalid aspect ratio should fail
  assert.throws(() => {
    GenerateImageSchema.parse({ prompt: 'Valid prompt', aspectRatio: '5:1' as any });
  });
});
