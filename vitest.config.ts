import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// Tests automatiques : `npm test`. Ils vérifient les calculs (soldes, compensations, paie…)
// à chaque changement, avant chaque mise en ligne.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
    },
  })
)
