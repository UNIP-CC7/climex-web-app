import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HttpClient } from './client'
import { createHttpServices } from './index'
import type { TokenStore, Tokens } from './session'

const user = (role: string) => ({ id: 'u1', name: 'Carla', phone: '+5511990000003', role, createdAt: '2026-01-01T00:00:00Z' })
const login = (role: string) => ({ accessToken: 'acc', refreshToken: 'ref', expiresIn: 900, user: user(role) })

let tokens: Tokens | null
const store: TokenStore = {
  read: () => tokens,
  save: (t) => {
    tokens = t
  },
  clear: () => {
    tokens = null
  },
}
const client = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), all: vi.fn(), logout: vi.fn() } satisfies Record<
  keyof HttpClient,
  ReturnType<typeof vi.fn>
>
const services = createHttpServices(client as unknown as HttpClient, store)

beforeEach(() => {
  tokens = null
  Object.values(client).forEach((f) => f.mockReset())
})

describe('serviços HTTP: autenticação', () => {
  it('entra com o telefone em E.164, guarda os tokens e devolve o perfil do painel', async () => {
    client.post.mockResolvedValue(login('ADMINISTRADOR'))
    await expect(services.auth.loginWithPassword('(11) 99000-0003', 'segredo')).resolves.toEqual({ id: 'u1', name: 'Carla', role: 'ADMIN' })
    expect(client.post).toHaveBeenCalledWith('/auth/login', { phone: '+5511990000003', password: 'segredo' }, { auth: false })
    expect(tokens).toEqual({ accessToken: 'acc', refreshToken: 'ref' })
  })

  it('recusa o cidadão, encerra a sessão que abriu e nunca guarda os tokens dele', async () => {
    client.post.mockResolvedValue(login('CIDADAO'))
    client.logout.mockResolvedValue(undefined)
    await expect(services.auth.loginWithPassword('11990000001', 'x')).rejects.toThrow(/agentes, gestores e administradores/)
    expect(client.logout).toHaveBeenCalledWith({ accessToken: 'acc', refreshToken: 'ref' })
    expect(tokens).toBeNull()
  })

  it('o cidadão é recusado mesmo se a revogação falhar', async () => {
    client.post.mockResolvedValue(login('CIDADAO'))
    client.logout.mockRejectedValue(new Error('fora do ar'))
    await expect(services.auth.loginWithPassword('11990000001', 'x')).rejects.toThrow(/agentes/)
    expect(tokens).toBeNull()
  })

  it('erro de login (senha errada) não guarda nada', async () => {
    client.post.mockRejectedValue(new Error('Credenciais inválidas'))
    await expect(services.auth.loginWithPassword('11990000003', 'errada')).rejects.toThrow('Credenciais inválidas')
    expect(tokens).toBeNull()
  })

  it('logout revoga com os tokens capturados e deixa o armazenamento para o signOut', async () => {
    tokens = { accessToken: 'a', refreshToken: 'r' }
    client.logout.mockRejectedValue(new Error('fora do ar'))
    await services.auth.logout()
    expect(client.logout).toHaveBeenCalledWith({ accessToken: 'a', refreshToken: 'r' })
    expect(tokens).toEqual({ accessToken: 'a', refreshToken: 'r' }) // um logout lento não apaga o login seguinte
    tokens = null
    client.logout.mockClear()
    await services.auth.logout() // sem sessão não chama a API
    expect(client.logout).not.toHaveBeenCalled()
  })

  it('o login por perfil do modo simulado não existe em modo HTTP', async () => {
    await expect(services.auth.login('GESTOR')).rejects.toThrow(/telefone e senha/)
  })
})

