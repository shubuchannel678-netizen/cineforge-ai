import { GoogleVeoProvider } from './GoogleVeoProvider.js';
import type { VideoGenerationProvider } from './types.js';

export * from './types.js';
export { GoogleVeoProvider } from './GoogleVeoProvider.js';

const providerRegistry: Map<string, VideoGenerationProvider> = new Map();

// Register default GoogleVeoProvider
const defaultVeoProvider = new GoogleVeoProvider();
providerRegistry.set('google-veo', defaultVeoProvider);
providerRegistry.set('default', defaultVeoProvider);

export function registerVideoProvider(name: string, provider: VideoGenerationProvider): void {
  providerRegistry.set(name.toLowerCase(), provider);
}

export function getVideoProvider(name: string = 'default'): VideoGenerationProvider {
  const provider = providerRegistry.get(name.toLowerCase()) || providerRegistry.get('default');
  if (!provider) {
    throw new Error(`Video provider "${name}" not found in registry.`);
  }
  return provider;
}
