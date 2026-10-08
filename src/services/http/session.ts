/** Tokens da sessão com a API. Ficam no navegador para a sessão sobreviver a um F5. */
export interface Tokens {
  accessToken: string
  refreshToken: string
}

const KEY = 'climex.tokens'

/** Disparado quando a renovação falha. O store de autenticação escuta e sai da conta. */
export const SESSION_EXPIRED_EVENT = 'climex:session-expired'

export interface TokenStore {
  read(): Tokens | null
  save(t: Tokens): void
  clear(): void
}

function storage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

let memory: Tokens | null = null // vale quando o armazenamento está bloqueado

export const browserTokens: TokenStore = {
  read() {
    try {
      const raw = storage()?.getItem(KEY)
      if (raw) return JSON.parse(raw) as Tokens
    } catch {
      /* cai para a memória */
    }
    return memory
  },
  save(t) {
    memory = t
    try {
      storage()?.setItem(KEY, JSON.stringify(t))
    } catch {
      /* só em memória */
    }
  },
  clear() {
    memory = null
    try {
      storage()?.removeItem(KEY)
    } catch {
      /* nada a fazer */
    }
  },
}

export function notifySessionExpired() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}
