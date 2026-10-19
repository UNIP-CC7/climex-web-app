import type {
  Alert,
  AppUser,
  DashboardSummary,
  Occupant,
  Report,
  RescueRequest,
  RescueStatus,
  RiskBand,
  RiskConfigVersion,
  Role,
  Shelter,
  ShelterKind,
} from '@/domain/types'
import { DEFAULT_RISK_CONFIG } from '@/lib/riskConfig'
import { heatCells, type HeatCell } from '@/lib/heat'
import { reportToCsv } from '@/lib/reportCsv'
import { ALERTS, AUDIT, CENTER, RESCUE, USERS, area, fakeHash } from '@/mocks/seed'
import { PUBLIC, distanceKm, loadOsmCandidates } from '../osm'
import type { ShelterCandidate } from '@/domain/types'
import type { Services } from '../types'

const delay = <T>(v: T, ms = 120) => new Promise<T>((r) => setTimeout(() => r(v), ms))

/* ---------- estado em memória (some ao recarregar) ---------- */
let alerts: Alert[] = structuredClone(ALERTS)
let rescue: RescueRequest[] = structuredClone(RESCUE)
let users: AppUser[] = structuredClone(USERS)
const occupantsByShelter = new Map<string, Occupant[]>()
let occupantSeq = 0
const audit = structuredClone(AUDIT)
let riskVersions: RiskConfigVersion[] = [
  {
    version: 1,
    config: structuredClone(DEFAULT_RISK_CONFIG),
    isActive: true,
    reason: 'Pesos iniciais (padrão do sistema)',
    createdAt: '2026-10-10T12:00:00.000Z',
  },
]

function staffRole(name: string): Role {
  const role = users.find((u) => u.name === name)?.role
  return role && role !== 'CIDADAO' ? role : 'GESTOR'
}

function occupantsOf(shelter: Shelter): Occupant[] {
  let list = occupantsByShelter.get(shelter.id)
  if (!list) {
    list =
      shelter.occupancy > 0
        ? [{ id: `oc-${shelter.id}-0`, name: 'Ocupação inicial', people: shelter.occupancy, since: new Date().toISOString(), registered: false }]
        : []
    occupantsByShelter.set(shelter.id, list)
  }
  return list
}

function log(author: string, role: Role, action: string, entity: string, status = 200) {
  const prev = audit[audit.length - 1]?.hash ?? '0'.repeat(16)
  const at = new Date().toISOString()
  audit.push({
    seq: audit.length + 1,
    at,
    author,
    role,
    action,
    entity,
    status,
    ip: '10.20.0.15',
    hash: fakeHash(prev + author + action + entity + at),
    prevHash: prev,
  })
}

