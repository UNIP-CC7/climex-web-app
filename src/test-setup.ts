import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'
import { OSM_FIXTURE } from './test-fixtures/osm'

// A base de abrigos é um arquivo estático. Nos testes devolvemos uma amostra pequena.
vi.stubGlobal(
  'fetch',
  vi.fn(async () => ({ ok: true, status: 200, json: async () => OSM_FIXTURE })),
)
