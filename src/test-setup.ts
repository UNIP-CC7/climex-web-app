import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'
import { vi } from 'vitest'
import { OSM_FIXTURE } from './test-fixtures/osm'

// O padrão do Testing Library é 1 s por espera. Em máquina lenta ou com o CI ocupado isso gera falha à toa.
configure({ asyncUtilTimeout: 5000 })

// A base de abrigos é um arquivo estático. Nos testes devolvemos uma amostra pequena.
vi.stubGlobal(
  'fetch',
  vi.fn(async () => ({ ok: true, status: 200, json: async () => OSM_FIXTURE })),
)
