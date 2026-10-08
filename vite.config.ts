import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// VITE_API_URL é só a origem da API. Se alguém colocar o /v1 no fim, tira, senão o proxy chamaria /v1/v1.
function apiOrigin(raw: string | undefined): string {
  return (raw?.trim() || 'http://localhost:3000').replace(/\/+$/, '').replace(/\/v1$/, '')
}

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // O painel chama /v1 no próprio endereço e o Vite repassa para a API. Como o navegador só vê a mesma origem,
  // não há CORS (a API hoje só libera GET, HEAD e POST, então todo PATCH seria barrado).
  server: {
    proxy: { '/v1': { target: apiOrigin(loadEnv(mode, process.cwd(), '').VITE_API_URL), changeOrigin: true } },
  },
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
}))