describe('serviços HTTP: alertas', () => {
  const apiAlert = {
    id: 'a1',
    title: 'Chuva',
    description: 'Chuva. Bairro afetado: Centro.',
    level: 'ALERTA',
    status: 'ACTIVE',
    latitude: -23.4,
    longitude: -46.9,
    radiusMeters: 1200,
    city: 'Santana de Parnaíba',
    state: 'SP',
    source: 'MANUAL',
    polygon: null,
    expiresAt: null,
    createdAt: '2026-10-07T10:00:00Z',
  }
  it('lista todas as páginas', async () => {
    client.all.mockResolvedValue([apiAlert])
    const list = await services.alerts.list()
    expect(client.all).toHaveBeenCalledWith('/alerts')
    expect(list[0]).toMatchObject({ id: 'a1', neighborhood: 'Centro', active: true })
  })
  it('cria com descrição, raio em metros, cidade, UF e validade', async () => {
    client.post.mockResolvedValue(apiAlert)
    await services.alerts.create({ title: 'Chuva', severity: 'ALERTA', neighborhood: 'Centro', center: [-23.4, -46.9], radiusKm: 1.2, hours: 6 })
    const [path, body] = client.post.mock.calls[0]
    expect(path).toBe('/alerts')
    expect(body).toMatchObject({
      title: 'Chuva',
      description: 'Chuva. Bairro afetado: Centro.',
      level: 'ALERTA',
      latitude: -23.4,
      longitude: -46.9,
      radiusMeters: 1200,
      city: 'Santana de Parnaíba',
      state: 'SP',
    })
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now() + 5 * 3_600_000)
  })
  it('ids com caracteres de caminho são codificados', async () => {
    client.patch.mockResolvedValue({})
    await services.alerts.close('a/../b?x=1')
    expect(client.patch).toHaveBeenCalledWith('/alerts/a%2F..%2Fb%3Fx%3D1/status', { status: 'RESOLVED' })
  })
  it('encerrar é mudar o status para RESOLVED', async () => {
    client.patch.mockResolvedValue({})
    await services.alerts.close('a1')
    expect(client.patch).toHaveBeenCalledWith('/alerts/a1/status', { status: 'RESOLVED' })
  })
})

describe('serviços HTTP: abrigos', () => {
  const apiShelter = {
    id: 's1',
    name: 'Ginásio X',
    address: 'Rua 1',
    latitude: 0,
    longitude: 0,
    capacity: 50,
    currentOccupancy: 10,
    isActive: true,
    isAccessible: false,
    isPetFriendly: false,
    hasWater: false,
    hasFood: false,
    hasMedical: false,
    hasPowerBackup: false,
    contactPhone: null,
  }
  it('lista pelo envelope {data}', async () => {
    client.get.mockResolvedValue({ data: [apiShelter], total: 1 })
    expect((await services.shelters.list())[0]).toMatchObject({ id: 's1', kind: 'ginasio_esportivo', occupancy: 10 })
  })
  it('edita com PATCH', async () => {
    client.patch.mockResolvedValue({ ...apiShelter, capacity: 80 })
    expect((await services.shelters.update('s1', { capacity: 80 })).capacity).toBe(80)
    expect(client.patch).toHaveBeenCalledWith('/shelters/s1', { capacity: 80 })
  })
  it('registra entrada e explica que a saída não existe na API', async () => {
    client.post.mockResolvedValue({ shelter: { ...apiShelter, currentOccupancy: 11 } })
    expect((await services.shelters.checkIn('s1', 1)).occupancy).toBe(11)
    expect(client.post).toHaveBeenCalledWith('/shelters/s1/check-in', { guestCount: 1 })
    await expect(services.shelters.checkIn('s1', -1)).rejects.toThrow(/saída/)
    await expect(services.shelters.checkIn('s1', 0)).rejects.toThrow(/quantas pessoas/)
    expect(client.post).toHaveBeenCalledTimes(1)
  })
})