/* ---------- abrigos: locais reais do OpenStreetMap, capacidade simulada ---------- */
function hash(s: string) {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

let sheltersCache: Promise<Shelter[]> | null = null
function loadShelters(): Promise<Shelter[]> {
  sheltersCache ??= loadOsmCandidates()
    .then((list) => {
      const nearest = new Set(
        list
          .filter((o) => (o.tipo === 'escola' || o.tipo === 'ginasio_esportivo') && PUBLIC.test(o.nome))
          .map((o) => ({ id: o.osmId, d: distanceKm(CENTER[0], CENTER[1], o.lat, o.lng) }))
          .sort((a, b) => a.d - b.d)
          .slice(0, 7)
          .map((x) => x.id),
      )
      return list.map<Shelter>((o) => {
        const h = hash(o.osmId)
        const capacity = 60 + (h % 25) * 10
        const ativo = nearest.has(o.osmId)
        return {
          id: o.osmId,
          name: o.nome,
          kind: o.tipo as ShelterKind,
          lat: o.lat,
          lng: o.lng,
          street: o.rua,
          neighborhood: o.bairro,
          city: o.cidade,
          phone: o.telefone,
          capacity,
          occupancy: ativo ? Math.round(capacity * (0.25 + ((h >>> 5) % 70) / 100)) : 0,
          status: ativo ? 'ATIVO' : 'CANDIDATO',
          simulated: true,
          resources: { water: h % 3 !== 0, food: h % 2 === 0, medical: h % 5 === 0, accessible: h % 4 !== 0, pets: h % 6 === 0 },
        }
      })
    })
    .catch((e: unknown) => {
      sheltersCache = null // uma falha não pode ficar guardada para sempre
      throw e
    })
  return sheltersCache
}

const EMPTY_RISK: Record<RiskBand, number> = { CRITICO: 0, ALTO: 0, MEDIO: 0, BAIXO: 0 }

function topAlert(list: Alert[]): DashboardSummary['maxAlert'] {
  const a = [...list].sort((x, y) => SEV_ORDER[y.severity] - SEV_ORDER[x.severity])[0]
  return a ? { id: a.id, title: a.title, severity: a.severity, place: a.neighborhood } : null
}

const STATUS_API: Record<RescueStatus, string> = { ABERTA: 'PENDING', EM_ATENDIMENTO: 'ASSIGNED', CONCLUIDA: 'RESOLVED', CANCELADA: 'CANCELLED' }
const count = <T>(items: T[], key: (i: T) => string) => items.reduce<Record<string, number>>((m, i) => ({ ...m, [key(i)]: (m[key(i)] ?? 0) + 1 }), {})

/** Relatório do modo simulado: os mesmos números que a API devolve, calculados sobre o estado em memória. */
function buildMockReport(hours: number, allShelters: Shelter[]): Report {
  const to = new Date()
  const from = new Date(to.getTime() - hours * 3_600_000)
  const inPeriod = rescue.filter((r) => new Date(r.openedAt) >= from)
  const closed = inPeriod.filter((r) => r.status === 'CONCLUIDA' && r.resolvedAt)
  const minutes = closed.map((r) => (new Date(r.resolvedAt as string).getTime() - new Date(r.openedAt).getTime()) / 60000)
  const byRisk = { ...EMPTY_RISK }
  inPeriod.forEach((r) => byRisk[r.risk.band]++)
  const created = alerts.filter((a) => new Date(a.issuedAt) >= from)
  return {
    periodHours: hours,
    from: from.toISOString(),
    to: to.toISOString(),
    rescue: {
      total: inPeriod.length,
      sos: inPeriod.filter((r) => r.sos).length,
      resolved: inPeriod.filter((r) => r.status === 'CONCLUIDA').length,
      cancelled: inPeriod.filter((r) => r.status === 'CANCELADA').length,
      avgResolutionMinutes: minutes.length ? Math.round((minutes.reduce((n, m) => n + m, 0) / minutes.length) * 10) / 10 : null,
      byStatus: count(inPeriod, (r) => STATUS_API[r.status]),
      byRisk,
      byType: count(inPeriod, (r) => r.type),
    },
    alerts: { total: created.length, byLevel: count(created, (a) => a.severity) },
    shelters: allShelters
      .filter((s) => s.status === 'ATIVO')
      .map((s) => ({
        id: s.id,
        name: s.name,
        capacity: s.capacity,
        occupancy: s.occupancy,
        available: Math.max(0, s.capacity - s.occupancy),
        rate: s.capacity > 0 ? Math.round((s.occupancy / s.capacity) * 1000) / 10 : 0,
      })),
  }
}
const SEV_ORDER = { OBSERVACAO: 0, ATENCAO: 1, ALERTA: 2, ALERTA_MAXIMO: 3 } as const

const NO_RESOURCES = { water: false, food: false, medical: false, accessible: false, pets: false }
const sampleCandidate = (
  id: string,
  name: string,
  address: string,
  category: string,
  status: ShelterCandidate['status'] = 'CANDIDATE',
): ShelterCandidate => ({
  id,
  name,
  address,
  lat: -23.4439,
  lng: -46.9178,
  category,
  source: 'OSM',
  removedFromSource: false,
  status,
  capacity: 0,
  occupancy: 0,
  phone: null,
  resources: { ...NO_RESOURCES },
  reviewedAt: null,
  reviewNote: null,
})
const reviewShelters: ShelterCandidate[] = [
  sampleCandidate('rv-1', 'Escola Municipal Exemplo A', 'Rua das Acácias, 100', 'amenity=school'),
  sampleCandidate('rv-2', 'Ginásio Poliesportivo Exemplo B', 'Av. Central, 2000', 'leisure=sports_centre'),
  sampleCandidate('rv-3', 'Centro Comunitário Exemplo C', 'Rua do Parque, 35', 'amenity=community_centre'),
  sampleCandidate('rv-4', 'Salão Paroquial Exemplo D', 'Praça da Matriz, 1', 'amenity=place_of_worship', 'REJECTED'),
]
const findReview = (id: string) => {
  const s = reviewShelters.find((x) => x.id === id)
  if (!s) throw new Error('Local não encontrado')
  return s
}

export const mockServices: Services = {
  shelterReview: {
    list: ({ status, search, limit, offset }) => {
      const q = search?.trim().toLowerCase()
      const rows = reviewShelters.filter((s) => s.status === status && (!q || `${s.name} ${s.address}`.toLowerCase().includes(q)))
      return delay({ items: rows.slice(offset, offset + limit).map((s) => ({ ...s })), total: rows.length })
    },
    confirm: (id, input) => {
      const s = findReview(id)
      if (input.capacity <= 0) throw new Error('Informe uma capacidade maior que zero.')
      Object.assign(s, {
        status: 'CONFIRMED',
        capacity: input.capacity,
        phone: input.phone?.trim() || null,
        resources: { ...input.resources },
        reviewedAt: new Date().toISOString(),
        reviewNote: input.note?.trim() || null,
      })
      return delay({ ...s })
    },
    reject: (id, note) => {
      const s = findReview(id)
      Object.assign(s, { status: 'REJECTED', reviewedAt: new Date().toISOString(), reviewNote: note.trim() })
      return delay({ ...s })
    },
    reopen: (id, note) => {
      const s = findReview(id)
      if (s.occupancy > 0) throw new Error('O abrigo tem pessoas. Zere a ocupação antes de devolvê-lo a candidato.')
      Object.assign(s, { status: 'CANDIDATE', reviewedAt: new Date().toISOString(), reviewNote: note?.trim() || null })
      return delay({ ...s })
    },
  },
  imports: {
    syncAlerts: () =>
      delay({ fetched: 6, invalid: 0, inScope: 2, created: 1, updated: 1, reactivated: 0, resolved: 0, expired: 0, notified: 0 }, 400),
    syncShelters: () => delay({ source: 'OSM', fetched: 120, skipped: 3, created: 4, updated: 0, unchanged: 116, removedFromSource: 0 }, 400),
  },
  auth: {
    login: (role) =>
      delay({ id: `sess-${role}`, role, name: { AGENTE: 'Renata Lopes', GESTOR: 'Marcos Cavalcante', ADMIN: 'Diego Arruda' }[role] }, 250),
    loginWithPassword: () => Promise.reject(new Error('O modo simulado não tem login por senha. Escolha um perfil.')),
    logout: () => Promise.resolve(),
  },
  alerts: {
    list: () => delay([...alerts].sort((a, b) => SEV_ORDER[b.severity] - SEV_ORDER[a.severity])),
    create: ({ title, severity, neighborhood, center, radiusKm, hours, polygon }) => {
      const a: Alert = {
        id: `al-${Date.now()}`,
        title,
        severity,
        neighborhood,
        city: 'Santana de Parnaíba',
        polygons: [polygon && polygon.length >= 3 ? polygon : area(center, radiusKm / 111)],
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + hours * 3600000).toISOString(),
        active: true,
        source: 'MANUAL',
      }
      alerts = [a, ...alerts]
      log('Marcos Cavalcante', 'GESTOR', 'Criou alerta', `Alert ${a.id}`, 201)
      return delay(a)
    },
    close: (id) => {
      alerts = alerts.map((a) => (a.id === id ? { ...a, active: false, expiresAt: new Date().toISOString() } : a))
      log('Marcos Cavalcante', 'GESTOR', 'Encerrou alerta', `Alert ${id}`)
      return delay(undefined)
    },
  },
  shelters: {
    list: loadShelters,
    update: async (id, patch) => {
      const all = await loadShelters()
      const s = all.find((x) => x.id === id)
      if (!s) throw new Error('Abrigo não encontrado')
      Object.assign(s, patch)
      if (s.status === 'ATIVO' && s.occupancy === 0) s.occupancy = Math.round(s.capacity * 0.1)
      log('Marcos Cavalcante', 'GESTOR', 'Atualizou abrigo', `Shelter ${id}`)
      return delay({ ...s })
    },
    checkIn: async (id, people) => {
      const all = await loadShelters()
      const s = all.find((x) => x.id === id)
      if (!s) throw new Error('Abrigo não encontrado')
      if (people < 1) throw new Error('Informe quantas pessoas entraram.')
      if (s.occupancy + people > s.capacity) throw new Error('Abrigo lotado')
      const list = occupantsOf(s)
      list.push({ id: `oc-${id}-${++occupantSeq}`, name: 'Entrada pelo painel', people, since: new Date().toISOString(), registered: false })
      s.occupancy += people
      return delay({ ...s }, 60)
    },
    occupants: async (id) => {
      const all = await loadShelters()
      const s = all.find((x) => x.id === id)
      if (!s) throw new Error('Abrigo não encontrado')
      return delay(
        occupantsOf(s).map((o) => ({ ...o })),
        60,
      )
    },
    checkOut: async (id, occupantId) => {
      const all = await loadShelters()
      const s = all.find((x) => x.id === id)
      if (!s) throw new Error('Abrigo não encontrado')
      const list = occupantsOf(s)
      const at = list.findIndex((o) => o.id === occupantId)
      if (at < 0) throw new Error('Registro de entrada não encontrado')
      s.occupancy = Math.max(0, s.occupancy - list[at]!.people)
      list.splice(at, 1)
      return delay({ ...s }, 60)
    },
  },
  rescue: {
    list: () => delay(rescue.map((r) => ({ ...r }))),
    setStatus: (id, status, agent, outcome) => {
      rescue = rescue.map((r) => (r.id === id ? { ...r, status, assignedTo: status === 'ABERTA' ? null : agent, outcome: outcome ?? r.outcome } : r))
      const r = rescue.find((x) => x.id === id)!
      log(agent, staffRole(agent), status === 'EM_ATENDIMENTO' ? 'Aceitou solicitação' : 'Registrou desfecho', `RescueRequest ${id}`)
      return delay({ ...r }, 80)
    },
  },
  dashboard: {
    summary: async (): Promise<DashboardSummary> => {
      const shelters = await loadShelters()
      const act = alerts.filter((a) => a.active)
      const open = rescue.filter((r) => r.status === 'ABERTA')
      const active = shelters.filter((s) => s.status === 'ATIVO')
      const byRisk = { ...EMPTY_RISK }
      open.forEach((r) => byRisk[r.risk.band]++)
      const attending = rescue.filter((r) => r.status === 'EM_ATENDIMENTO')
      return delay({
        activeAlerts: act.length,
        maxAlert: topAlert(act),
        openRescue: open.length,
        openByRisk: byRisk,
        sheltersWithSpots: active.filter((s) => s.capacity - s.occupancy > 20).length,
        shelterTotal: active.length,
        spotsFree: active.reduce((n, s) => n + s.capacity - s.occupancy, 0),
        spotsTotal: active.reduce((n, s) => n + s.capacity, 0),
        agentsInField: users.filter((u) => u.role === 'AGENTE' && u.active).length,
        agentsAttending: new Set(attending.map((r) => r.assignedTo)).size,
        simulated: true,
        updatedAt: new Date().toISOString(),
      })
    },
    heatmap: async (hours: number): Promise<HeatCell[]> => {
      const since = Date.now() - hours * 3_600_000
      return delay(heatCells(rescue.filter((r) => new Date(r.openedAt).getTime() >= since)))
    },
    report: async (hours: number): Promise<Report> => buildMockReport(hours, await loadShelters()),
    reportCsv: async (hours: number): Promise<string> => reportToCsv(await buildMockReport(hours, await loadShelters())),
  },
  users: {
    list: () => delay(users.map((u) => ({ ...u }))),
    setRole: (id, role) => {
      users = users.map((u) => (u.id === id ? { ...u, role } : u))
      log('Diego Arruda', 'ADMIN', 'Promoveu perfil de usuário', `User ${id}`)
      return delay({ ...users.find((u) => u.id === id)! })
    },
    setActive: (id, active) => {
      users = users.map((u) => (u.id === id ? { ...u, active } : u))
      log('Diego Arruda', 'ADMIN', active ? 'Reativou usuário' : 'Desativou usuário', `User ${id}`)
      return delay({ ...users.find((u) => u.id === id)! })
    },
  },
  audit: { list: () => delay([...audit].reverse()) },
  riskConfig: {
    active: () => delay(structuredClone(riskVersions.find((v) => v.isActive) ?? riskVersions[0]!)),
    history: () => delay(structuredClone([...riskVersions].reverse())),
    publish: (config, reason) => {
      const next: RiskConfigVersion = {
        version: (riskVersions[riskVersions.length - 1]?.version ?? 0) + 1,
        config: structuredClone(config),
        isActive: true,
        reason,
        createdAt: new Date().toISOString(),
      }
      riskVersions = [...riskVersions.map((v) => ({ ...v, isActive: false })), next]
      log('Marcos Cavalcante', 'GESTOR', 'PUT /admin/risk-config', `RiskConfig v${next.version}`)
      return delay(structuredClone(next))
    },
  },
}
