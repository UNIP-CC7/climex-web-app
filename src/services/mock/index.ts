import type { Alert, AppUser, DashboardSummary, Report, RescueRequest, RescueStatus, RiskBand, Role, Shelter, ShelterKind } from '@/domain/types'
import { heatCells, type HeatCell } from '@/lib/heat'
import { reportToCsv } from '@/lib/reportCsv'
import { ALERTS, AUDIT, CENTER, RESCUE, USERS, area, fakeHash } from '@/mocks/seed'
import { PUBLIC, distanceKm, loadOsmCandidates } from '../osm'
import type { Services } from '../types'

const delay = <T>(v: T, ms = 120) => new Promise<T>((r) => setTimeout(() => r(v), ms))

/* ---------- estado em memória (some ao recarregar) ---------- */
let alerts: Alert[] = structuredClone(ALERTS)
let rescue: RescueRequest[] = structuredClone(RESCUE)
let users: AppUser[] = structuredClone(USERS)
const audit = structuredClone(AUDIT)

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

export const mockServices: Services = {
  auth: {
    login: (role) =>
      delay({ id: `sess-${role}`, role, name: { AGENTE: 'Renata Lopes', GESTOR: 'Marcos Cavalcante', ADMIN: 'Diego Arruda' }[role] }, 250),
    loginWithPassword: () => Promise.reject(new Error('O modo simulado não tem login por senha. Escolha um perfil.')),
    logout: () => Promise.resolve(),
  },
  alerts: {
    list: () => delay([...alerts].sort((a, b) => SEV_ORDER[b.severity] - SEV_ORDER[a.severity])),
    create: ({ title, severity, neighborhood, center, radiusKm, hours }) => {
      const a: Alert = {
        id: `al-${Date.now()}`,
        title,
        severity,
        neighborhood,
        city: 'Santana de Parnaíba',
        polygons: [area(center, radiusKm / 111)],
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
    checkIn: async (id, delta) => {
      const all = await loadShelters()
      const s = all.find((x) => x.id === id)
      if (!s) throw new Error('Abrigo não encontrado')
      const next = s.occupancy + delta
      if (next > s.capacity) throw new Error('Abrigo lotado')
      s.occupancy = Math.max(0, next)
      return delay({ ...s }, 60)
    },
  },
  rescue: {
    list: () => delay(rescue.map((r) => ({ ...r }))),
    setStatus: (id, status, agent, outcome) => {
      rescue = rescue.map((r) => (r.id === id ? { ...r, status, assignedTo: status === 'ABERTA' ? null : agent, outcome: outcome ?? r.outcome } : r))
      const r = rescue.find((x) => x.id === id)!
      log(
        agent,
        users.find((u) => u.name === agent)?.role ?? 'GESTOR',
        status === 'EM_ATENDIMENTO' ? 'Aceitou solicitação' : 'Registrou desfecho',
        `RescueRequest ${id}`,
      )
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
}
