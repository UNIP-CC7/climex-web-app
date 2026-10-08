import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client'
import { CACHE_BUSTER, CACHE_MAX_AGE, PERSIST_KEY, clearPersistedCache, makePersister, persistOptions, shouldPersist } from './persist'

type Q = Parameters<typeof shouldPersist>[0]
const ok = (key: string) => ({ queryKey: [key], state: { status: 'success' } }) as unknown as Q

const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms))

beforeEach(() => localStorage.clear())
afterEach(() => vi.useRealTimers())

describe('o que vai para o disco', () => {
  it('guarda resumo, alertas e solicitações bem-sucedidos', () => {
    for (const k of ['summary', 'alerts', 'rescue']) expect(shouldPersist(ok(k))).toBe(true)
  })

  it('deixa de fora dados pessoais e a base grande de abrigos', () => {
    for (const k of ['users', 'audit', 'shelters']) expect(shouldPersist(ok(k))).toBe(false)
  })

  it('não guarda consulta com erro nem em andamento', () => {
    expect(shouldPersist({ queryKey: ['alerts'], state: { status: 'error' } } as never)).toBe(false)
    expect(shouldPersist({ queryKey: ['alerts'], state: { status: 'pending' } } as never)).toBe(false)
  })

  it('usa 72 horas e a chave do painel', () => {
    expect(CACHE_MAX_AGE).toBe(72 * 60 * 60 * 1000)
    expect(persistOptions.maxAge).toBe(CACHE_MAX_AGE)
    expect(persistOptions.buster).toBe(CACHE_BUSTER)
    expect(PERSIST_KEY).toBe('climex.cache')
  })
})

describe('salvar e restaurar', () => {
  const salvar = async (client: QueryClient) => {
    await persistQueryClientSave({
      queryClient: client,
      persister: makePersister(localStorage, 0),
      buster: CACHE_BUSTER,
      dehydrateOptions: persistOptions.dehydrateOptions,
    })
    await wait()
  }
  const restaurar = (client: QueryClient, opts: { maxAge?: number; buster?: string } = {}) =>
    persistQueryClientRestore({
      queryClient: client,
      persister: makePersister(localStorage, 0),
      maxAge: opts.maxAge ?? CACHE_MAX_AGE,
      buster: opts.buster ?? CACHE_BUSTER,
    })

  it('grava só o permitido e devolve os dados numa sessão nova', async () => {
    const a = new QueryClient()
    a.setQueryData(['alerts'], [{ id: 'al-1' }])
    a.setQueryData(['users'], [{ id: 'u-1', phone: '(11) 9 0000-0000' }])
    await salvar(a)

    const gravado = localStorage.getItem(PERSIST_KEY) ?? ''
    expect(gravado).toContain('al-1')
    expect(gravado).not.toContain('0000-0000')

    const b = new QueryClient()
    await restaurar(b)
    expect(b.getQueryData(['alerts'])).toEqual([{ id: 'al-1' }])
    expect(b.getQueryData(['users'])).toBeUndefined()
  })

  it('descarta o que passou de 72 horas', async () => {
    const a = new QueryClient()
    a.setQueryData(['rescue'], [{ id: 'rs-1' }])
    await salvar(a)

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + CACHE_MAX_AGE + 60_000)
    const b = new QueryClient()
    await restaurar(b)
    expect(b.getQueryData(['rescue'])).toBeUndefined()
    expect(localStorage.getItem(PERSIST_KEY)).toBeNull()
  })

  it('mantém o que ainda está dentro das 72 horas', async () => {
    const a = new QueryClient()
    a.setQueryData(['summary'], { activeAlerts: 3 })
    await salvar(a)

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + CACHE_MAX_AGE - 60_000)
    const b = new QueryClient()
    await restaurar(b)
    expect(b.getQueryData(['summary'])).toEqual({ activeAlerts: 3 })
  })

  it('descarta quando o formato dos dados mudou (buster)', async () => {
    const a = new QueryClient()
    a.setQueryData(['alerts'], [{ id: 'al-1' }])
    await salvar(a)
    const b = new QueryClient()
    await restaurar(b, { buster: 'formato-antigo' })
    expect(b.getQueryData(['alerts'])).toBeUndefined()
  })
})

describe('apagar o cache', () => {
  it('remove a chave salva', () => {
    localStorage.setItem(PERSIST_KEY, '{}')
    clearPersistedCache()
    expect(localStorage.getItem(PERSIST_KEY)).toBeNull()
  })

  it('não quebra se o armazenamento está bloqueado ou ausente', () => {
    const bloqueado = {
      removeItem: () => {
        throw new Error('bloqueado')
      },
    } as unknown as Storage
    expect(() => clearPersistedCache(bloqueado)).not.toThrow()
    expect(() => clearPersistedCache(undefined)).not.toThrow()
  })
})
