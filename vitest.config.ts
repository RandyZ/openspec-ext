import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.{ts,tsx}'],
    globals: true,
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@extension': path.resolve(__dirname, 'src/extension'),
      vscode: path.resolve(__dirname, 'test/setup/vscode-stub.ts'),
    },
  },
});
