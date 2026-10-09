import { describe, expect, it, vi } from 'vitest'
import { ApiError, createHttpClient, normalizeBaseUrl } from './client'
import type { TokenStore, Tokens } from './session'

function memoryTokens(initial: Tokens | null): TokenStore & { current: Tokens | null } {
  const store = {
    current: initial,
    read: () => store.current,
    save: (t: Tokens) => {
      store.current = t
    },
    clear: () => {
      store.current = null
    },
  }
  return store
}

const json = (status: number, body: unknown, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': type } })

const pair = (n: number) => ({ accessToken: `acc${n}`, refreshToken: `ref${n}`, expiresIn: 900, user: {} })

function setup(
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
  tokens: Tokens | null = { accessToken: 'acc0', refreshToken: 'ref0' },
) {
  const fetchImpl = vi.fn((url: string, init: RequestInit) => Promise.resolve(handler(url, init))) as unknown as typeof fetch &
    ReturnType<typeof vi.fn>
  const store = memoryTokens(tokens)
  const onSessionExpired = vi.fn()
  let n = 0
  const client = createHttpClient({ fetchImpl, tokens: store, onSessionExpired, requestId: () => `req-${++n}` })
  return { client, fetchImpl, store, onSessionExpired }
}
const headers = (call: unknown[]) => (call[1] as RequestInit).headers as Record<string, string>

describe('cliente HTTP', () => {
  it('envia token, X-Request-Id, prefixo /v1 e query', async () => {
    const { client, fetchImpl } = setup(() => json(200, { ok: true }))
    await client.get('/alerts', { status: 'ACTIVE', page: 2, vazio: undefined })
    const call = fetchImpl.mock.calls[0]
    expect(call[0]).toBe('/v1/alerts?status=ACTIVE&page=2')
    expect(headers(call)).toMatchObject({ Authorization: 'Bearer acc0', 'X-Request-Id': 'req-1', Accept: 'application/json' })
    expect((call[1] as RequestInit).method).toBe('GET')
  })

  it('usa o endereço base quando informado e remove a barra final', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(json(200, {}))) as unknown as typeof fetch & ReturnType<typeof vi.fn>
    const c = createHttpClient({ fetchImpl, tokens: memoryTokens(null), baseUrl: 'http://api.test/' })
    await c.get('/x')
    expect(fetchImpl.mock.calls[0][0]).toBe('http://api.test/v1/x')
  })

  it('normaliza o endereço base: barra final, /v1 e espaços saem', () => {
    expect(normalizeBaseUrl(undefined)).toBe('')
    expect(normalizeBaseUrl('  https://api.exemplo.com.br/v1/ ')).toBe('https://api.exemplo.com.br')
    expect(normalizeBaseUrl('https://api.exemplo.com.br//')).toBe('https://api.exemplo.com.br')
    expect(normalizeBaseUrl('http://localhost:3000')).toBe('http://localhost:3000')
  })

  it.each([
    'api.exemplo.com.br',
    'ftp://api.exemplo.com.br',
    'https://api.exemplo.com.br/outra',
    'https://u:p@api.exemplo.com.br',
    'https://api.exemplo.com.br?x=1',
    'https://api.exemplo.com.br#a',
  ])('recusa endereço que não é só uma origem http(s): %s', (v) => {
    expect(() => normalizeBaseUrl(v)).toThrow(/Endereço da API inválido/)
  })

  it('usa VITE_API_BASE_URL quando o endereço base não é informado', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.exemplo.com.br/')
    try {
      const fetchImpl = vi.fn(() => Promise.resolve(json(200, {}))) as unknown as typeof fetch & ReturnType<typeof vi.fn>
      const c = createHttpClient({ fetchImpl, tokens: memoryTokens(null) })
      await c.get('/x')
      expect(fetchImpl.mock.calls[0][0]).toBe('https://api.exemplo.com.br/v1/x')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('envia corpo JSON em POST e PATCH e não manda Authorization sem token', async () => {
    const { client, fetchImpl } = setup(() => json(200, {}), null)
    await client.post('/auth/login', { phone: '+55', password: 'x' }, { auth: false })
    await client.patch('/shelters/1', { capacity: 5 })
    const [login, patch] = fetchImpl.mock.calls
    expect(headers(login)['Content-Type']).toBe('application/json')
    expect(headers(login).Authorization).toBeUndefined()
    expect((login[1] as RequestInit).body).toBe('{"phone":"+55","password":"x"}')
    expect((patch[1] as RequestInit).method).toBe('PATCH')
  })

  it('não manda o token nas rotas públicas mesmo com sessão ativa', async () => {
    const { client, fetchImpl } = setup(() => json(200, {}))
    await client.post('/auth/login', {}, { auth: false })
    expect(headers(fetchImpl.mock.calls[0]).Authorization).toBeUndefined()
  })

  it('204 devolve undefined', async () => {
    const { client } = setup(() => new Response(null, { status: 204 }))
    await expect(client.post('/auth/logout', {})).resolves.toBeUndefined()
  })

  it('renova o token em 401 e repete a chamada com o novo', async () => {
    const { client, fetchImpl, store } = setup((url, init) => {
      if (url === '/v1/auth/refresh') return json(200, pair(1))
      return (init.headers as Record<string, string>).Authorization === 'Bearer acc1'
        ? json(200, { data: 1 })
        : json(401, { code: 'UNAUTHENTICATED' })
    })
    await expect(client.get('/alerts')).resolves.toEqual({ data: 1 })
    expect(store.current).toEqual({ accessToken: 'acc1', refreshToken: 'ref1' })
    const refreshCall = fetchImpl.mock.calls.find((c) => c[0] === '/v1/auth/refresh')!
    expect((refreshCall[1] as RequestInit).body).toBe('{"refreshToken":"ref0"}')
    expect(headers(refreshCall).Authorization).toBeUndefined()
  })

  it('várias chamadas com 401 ao mesmo tempo fazem uma só renovação', async () => {
    const { client, fetchImpl } = setup((url, init) => {
      if (url === '/v1/auth/refresh') return json(200, pair(1))
      return (init.headers as Record<string, string>).Authorization === 'Bearer acc1' ? json(200, { ok: 1 }) : json(401, {})
    })
    await Promise.all([client.get('/a'), client.get('/b'), client.get('/c')])
    expect(fetchImpl.mock.calls.filter((c) => c[0] === '/v1/auth/refresh')).toHaveLength(1)
  })

  it('se a renovação falha, limpa a sessão, avisa e lança erro 401', async () => {
    const { client, store, onSessionExpired } = setup((url) => (url === '/v1/auth/refresh' ? json(401, { code: 'UNAUTHENTICATED' }) : json(401, {})))
    const err = await client.get('/alerts').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 401, code: 'SESSION_EXPIRED' })
    expect(store.current).toBeNull()
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('401 sem refresh token guardado devolve o erro da API sem tentar renovar', async () => {
    const { client, fetchImpl, onSessionExpired } = setup(() => json(401, { detail: 'Credenciais inválidas', code: 'UNAUTHENTICATED' }), null)
    await expect(client.post('/auth/login', {}, { auth: false })).rejects.toMatchObject({ status: 401, message: 'Credenciais inválidas' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  it('lê application/problem+json', async () => {
    const { client } = setup(() =>
      json(
        404,
        { type: 't', title: 'Recurso não encontrado', status: 404, detail: 'Alerta x não existe', code: 'NOT_FOUND', traceId: 'tr-1' },
        'application/problem+json',
      ),
    )
    const err = (await client.get('/alerts/x').catch((e) => e)) as ApiError
    expect(err).toMatchObject({ status: 404, message: 'Alerta x não existe', code: 'NOT_FOUND', traceId: 'tr-1' })
  })

  it('422 junta o que cada campo reclamou', async () => {
    const { client } = setup(() =>
      json(
        422,
        {
          detail: 'Dados inválidos',
          code: 'VALIDATION_ERROR',
          errors: [
            { field: 'outcomeNote', message: 'Informe o desfecho' },
            { field: 'x', message: 'y' },
          ],
        },
        'application/problem+json',
      ),
    )
    const err = (await client.patch('/rescue/1/status', {}).catch((e) => e)) as ApiError
    expect(err.status).toBe(422)
    expect(err.message).toBe('Dados inválidos outcomeNote: Informe o desfecho; x: y')
    expect(err.fields).toHaveLength(2)
  })

  it('409 de capacidade chega com a mensagem da API', async () => {
    const { client } = setup(() => json(409, { detail: 'Capacidade menor que a ocupação atual', code: 'CONFLICT' }, 'application/problem+json'))
    await expect(client.patch('/shelters/1', { capacity: 1 })).rejects.toMatchObject({
      status: 409,
      message: 'Capacidade menor que a ocupação atual',
    })
  })

  it('erro 500 sem corpo JSON ganha mensagem amigável', async () => {
    const { client } = setup(() => new Response('<html>', { status: 500 }))
    await expect(client.get('/x')).rejects.toMatchObject({ status: 500, message: expect.stringContaining('A API teve um problema') })
    const r400 = setup(() => new Response('', { status: 400 }))
    await expect(r400.client.get('/x')).rejects.toMatchObject({ status: 400, message: 'Erro 400' })
  })

  it('sem rede vira erro de status 0', async () => {
    const { client } = setup(() => {
      throw new TypeError('Failed to fetch')
    })
    await expect(client.get('/x')).rejects.toMatchObject({ status: 0, message: expect.stringContaining('Sem conexão') })
  })

  it('all percorre as páginas até o fim', async () => {
    const { client, fetchImpl } = setup((url) => {
      const page = Number(new URL(url, 'http://x').searchParams.get('page'))
      return json(200, { data: [page * 10, page * 10 + 1], pagination: { page, limit: 100, total: 6, pages: 3, hasNext: page < 3 } })
    })
    await expect(client.all<number>('/rescue', { status: 'PENDING' })).resolves.toEqual([10, 11, 20, 21, 30, 31])
    expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual([
      '/v1/rescue?status=PENDING&page=1&limit=100',
      '/v1/rescue?status=PENDING&page=2&limit=100',
      '/v1/rescue?status=PENDING&page=3&limit=100',
    ])
  })

  it('all respeita o limite de páginas', async () => {
    const { client, fetchImpl } = setup(() => json(200, { data: [1], pagination: { page: 1, limit: 100, total: 999, pages: 99, hasNext: true } }))
    await expect(client.all<number>('/x', {}, 2)).resolves.toEqual([1, 1])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('erro de rede ou 5xx na renovação NÃO apaga a sessão', async () => {
    const offline = setup((url) => {
      if (url === '/v1/auth/refresh') throw new TypeError('offline')
      return json(401, {})
    })
    await expect(offline.client.get('/alerts')).rejects.toMatchObject({ status: 503 })
    expect(offline.store.current).toEqual({ accessToken: 'acc0', refreshToken: 'ref0' })
    expect(offline.onSessionExpired).not.toHaveBeenCalled()

    const down = setup((url) => (url === '/v1/auth/refresh' ? json(502, {}) : json(401, {})))
    await expect(down.client.get('/alerts')).rejects.toMatchObject({ status: 503 })
    expect(down.store.current).not.toBeNull()
    expect(down.onSessionExpired).not.toHaveBeenCalled()
  })

  it('resposta de renovação ilegível também não apaga a sessão', async () => {
    const { client, store } = setup((url) => (url === '/v1/auth/refresh' ? new Response('<html>', { status: 200 }) : json(401, {})))
    await expect(client.get('/alerts')).rejects.toMatchObject({ status: 503 })
    expect(store.current).not.toBeNull()
    const sem = setup((url) => (url === '/v1/auth/refresh' ? json(200, { foo: 1 }) : json(401, {})))
    await expect(sem.client.get('/alerts')).rejects.toMatchObject({ status: 503 })
  })

  it('se o par novo também levar 401, encerra a sessão sem renovar de novo', async () => {
    const { client, fetchImpl, store, onSessionExpired } = setup((url) => (url === '/v1/auth/refresh' ? json(200, pair(1)) : json(401, {})))
    await expect(client.get('/alerts')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    expect(fetchImpl.mock.calls.filter((c) => c[0] === '/v1/auth/refresh')).toHaveLength(1)
    expect(store.current).toBeNull()
    expect(onSessionExpired).toHaveBeenCalled()
  })

  it('401 em rota autenticada sem nenhuma sessão guardada encerra o estado local', async () => {
    const { client, onSessionExpired } = setup(() => json(401, {}), null)
    await expect(client.get('/alerts')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    expect(onSessionExpired).toHaveBeenCalled()
  })

  it('se outra chamada ou aba já trocou o token, repete com o atual sem renovar', async () => {
    const { client, fetchImpl, store } = setup((_url, init) => {
      if ((init.headers as Record<string, string>).Authorization === 'Bearer acc9') return json(200, { ok: 1 })
      store.current = { accessToken: 'acc9', refreshToken: 'ref9' } // outra aba renovou enquanto esta esperava a resposta
      return json(401, {})
    })
    await expect(client.get('/alerts')).resolves.toEqual({ ok: 1 })
    expect(fetchImpl.mock.calls.some((c) => c[0] === '/v1/auth/refresh')).toBe(false)
  })

  it('se o usuário sai durante a renovação, o par novo não ressuscita a sessão', async () => {
    const { client, store, onSessionExpired } = setup((url) => {
      if (url === '/v1/auth/refresh') {
        store.current = null // signOut no meio da chamada
        return json(200, pair(1))
      }
      return json(401, {})
    })
    await expect(client.get('/alerts')).rejects.toMatchObject({ code: 'SESSION_CHANGED' })
    expect(store.current).toBeNull()
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  it('usa Web Locks para renovar quando o navegador tem', async () => {
    const request = vi.fn((...args: unknown[]) => (args[args.length - 1] as () => Promise<unknown>)())
    vi.stubGlobal('navigator', { locks: { request } })
    try {
      const { client } = setup((url, init) => {
        if (url === '/v1/auth/refresh') return json(200, pair(1))
        return (init.headers as Record<string, string>).Authorization === 'Bearer acc1' ? json(200, {}) : json(401, {})
      })
      await client.get('/alerts')
      expect(request).toHaveBeenCalledWith('climex-refresh-token', expect.objectContaining({ signal: expect.anything() }), expect.any(Function))
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('resposta 200 que não é JSON vira erro da API, não SyntaxError', async () => {
    const { client } = setup(() => new Response('<html>', { status: 200 }))
    await expect(client.get('/x')).rejects.toBeInstanceOf(ApiError)
  })

  it('só 400, 401, 403 e 422 do refresh encerram a sessão; 429 e outros são passageiros', async () => {
    for (const status of [400, 401, 403, 422]) {
      const s = setup((url) => (url === '/v1/auth/refresh' ? json(status, {}) : json(401, {})))
      await expect(s.client.get('/x')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
      expect(s.store.current).toBeNull()
    }
    for (const status of [408, 429, 404]) {
      const s = setup((url) => (url === '/v1/auth/refresh' ? json(status, {}) : json(401, {})))
      await expect(s.client.get('/x')).rejects.toMatchObject({ status: 503 })
      expect(s.store.current).not.toBeNull()
    }
  })

  it('um 401 tardio da repetição não apaga a sessão de quem entrou depois', async () => {
    const { client, store, onSessionExpired } = setup((url, init) => {
      if (url === '/v1/auth/refresh') return json(200, pair(1))
      if ((init.headers as Record<string, string>).Authorization === 'Bearer acc1') {
        store.current = { accessToken: 'accNovo', refreshToken: 'refNovo' } // login de outro usuário enquanto a resposta vinha
      }
      return json(401, {})
    })
    await expect(client.get('/x')).rejects.toMatchObject({ code: 'SESSION_CHANGED' })
    expect(store.current).toEqual({ accessToken: 'accNovo', refreshToken: 'refNovo' })
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  it('espera pela vez de renovar com limite; estourou, fica como indisponível sem apagar a sessão', async () => {
    const request = vi.fn((...args: unknown[]) => (args.length ? Promise.reject(new DOMException('timeout', 'AbortError')) : undefined))
    vi.stubGlobal('navigator', { locks: { request } })
    try {
      const { client, store } = setup(() => json(401, {}))
      await expect(client.get('/x')).rejects.toMatchObject({ status: 503 })
      expect(store.current).not.toBeNull()
      expect(request.mock.calls[0][1]).toHaveProperty('signal')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('uma recusa do refresh que chega depois de trocar de sessão não apaga a sessão nova', async () => {
    const { client, store, onSessionExpired } = setup((url) => {
      if (url === '/v1/auth/refresh') {
        store.current = { accessToken: 'accNovo', refreshToken: 'refNovo' } // saiu e entrou de novo enquanto a API respondia
        return json(401, {})
      }
      return json(401, {})
    })
    await expect(client.get('/x')).rejects.toMatchObject({ code: 'SESSION_CHANGED' })
    expect(store.current).toEqual({ accessToken: 'accNovo', refreshToken: 'refNovo' })
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  describe('logout', () => {
    const t = { accessToken: 'A1', refreshToken: 'R1' }
    it('revoga com os tokens recebidos, sem ler nem gravar o armazenamento', async () => {
      const { client, fetchImpl, store } = setup(() => new Response(null, { status: 204 }), { accessToken: 'outro', refreshToken: 'outro' })
      await client.logout(t)
      const call = fetchImpl.mock.calls[0]
      expect(call[0]).toBe('/v1/auth/logout')
      expect(headers(call).Authorization).toBe('Bearer A1')
      expect((call[1] as RequestInit).body).toBe('{"refreshToken":"R1"}')
      expect(store.current).toEqual({ accessToken: 'outro', refreshToken: 'outro' })
    })

    it('com access token vencido troca o par uma vez e revoga com o refresh novo', async () => {
      const { client, fetchImpl, store, onSessionExpired } = setup((url, init) => {
        if (url === '/v1/auth/refresh') return json(200, pair(2))
        return (init.headers as Record<string, string>).Authorization === 'Bearer acc2' ? new Response(null, { status: 204 }) : json(401, {})
      })
      await client.logout(t)
      const logouts = fetchImpl.mock.calls.filter((c) => c[0] === '/v1/auth/logout')
      expect(logouts.map((c) => (c[1] as RequestInit).body)).toEqual(['{"refreshToken":"R1"}', '{"refreshToken":"ref2"}'])
      expect(fetchImpl.mock.calls.filter((c) => c[0] === '/v1/auth/refresh')).toHaveLength(1)
      expect(store.current).toEqual({ accessToken: 'acc0', refreshToken: 'ref0' }) // o par novo não vai para o armazenamento
      expect(onSessionExpired).not.toHaveBeenCalled()
    })

    it('se a troca do par falha, desiste em silêncio e não encerra a sessão local', async () => {
      const { client, onSessionExpired } = setup(() => json(401, {}))
      await expect(client.logout(t)).resolves.toBeUndefined()
      expect(onSessionExpired).not.toHaveBeenCalled()
    })

    it('erro que não é de autenticação sobe para quem chamou', async () => {
      const { client } = setup(() => json(500, { detail: 'caiu' }))
      await expect(client.logout(t)).rejects.toMatchObject({ status: 500 })
    })
  })
})
