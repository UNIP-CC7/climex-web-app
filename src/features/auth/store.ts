import { create } from 'zustand'
import type { Role } from '@/domain/types'
import { clearPersistedCache } from '@/lib/persist'
import type { SessionUser } from '@/services/types'

const KEY = 'climex.session'

function read(): SessionUser | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SessionUser) : null
  } catch {
    return null
  }
}
function write(u: SessionUser | null) {
  try {
    if (u) localStorage.setItem(KEY, JSON.stringify(u))
    else localStorage.removeItem(KEY)
  } catch {
    /* sessão só em memória quando o armazenamento está bloqueado */
  }
}

interface AuthState {
  user: SessionUser | null
  signIn: (u: SessionUser) => void
  signOut: () => void
}

export const useAuth = create<AuthState>((set) => ({
  user: read(),
  signIn: (user) => {
    clearPersistedCache() // entrada nova, sem herdar dados de outra sessão
    write(user)
    set({ user })
  },
  signOut: () => {
    clearPersistedCache()
    write(null)
    set({ user: null })
  },
}))

/** Quem pode ver o quê. Cidadão não acessa o painel (usa o app mobile). */
export const ROUTE_ROLES: Record<string, Role[]> = {
  '/': ['AGENTE', 'GESTOR', 'ADMIN'],
  '/mapa': ['AGENTE', 'GESTOR', 'ADMIN'],
  '/socorro': ['AGENTE', 'GESTOR', 'ADMIN'],
  '/abrigos': ['AGENTE', 'GESTOR', 'ADMIN'], // a API também libera PATCH /v1/shelters/:id para o agente
  '/alertas': ['GESTOR', 'ADMIN'],
  '/relatorios': ['GESTOR', 'ADMIN'],
  '/usuarios': ['ADMIN'],
  '/auditoria': ['ADMIN'],
}
