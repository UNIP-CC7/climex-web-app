import type { ApiPage, ApiProblem, ApiTokenPair } from './dto'
import { browserTokens, notifySessionExpired, type TokenStore, type Tokens } from './session'

/** Erro devolvido pela API (problem+json), ou `status` 0 quando nem chegou resposta. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string | null
  readonly traceId: string | null
  readonly fields: { field: string; message: string }[]

  constructor(status: number, message: string, extra: { code?: string | null; traceId?: string | null; fields?: ApiError['fields'] } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = extra.code ?? null
    this.traceId = extra.traceId ?? null
    this.fields = extra.fields ?? []
  }
}

type Query = Record<string, string | number | boolean | undefined>
interface RequestOptions {
  query?: Query
  body?: unknown
  /** false nas rotas públicas de autenticação (login e renovação) */
  auth?: boolean
  /** Token explícito, sem passar pelo armazenamento nem pela renovação automática. Usado só no logout. */
  token?: string
  /** Devolve o corpo como texto, não como JSON (o CSV do relatório). */
  text?: boolean
}

export interface HttpClient {
  get<T>(path: string, query?: Query): Promise<T>
  /** GET que devolve o corpo como texto, com a mesma sessão e renovação (o CSV do relatório). */
  text(path: string, query?: Query): Promise<string>
  post<T>(path: string, body?: unknown, opts?: Pick<RequestOptions, 'auth'>): Promise<T>
  patch<T>(path: string, body?: unknown): Promise<T>
  /** Percorre as páginas de uma listagem paginada (limit 100) e junta tudo. */
  all<T>(path: string, query?: Query, maxPages?: number): Promise<T[]>
  /**
   * Revoga a sessão no servidor com os tokens que o chamador capturou ao clicar em sair. Nunca lê nem grava o armazenamento,
   * então um logout lento não alcança o login que veio depois. Com o access token vencido, troca o par uma vez e tenta de novo.
   * Se isso cruzar com uma renovação de outra aba, a API pode derrubar as sessões da conta, o que é aceitável para quem está saindo.
   */
  logout(t: Tokens): Promise<void>
}

export interface ClientOptions {
  /** Origem da API. Vazio usa o mesmo endereço do painel (o proxy do Vite leva /v1 até a API); sem informar, vale VITE_API_BASE_URL. */
  baseUrl?: string
  fetchImpl?: typeof fetch
  tokens?: TokenStore
  onSessionExpired?: () => void
  requestId?: () => string
  timeoutMs?: number
  /** Quanto esperar a vez de renovar quando outra aba está renovando. */
  lockWaitMs?: number
}

const PREFIX = '/v1'
const DENIED = new Set([400, 401, 403, 422])

async function readProblem(res: Response): Promise<ApiError> {
  let p: ApiProblem | null = null
  try {
    p = (await res.json()) as ApiProblem
  } catch {
    /* corpo vazio ou que não é JSON */
  }
  const fields = p?.errors ?? []
  const base = p?.detail || p?.title || (res.status >= 500 ? 'A API teve um problema. Tente de novo em instantes.' : `Erro ${res.status}`)
  // 422: junta o que cada campo reclamou, para a mensagem dizer o que corrigir
  const detail = fields.length ? `${base} ${fields.map((f) => `${f.field}: ${f.message}`).join('; ')}` : base
  return new ApiError(res.status, detail, { code: p?.code, traceId: p?.traceId, fields })
}

async function readJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T
  } catch {
    throw new ApiError(res.status, 'A API devolveu uma resposta que o painel não entendeu.')
  }
}

/** Só uma aba por vez renova o token (o refresh é rotativo). Sem Web Locks, vale só a coordenação dentro da aba. */
function withLock<T>(fn: () => Promise<T>, waitMs: number): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
  if (!locks) return fn()
  // sem limite, uma aba suspensa segurando o lock deixaria as outras presas para sempre
  const signal = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(waitMs) : undefined
  return locks.request('climex-refresh-token', signal ? { signal } : {}, fn)
}

type RenewResult =
  | 'ok' // há um par novo no armazenamento, vale repetir a chamada
  | 'none' // não há sessão guardada
  | 'denied' // a API recusou o refresh token: a sessão acabou
  | 'unavailable' // rede, timeout ou erro 5xx: não dá para saber, a sessão fica como está
  | 'stale' // o usuário saiu ou entrou de novo enquanto a renovação corria

/**
 * Origem da API. Vazio significa o mesmo endereço do painel. Com valor, tem que ser uma origem http(s) pura
 * (a barra final e o /v1 são aceitos e saem, porque o cliente já acrescenta o prefixo). Como os tokens da sessão
 * seguem para esse endereço, um valor torto falha alto no lugar de mandar credenciais para onde não deveria.
 */
export function normalizeBaseUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim()
  if (!value) return ''
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`Endereço da API inválido: "${value}". Use algo como https://api.exemplo.com.br`)
  }
  const path = url.pathname.replace(/\/+$/, '')
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || (path !== '' && path !== '/v1')) {
    throw new Error(`Endereço da API inválido: "${value}". Informe só a origem, como https://api.exemplo.com.br`)
  }
  return url.origin
}

