import { mockServices } from './mock'
import type { Services } from './types'

const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false'

/**
 * Ponto único de troca entre dados simulados e API real.
 * TODO: implementar services/http quando a API estiver publicada
 * (cliente com Authorization, X-Request-Id, X-Client-Version, X-Device-Id e Idempotency-Key).
 */
if (!useMocks) {
  throw new Error('VITE_USE_MOCKS=false ainda não é suportado: a API não está publicada e services/http não existe.')
}

export const services: Services = mockServices
