import { createHttpServices } from './http'
import { mockServices } from './mock'
import type { Services } from './types'

/** O painel fala com a climex-api (veja o README). VITE_USE_MOCKS=true liga os dados simulados, para demonstração e testes. */
export const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'

export const services: Services = useMocks ? mockServices : createHttpServices()
