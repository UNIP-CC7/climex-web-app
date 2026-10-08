import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx', // ponto de entrada, só monta a árvore
        'src/test-setup.ts',
        'src/test-utils.tsx',
        'src/test-fixtures/**',
        'src/**/*.test.{ts,tsx}',
        'src/@types/**',
        'src/**/styles.ts', // só declaração de estilos
        'src/components/GlobalStyle.ts',
        'src/components/map/**', // Leaflet precisa de navegador de verdade, validado com Playwright
        'src/mocks/seed.ts', // massa de dados
        'src/theme/**',
      ],
      // meta do TCC (RNF de manutenibilidade): 80% de cobertura
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
})
