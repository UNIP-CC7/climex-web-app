import { mockServices } from './mock'
import type { Services } from './types'

const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false'

/**
 * Ponto único de troca entre dados simulados e API real.
 * TODO: implementar services/http quando a API estiver publicada
 * (cliente com Authorization, X-Request-Id, X-Client-Version, X-Device-Id e Idempotency-Key).
 * O que falta na API e as diferenças de contrato estão em docs/contrato-api.md.
 */
if (!useMocks) {
  throw new Error(
    'VITE_USE_MOCKS=false ainda não é suportado: o painel não tem cliente HTTP e a API não está publicada. ' +
      'Defina VITE_USE_MOCKS=true no .env. Detalhes em docs/contrato-api.md.',
  )
}

export const services: Services = mockServices
