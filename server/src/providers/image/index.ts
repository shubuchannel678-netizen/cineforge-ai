import type { ImageGenerationProvider } from './types.js';
import { GoogleGeminiImageProvider } from './GoogleGeminiImageProvider.js';

export * from './types.js';
export * from './GoogleGeminiImageProvider.js';

let defaultImageProvider: ImageGenerationProvider | null = null;

export function getImageProvider(): ImageGenerationProvider {
  if (!defaultImageProvider) {
    defaultImageProvider = new GoogleGeminiImageProvider();
  }
  return defaultImageProvider;
}

export function setImageProvider(provider: ImageGenerationProvider): void {
  defaultImageProvider = provider;
}
