import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/templates/**', // User project templates, not CLI tests
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        'src/index.ts', // CLI entry point - tested via integration
        'src/commands/**', // CLI commands - tested via e2e
        'src/setup/**', // Setup modules - tested via integration
        'src/auth/**', // OAuth flow - tested via integration
        'src/analyze/issues.ts', // Complex GitHub API logic
      ],
      thresholds: {
        statements: 80,
        branches: 40,
        functions: 100,
        lines: 80,
      },
    },
  },
});
