/**
 * API falsa no nível do `fetch` para os testes de integração do painel. O painel roda de verdade (telas, consultas,
 * serviços HTTP, cliente com renovação de token, sessão); só a rede é simulada.
 */
import type { ApiAlert, ApiRescue, ApiShelter, ApiUser } from '@/services/http/dto'

export interface Recorded {
  method: string
  path: string
  query: Record<string, string>
  headers: Record<string, string>
  body: unknown
}

type Result = { status: number; body?: unknown }

export interface FakeApi {
  requests: Recorded[]
  /** false derruba a rede */
  online: boolean
  /** tokens de acesso que a API aceita; um token fora daqui recebe 401 */
  validAccess: Set<string>
  /** refresh tokens aceitos; cada troca invalida o anterior (rotativo) */
  validRefresh: Set<string>
  /** de quem é cada refresh token: a renovação devolve o mesmo usuário */
  refreshOwner: Map<string, ApiUser>
  /** a próxima chamada a este método e caminho falha com este status (uma vez só) */
  failNext: { method: string; path: string; status: number; detail: string; code?: string }[]
  users: Record<string, { password: string; user: ApiUser }>
  alerts: ApiAlert[]
  shelters: ApiShelter[]
  rescue: ApiRescue[]
  calls(method: string, path: string): Recorded[]
}

const page = <T>(data: T[]) => ({ data, pagination: { page: 1, limit: 100, total: data.length, pages: 1, hasNext: false } })
const problem = (status: number, detail: string, code = 'ERROR'): Result => ({ status, body: { status, title: detail, detail, code, traceId: 't' } })

export const baseUser = (over: Partial<ApiUser> = {}): ApiUser => ({
  id: 'u1',
  name: 'Renata Lopes',
  phone: '+5511990000001',
  role: 'AGENTE',
  createdAt: '2026-10-01T10:00:00.000Z',
  ...over,
})

