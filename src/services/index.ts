import { createHttpServices } from './http'
import { mockServices } from './mock'
import type { Services } from './types'

/** VITE_USE_MOCKS=false liga a climex-api (veja o README). Qualquer outro valor mantém os dados simulados. */
export const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false'

export const services: Services = useMocks ? mockServices : createHttpServices()