export function createHttpClient(opts: ClientOptions = {}): HttpClient {
  const baseUrl = normalizeBaseUrl(opts.baseUrl ?? import.meta.env.VITE_API_BASE_URL)
  const doFetch = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
  const tokens = opts.tokens ?? browserTokens
  const expired = opts.onSessionExpired ?? notifySessionExpired
  const newId = opts.requestId ?? (() => crypto.randomUUID())
  const timeoutMs = opts.timeoutMs ?? 20_000
  const lockWaitMs = opts.lockWaitMs ?? 30_000

  async function send(method: string, path: string, o: RequestOptions): Promise<Response> {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(o.query ?? {})) if (v !== undefined) qs.set(k, String(v))
    const url = `${baseUrl}${PREFIX}${path}${qs.size ? `?${qs}` : ''}`
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Request-Id': newId() }
    if (o.body !== undefined) headers['Content-Type'] = 'application/json'
    const access = o.token ?? (o.auth === false ? null : tokens.read()?.accessToken)
    if (access) headers.Authorization = `Bearer ${access}`
    try {
      return await doFetch(url, {
        method,
        headers,
        body: o.body === undefined ? undefined : JSON.stringify(o.body),
        signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(timeoutMs) : undefined,
      })
    } catch {
      throw new ApiError(0, 'Sem conexão com a API. Confira a rede e tente de novo.')
    }
  }

  async function renew(used: string | null): Promise<RenewResult> {
    const current = tokens.read()
    if (!current?.refreshToken) return 'none'
    // outra chamada ou outra aba já trocou o par depois do 401: basta repetir com o token atual
    if (used && current.accessToken !== used) return 'ok'
    let res: Response
    try {
      res = await send('POST', '/auth/refresh', { auth: false, body: { refreshToken: current.refreshToken } })
    } catch {
      return 'unavailable'
    }
    // só estes códigos dizem que o refresh token não vale mais; 429, 408 e semelhantes são passageiros
    // se a sessão mudou enquanto a API respondia, a recusa é do token antigo e não pode apagar a sessão nova
    if (DENIED.has(res.status)) return tokens.read()?.refreshToken === current.refreshToken ? 'denied' : 'stale'
    if (!res.ok) return 'unavailable'
    let pair: ApiTokenPair
    try {
      pair = (await res.json()) as ApiTokenPair
    } catch {
      return 'unavailable'
    }
    if (!pair?.accessToken || !pair?.refreshToken) return 'unavailable'
    // se o usuário saiu (ou entrou de novo) enquanto a API respondia, não grava o par por cima
    if (tokens.read()?.refreshToken !== current.refreshToken) return 'stale'
    tokens.save({ accessToken: pair.accessToken, refreshToken: pair.refreshToken })
    return 'ok'
  }

  // várias chamadas que recebem 401 ao mesmo tempo compartilham uma só renovação
  // (a API derruba todas as sessões se o mesmo refresh token for usado duas vezes)
  let refreshing: Promise<RenewResult> | null = null
  function refresh(used: string | null): Promise<RenewResult> {
    refreshing ??= withLock(() => renew(used), lockWaitMs)
      .catch((): RenewResult => 'unavailable') // esperou demais pelo lock de outra aba
      .finally(() => {
        refreshing = null
      })
    return refreshing
  }

  function endSession(): never {
    tokens.clear()
    expired()
    throw new ApiError(401, 'Sua sessão expirou. Entre de novo.', { code: 'SESSION_EXPIRED' })
  }

  async function request<T>(method: string, path: string, o: RequestOptions = {}): Promise<T> {
    const used = o.auth === false || o.token ? null : (tokens.read()?.accessToken ?? null)
    let res = await send(method, path, o)
    if (res.status === 401 && o.auth !== false && !o.token) {
      const outcome = await refresh(used)
      if (outcome === 'none' || outcome === 'denied') endSession()
      if (outcome === 'stale') throw new ApiError(401, 'A sessão mudou durante a chamada. Tente de novo.', { code: 'SESSION_CHANGED' })
      if (outcome === 'unavailable') throw new ApiError(503, 'Não foi possível renovar a sessão agora. Tente de novo em instantes.')
      const sentWith = tokens.read()?.accessToken
      res = await send(method, path, o)
      if (res.status === 401) {
        // o par novo também foi recusado: não há o que tentar de novo. Mas se o usuário saiu ou entrou de novo
        // enquanto a resposta vinha, esse 401 é da sessão antiga e não pode apagar a nova.
        if (tokens.read()?.accessToken !== sentWith)
          throw new ApiError(401, 'A sessão mudou durante a chamada. Tente de novo.', { code: 'SESSION_CHANGED' })
        endSession()
      }
    }
    if (!res.ok) throw await readProblem(res)
    if (res.status === 204) return undefined as T
    if (o.text) return (await res.text()) as T
    return readJson<T>(res)
  }

  return {
    get: (path, query) => request('GET', path, { query }),
    text: (path, query) => request('GET', path, { query, text: true }),
    post: (path, body, o) => request('POST', path, { body, auth: o?.auth }),
    patch: (path, body) => request('PATCH', path, { body }),
    async all<T>(path: string, query: Query = {}, maxPages = 10) {
      const out: T[] = []
      for (let page = 1; page <= maxPages; page++) {
        const r = await request<ApiPage<T>>('GET', path, { query: { ...query, page, limit: 100 } })
        out.push(...r.data)
        if (!r.pagination.hasNext) break
      }
      return out
    },
    async logout(t) {
      const call = (access: string, refreshToken: string) => send('POST', '/auth/logout', { body: { refreshToken }, token: access })
      let res = await call(t.accessToken, t.refreshToken)
      if (res.status === 401) {
        const r = await send('POST', '/auth/refresh', { auth: false, body: { refreshToken: t.refreshToken } })
        if (!r.ok) return
        const pair = await readJson<ApiTokenPair>(r)
        res = await call(pair.accessToken, pair.refreshToken)
      }
      if (!res.ok && res.status !== 401) throw await readProblem(res)
    },
  }
}