describe('serviços HTTP: socorro, resumo, usuários e auditoria', () => {
  const apiRescue = {
    id: 'r1',
    type: 'FERIDO',
    status: 'PENDING',
    riskLevel: 'CRITICO',
    nrScore: 91,
    isSos: true,
    description: 'Ferido',
    latitude: 0,
    longitude: 0,
    victimCount: 1,
    outcomeNote: null,
    alertId: null,
    assignedAgentId: null,
    createdAt: '2026-10-07T10:00:00Z',
  }
  it('aceitar vira ASSIGNED e concluir manda o desfecho', async () => {
    client.patch.mockResolvedValue({ ...apiRescue, status: 'ASSIGNED' })
    expect((await services.rescue.setStatus('r1', 'EM_ATENDIMENTO', 'Renata')).status).toBe('EM_ATENDIMENTO')
    expect(client.patch).toHaveBeenLastCalledWith('/rescue/r1/status', { status: 'ASSIGNED' })
    client.patch.mockResolvedValue({ ...apiRescue, status: 'RESOLVED' })
    await services.rescue.setStatus('r1', 'CONCLUIDA', 'Renata', 'Atendida em campo')
    expect(client.patch).toHaveBeenLastCalledWith('/rescue/r1/status', { status: 'RESOLVED', outcomeNote: 'Atendida em campo' })
  })
  it('concluir sem desfecho é barrado antes de chamar a API', async () => {
    await expect(services.rescue.setStatus('r1', 'CONCLUIDA', 'Renata')).rejects.toThrow(/desfecho/)
    await expect(services.rescue.setStatus('r1', 'CONCLUIDA', 'Renata', '   ')).rejects.toThrow(/desfecho/)
    expect(client.patch).not.toHaveBeenCalled()
  })
  it('lista socorro pela rota paginada', async () => {
    client.all.mockResolvedValue([apiRescue])
    expect((await services.rescue.list())[0].risk).toEqual({ score: 91, band: 'CRITICO' })
    expect(client.all).toHaveBeenCalledWith('/rescue')
  })
  it('o resumo é calculado das três listas', async () => {
    client.all.mockImplementation((path: string) => Promise.resolve(path === '/rescue' ? [apiRescue] : []))
    client.get.mockResolvedValue({ data: [], total: 0 })
    const s = await services.dashboard.summary()
    expect(s).toMatchObject({ openRescue: 1, activeAlerts: 0, shelterTotal: 0, simulated: false, agentsInField: null })
    expect(s.openByRisk.CRITICO).toBe(1)
  })
  it('usuários: lista vazia, troca de perfil enviada e ativar/desativar indisponível', async () => {
    await expect(services.users.list()).resolves.toEqual([])
    client.patch.mockResolvedValue({ user: user('GESTOR'), revokedSessions: 1 })
    const u = await services.users.setRole('u1', 'GESTOR')
    expect(client.patch).toHaveBeenCalledWith('/admin/users/u1/role', { role: 'GESTOR', reason: expect.stringMatching(/.{5,}/) })
    expect(u).toMatchObject({ id: 'u1', role: 'GESTOR' })
    await services.users.setRole('u1', 'ADMIN')
    expect(client.patch).toHaveBeenLastCalledWith('/admin/users/u1/role', expect.objectContaining({ role: 'ADMINISTRADOR' }))
    await expect(services.users.setActive('u1', false)).rejects.toThrow(/ainda não permite/)
  })
  it('auditoria vem da mais nova para a mais antiga', async () => {
    const row = (sequence: number) => ({
      id: `e${sequence}`,
      sequence,
      userId: null,
      userRole: null,
      action: 'x',
      entityType: 'T',
      entityId: null,
      statusCode: 200,
      ipAddress: null,
      hash: 'h',
      previousHash: null,
      createdAt: '2026-10-07T10:00:00Z',
    })
    client.get.mockResolvedValue({ data: [row(1), row(3), row(2)] })
    expect((await services.audit.list()).map((e) => e.seq)).toEqual([3, 2, 1])
    expect(client.get).toHaveBeenCalledWith('/audit', { limit: 100 })
  })
})
