import { defineConfig } from 'vitest/config'

// biome-ignore lint/style/noDefaultExport: Vitest config is conventionally exported as default.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
  },
})
