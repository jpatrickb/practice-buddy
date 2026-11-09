import { defineConfig } from 'vitest/config';

// CLI tests run in plain Node (they need ffmpeg and the filesystem).
export default defineConfig({ test: { include: ['tools/**/*.test.ts'], testTimeout: 60_000 } });
