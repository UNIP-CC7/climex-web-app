import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import type { Query } from '@tanstack/react-query'
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client'

/** Chave do cache no armazenamento do navegador. */
export const PERSIST_KEY = 'climex.cache'

/** Por quanto tempo os dados salvos continuam valendo, mesmo sem conexão (card P-08, RNF de operação offline). */
export const CACHE_MAX_AGE = 72 * 60 * 60 * 1000

/** Trocar ao mudar o formato dos dados em cache, para descartar o que foi salvo na versão anterior. */
export const CACHE_BUSTER = 'v2' // v2: risco passou a ser { score, band }

/**
 * Só dados operacionais vão para o disco. Ficam de fora:
 * - `users` e `audit`: têm dados pessoais (telefone, IP) e não devem sobrar no navegador;
 * - `shelters`: é um arquivo estático de ~3 MB que o próprio navegador já guarda em cache HTTP.
 */
const PERSISTED_KEYS = new Set(['summary', 'alerts', 'rescue'])

export function shouldPersist(query: Pick<Query, 'queryKey' | 'state'>): boolean {
  return query.state.status === 'success' && PERSISTED_KEYS.has(String(query.queryKey[0]))
}

function browserStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined // armazenamento bloqueado: o painel segue só com a memória
  }
}

export function makePersister(storage: Storage | undefined = browserStorage(), throttleTime = 1000) {
  return createSyncStoragePersister({ storage, key: PERSIST_KEY, throttleTime })
}

export const persister = makePersister()

/** Apaga o cache salvo. Chamado ao sair da conta, para dados de um perfil não ficarem para o próximo. */
export function clearPersistedCache(storage: Storage | undefined = browserStorage()) {
  try {
    storage?.removeItem(PERSIST_KEY)
  } catch {
    /* nada a fazer */
  }
}

/** Opções do PersistQueryClientProvider: o que salvar, onde e por quanto tempo. */
export const persistOptions: PersistQueryClientProviderProps['persistOptions'] = {
  persister,
  maxAge: CACHE_MAX_AGE,
  buster: CACHE_BUSTER,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
}