export function installFakeApi(): FakeApi {
  let n = 0
  const api: FakeApi = {
    requests: [],
    online: true,
    validAccess: new Set(),
    validRefresh: new Set(),
    refreshOwner: new Map(),
    failNext: [],
    users: {},
    alerts: [],
    shelters: [],
    rescue: [],
    calls: (method, path) => api.requests.filter((r) => r.method === method && r.path === path),
  }

  const issue = (user: ApiUser) => {
    const accessToken = `acesso-${++n}`
    const refreshToken = `refresh-${n}`
    api.validAccess.add(accessToken)
    api.validRefresh.add(refreshToken)
    api.refreshOwner.set(refreshToken, user)
    return { accessToken, refreshToken, expiresIn: 900, user }
  }

  function route(req: Recorded): Result {
    const { method, path } = req
    const b = (req.body ?? {}) as Record<string, unknown>

    if (method === 'POST' && path === '/auth/login') {
      const found = Object.values(api.users).find((u) => u.user.phone === b.phone)
      if (!found || found.password !== b.password) return problem(401, 'Telefone ou senha incorretos', 'INVALID_CREDENTIALS')
      return { status: 200, body: issue(found.user) }
    }
    if (method === 'POST' && path === '/auth/refresh') {
      const token = String(b.refreshToken)
      if (!api.validRefresh.has(token)) return problem(401, 'Sessão expirada', 'SESSION_EXPIRED')
      api.validRefresh.delete(token)
      const owner = api.refreshOwner.get(token)
      if (!owner) return problem(401, 'Sessão expirada', 'SESSION_EXPIRED')
      return { status: 200, body: issue(owner) }
    }
    if (method === 'POST' && path === '/auth/logout') {
      // exige a sessão que está saindo e revoga o refresh token dela
      const auth = req.headers.authorization?.replace('Bearer ', '')
      if (!auth || !api.validAccess.has(auth)) return problem(401, 'Token inválido ou vencido', 'UNAUTHENTICATED')
      const token = String(b.refreshToken)
      api.validRefresh.delete(token)
      api.validAccess.delete(auth)
      return { status: 204 }
    }

    // daqui para baixo precisa de token válido
    const auth = req.headers.authorization?.replace('Bearer ', '')
    if (!auth || !api.validAccess.has(auth)) return problem(401, 'Token inválido ou vencido', 'UNAUTHENTICATED')

    if (method === 'GET' && path === '/alerts') return { status: 200, body: page(api.alerts) }
    if (method === 'POST' && path === '/alerts') {
      const niveis = ['OBSERVACAO', 'ATENCAO', 'ALERTA', 'ALERTA_MAXIMO']
      const erros: string[] = []
      if (typeof b.title !== 'string' || b.title.length < 5) erros.push('title: mínimo de 5 caracteres')
      if (typeof b.description !== 'string' || !b.description) erros.push('description: obrigatório')
      if (!niveis.includes(String(b.level))) erros.push('level: valor inválido')
      if (typeof b.latitude !== 'number' || Math.abs(b.latitude) > 90) erros.push('latitude: inválida')
      if (typeof b.longitude !== 'number' || Math.abs(b.longitude) > 180) erros.push('longitude: inválida')
      if (typeof b.radiusMeters !== 'number' || b.radiusMeters <= 0) erros.push('radiusMeters: deve ser positivo')
      if (typeof b.city !== 'string' || typeof b.state !== 'string') erros.push('city/state: obrigatórios')
      if (erros.length) return problem(422, 'Dados inválidos: ' + erros.join('; '), 'VALIDATION')
      const a: ApiAlert = {
        id: `alert-${++n}`,
        title: String(b.title),
        description: String(b.description),
        level: b.level as ApiAlert['level'],
        status: 'ACTIVE',
        latitude: Number(b.latitude),
        longitude: Number(b.longitude),
        radiusMeters: Number(b.radiusMeters),
        city: String(b.city),
        state: String(b.state),
        source: 'MANUAL',
        polygon: null,
        expiresAt: String(b.expiresAt),
        createdAt: new Date().toISOString(),
      }
      api.alerts.unshift(a)
      return { status: 201, body: a }
    }
    const closeAlert = /^\/alerts\/([^/]+)\/status$/.exec(path)
    if (method === 'PATCH' && closeAlert) {
      const a = api.alerts.find((x) => x.id === closeAlert[1])
      if (!a) return problem(404, 'Alerta não encontrado', 'NOT_FOUND')
      a.status = 'RESOLVED'
      return { status: 200, body: a }
    }
    if (method === 'GET' && path === '/shelters') return { status: 200, body: { data: api.shelters } }
    const patchShelter = /^\/shelters\/([^/]+)$/.exec(path)
    if (method === 'PATCH' && patchShelter) {
      const s = api.shelters.find((x) => x.id === patchShelter[1])
      if (!s) return problem(404, 'Abrigo não encontrado', 'NOT_FOUND')
      if (typeof b.capacity === 'number' && b.capacity < s.currentOccupancy)
        return problem(409, 'A capacidade não pode ficar abaixo da ocupação atual', 'CONFLICT')
      Object.assign(s, b)
      return { status: 200, body: s }
    }
    if (method === 'GET' && path === '/rescue') return { status: 200, body: page(api.rescue) }
    const patchRescue = /^\/rescue\/([^/]+)\/status$/.exec(path)
    if (method === 'PATCH' && patchRescue) {
      const r = api.rescue.find((x) => x.id === patchRescue[1])
      if (!r) return problem(404, 'Solicitação não encontrada', 'NOT_FOUND')
      r.status = b.status as ApiRescue['status']
      r.outcomeNote = (b.outcomeNote as string | undefined) ?? r.outcomeNote
      return { status: 200, body: r }
    }
    return problem(404, `Rota desconhecida: ${method} ${path}`, 'NOT_FOUND')
  }

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!api.online) throw new TypeError('Failed to fetch')
    const url = new URL(String(input), 'http://localhost')
    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries((init?.headers ?? {}) as Record<string, string>)) headers[k.toLowerCase()] = v
    const req: Recorded = {
      method: init?.method ?? 'GET',
      path: url.pathname.replace(/^\/v1/, ''),
      query: Object.fromEntries(url.searchParams),
      headers,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    }
    api.requests.push(req)
    const forced = api.failNext.findIndex((x) => x.method === req.method && x.path === req.path)
    let result: Result
    if (forced >= 0) {
      const [f] = api.failNext.splice(forced, 1)
      result = problem(f!.status, f!.detail, f!.code)
    } else {
      result = route(req)
    }
    // a resposta é serializada, como numa rede de verdade: quem recebe nunca divide referências com o servidor
    const serialized = result.body === undefined ? undefined : JSON.parse(JSON.stringify(result.body))
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      statusText: '',
      headers: new Headers(),
      json: async () => {
        if (serialized === undefined) throw new SyntaxError('sem corpo')
        return serialized
      },
    } as Response
  }) as typeof fetch

  return api
}

export function alert(over: Partial<ApiAlert> = {}): ApiAlert {
  return {
    id: 'a1',
    title: 'Chuva intensa no centro',
    description: 'Chuva intensa no centro. Bairro: Centro.',
    level: 'ALERTA',
    status: 'ACTIVE',
    latitude: -23.4,
    longitude: -46.9,
    radiusMeters: 1000,
    city: 'Santana de Parnaíba',
    state: 'SP',
    source: 'MANUAL',
    polygon: null,
    expiresAt: null,
    createdAt: '2026-10-08T10:00:00.000Z',
    ...over,
  }
}

export function rescueRow(over: Partial<ApiRescue> = {}): ApiRescue {
  return {
    id: 'r1',
    type: 'FERIDO',
    status: 'PENDING',
    riskLevel: 'ALTO',
    nrScore: 70,
    isSos: false,
    description: 'Pessoa ferida',
    latitude: -23.4,
    longitude: -46.9,
    victimCount: 1,
    outcomeNote: null,
    alertId: null,
    assignedAgentId: null,
    createdAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    ...over,
  }
}

export function shelterRow(over: Partial<ApiShelter> = {}): ApiShelter {
  return {
    id: 's1',
    name: 'Ginásio Municipal',
    address: 'Rua A, 10',
    latitude: -23.4,
    longitude: -46.9,
    capacity: 100,
    currentOccupancy: 30,
    isActive: true,
    isAccessible: true,
    isPetFriendly: false,
    hasWater: true,
    hasFood: false,
    hasMedical: false,
    hasPowerBackup: false,
    contactPhone: null,
    ...over,
  }
}
