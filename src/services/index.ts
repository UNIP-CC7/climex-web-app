import { createHttpServices } from './http'
import { mockServices } from './mock'
import type { Services } from './types'

/** VITE_USE_MOCKS=false liga a climex-api (veja o README). Qualquer outro valor mantém os dados simulados. */
export const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false'

/** O que a API ainda não oferece. As telas usam isso para explicar a lacuna em vez de mostrar uma lista vazia. */
export const capabilities = {
  /** GET /admin/users não existe: sem ele não há de onde tirar o id para trocar o perfil. */
  listUsers: useMocks,
  /** POST /shelters/:id/check-out não existe: sem ele o botão de saída sempre falharia. */
  shelterCheckOut: useMocks,
}

export const services: Services = useMocks ? mockServices : createHttpServices()
