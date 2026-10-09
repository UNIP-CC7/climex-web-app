import type {
  Alert,
  AuditEntry,
  DashboardSummary,
  Report,
  LatLng,
  RescueRequest,
  RescueStatus,
  Risk,
  RiskBand,
  Role,
  Severity,
  Shelter,
  ShelterKind,
} from '@/domain/types'
import { RISK_BANDS } from '@/domain/types'
import type { HeatCell } from '@/lib/heat'
import { makeRisk } from '@/lib/risk'
import type { SessionUser } from '../types'
import type {
  ApiAlert,
  ApiAlertLevel,
  ApiAuditEntry,
  ApiDashboardSummary,
  ApiHeatmap,
  ApiReport,
  ApiRescue,
  ApiRescueStatus,
  ApiRescueStatusPatch,
  ApiRole,
  ApiShelter,
  ApiShelterPatch,
  ApiUser,
} from './dto'

/* ---------- perfis ---------- */
const ROLE_FROM_API: Record<ApiRole, Role | null> = { CIDADAO: null, AGENTE: 'AGENTE', GESTOR: 'GESTOR', ADMINISTRADOR: 'ADMIN' }

/** O painel chama o administrador de ADMIN. Devolve null para o cidadão, que usa só o aplicativo. */
export function roleFromApi(role: string | null | undefined): Role | null {
  return (role && ROLE_FROM_API[role as ApiRole]) || null
}
export const roleToApi = (role: Role): ApiRole => (role === 'ADMIN' ? 'ADMINISTRADOR' : role)

export function toSessionUser(u: ApiUser): SessionUser | null {
  const role = roleFromApi(u.role)
  return role ? { id: u.id, name: u.name, role } : null
}

/** A API espera o telefone em E.164. Aceita "(11) 99000-0001", "11990000001", "5511990000001" e "+5511990000001". */
export function toE164(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (input.trim().startsWith('+')) return `+${digits}`
  if (digits.length >= 12 && digits.startsWith('55')) return `+${digits}`
  return `+55${digits}`
}

/* ---------- alertas ---------- */
const SOURCES = ['INMET', 'DEFESA_CIVIL', 'MANUAL'] as const

/** O painel pede o bairro no formulário, mas a API não tem esse campo: ele vai no fim da descrição e volta daqui. */
const NEIGHBORHOOD_TAG = 'Bairro afetado: '
export function alertDescription(title: string, neighborhood: string): string {
  return `${title}. ${NEIGHBORHOOD_TAG}${neighborhood}.`
}
function neighborhoodFrom(description: string, fallback: string): string {
  const i = description.lastIndexOf(NEIGHBORHOOD_TAG)
  if (i < 0) return fallback
  return (
    description
      .slice(i + NEIGHBORHOOD_TAG.length)
      .replace(/\.\s*$/, '')
      .trim() || fallback
  )
}

function ringFromGeoJson(ring: unknown): LatLng[] | null {
  if (!Array.isArray(ring) || !ring.length) return null
  const points: LatLng[] = []
  for (const p of ring) {
    // um ponto malformado invalida o anel
    if (!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null
    points.push([p[1] as number, p[0] as number])
  }
  // um anel de verdade tem 4 posições (a última repete a primeira) e ao menos 3 vértices diferentes
  if (points.length < 4 || new Set(points.map((q) => q.join(','))).size < 3) return null
  return points
}

/**
 * GeoJSON [lng, lat] para o [lat, lng] do Leaflet, com o anel externo de cada polígono. Buracos são ignorados.
 * Um anel malformado é descartado. Se nenhum sobrar, devolve null e vale o círculo de reserva.
 */
export function polygonsFromGeoJson(geo: unknown): LatLng[][] | null {
  const g = geo as { type?: string; coordinates?: unknown } | null
  if (!g || !Array.isArray(g.coordinates)) return null
  if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') return null
  const polygons: unknown[] = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]
  const rings = polygons.map((p) => ringFromGeoJson(Array.isArray(p) ? p[0] : null)).filter((r): r is LatLng[] => r !== null)
  return rings.length ? rings : null
}

/** Círculo aproximado, só para o caso de a API não devolver o polígono. */
function circle(lat: number, lng: number, radiusMeters: number): LatLng[] {
  const dLat = radiusMeters / 111_320
  const dLng = dLat / Math.cos((lat * Math.PI) / 180)
  return Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * 2 * Math.PI
    return [lat + dLat * Math.sin(a), lng + dLng * Math.cos(a)] as LatLng
  })
}

export function alertFromApi(a: ApiAlert): Alert {
  const source = a.source.toUpperCase()
  return {
    id: a.id,
    title: a.title,
    severity: a.level as Severity,
    city: a.city,
    neighborhood: neighborhoodFrom(a.description, a.city),
    polygons: polygonsFromGeoJson(a.polygon) ?? [circle(a.latitude, a.longitude, a.radiusMeters ?? 1000)],
    issuedAt: a.createdAt,
    expiresAt: a.expiresAt,
    active: a.status === 'ACTIVE',
    source: (SOURCES as readonly string[]).includes(source) ? (source as Alert['source']) : 'MANUAL',
  }
}
export const severityToApi = (s: Severity): ApiAlertLevel => s

/* ---------- abrigos ---------- */
/** A API não classifica o abrigo. O tipo vem do nome, com "centro comunitário" quando nada bate. */
export function shelterKindFromName(name: string): ShelterKind {
  if (/gin[aá]sio|poliesportivo|quadra/i.test(name)) return 'ginasio_esportivo'
  if (/escola|emef|emei|emeb|col[eé]gio|etec|fatec|creche/i.test(name)) return 'escola'
  if (/cras|creas|assist[eê]ncia/i.test(name)) return 'assistencia_social'
  return 'centro_comunitario'
}

export function shelterFromApi(s: ApiShelter): Shelter {
  return {
    id: s.id,
    name: s.name,
    kind: shelterKindFromName(s.name),
    lat: s.latitude,
    lng: s.longitude,
    street: s.address || null,
    neighborhood: null,
    city: null,
    phone: s.contactPhone,
    capacity: s.capacity,
    occupancy: s.currentOccupancy,
    status: s.isActive ? 'ATIVO' : 'INATIVO',
    simulated: false,
    resources: { water: s.hasWater, food: s.hasFood, medical: s.hasMedical, accessible: s.isAccessible, pets: s.isPetFriendly },
  }
}

export function shelterPatchToApi(patch: Partial<Pick<Shelter, 'capacity' | 'status' | 'resources'>>): ApiShelterPatch {
  const out: ApiShelterPatch = {}
  if (patch.capacity !== undefined) out.capacity = patch.capacity
  // a API só conhece ativo ou não: "candidato" e "inativo" viram desativado
  if (patch.status !== undefined) out.isActive = patch.status === 'ATIVO'
  const r = patch.resources
  if (r) {
    out.hasWater = r.water
    out.hasFood = r.food
    out.hasMedical = r.medical
    out.isAccessible = r.accessible
    out.isPetFriendly = r.pets
  }
  return out
}

/* ---------- socorro ---------- */
const RESCUE_STATUS_FROM_API: Record<ApiRescueStatus, RescueStatus> = {
  PENDING: 'ABERTA',
  ASSIGNED: 'EM_ATENDIMENTO',
  IN_PROGRESS: 'EM_ATENDIMENTO',
  RESOLVED: 'CONCLUIDA',
  CANCELLED: 'CANCELADA',
}

const BANDS: readonly string[] = RISK_BANDS

/** A pontuação (0 a 100) e a faixa vêm da API. Se vier algo fora do combinado, a pontuação vale e a faixa é recalculada. */
function riskFromApi(r: ApiRescue): Risk {
  const fixed = makeRisk(Number(r.nrScore))
  return BANDS.includes(r.riskLevel) ? { score: fixed.score, band: r.riskLevel } : fixed
}

export function rescueFromApi(r: ApiRescue): RescueRequest {
  return {
    id: r.id,
    type: r.type,
    status: RESCUE_STATUS_FROM_API[r.status],
    risk: riskFromApi(r),
    sos: r.isSos,
    lat: r.latitude,
    lng: r.longitude,
    address: r.description?.trim() || 'Sem descrição',
    neighborhood: '',
    inAlertArea: r.alertId != null,
    people: r.victimCount,
    requesterName: null,
    distanceKm: null,
    openedAt: r.createdAt,
    resolvedAt: r.resolvedAt ?? null,
    assignedTo: r.assignedAgentId,
    outcome: r.outcomeNote,
  }
}

/** Troca de situação do painel para o PATCH /rescue/:id/status. Voltar para "aberta" não existe na API. */
export function rescueStatusToApi(status: RescueStatus, outcome?: string): ApiRescueStatusPatch {
  switch (status) {
    case 'EM_ATENDIMENTO':
      return { status: 'ASSIGNED' }
    case 'CONCLUIDA': {
      // a API devolve 422 sem o desfecho: melhor avisar antes de enviar
      const note = outcome?.trim()
      if (!note) throw new Error('Informe o desfecho do atendimento para concluir a solicitação.')
      return { status: 'RESOLVED', outcomeNote: note }
    }
    case 'CANCELADA':
      return { status: 'CANCELLED', outcomeNote: outcome?.trim() || undefined }
    default:
      throw new Error('A API não permite reabrir uma solicitação.')
  }
}

/* ---------- auditoria ---------- */
export function auditFromApi(e: ApiAuditEntry): AuditEntry {
  return {
    seq: e.sequence,
    at: e.createdAt,
    author: e.userId ? `Usuário ${e.userId.slice(0, 8)}` : 'Sistema',
    role: roleFromApi(e.userRole),
    action: e.action,
    entity: [e.entityType, e.entityId?.slice(0, 8)].filter(Boolean).join(' '),
    status: e.statusCode ?? 0,
    ip: e.ipAddress ?? '-',
    hash: e.hash,
    prevHash: e.previousHash ?? '',
  }
}

/* ---------- resumo do painel ---------- */
export const SEV_ORDER: Record<Severity, number> = { OBSERVACAO: 0, ATENCAO: 1, ALERTA: 2, ALERTA_MAXIMO: 3 }

const RISK_ZERO: Record<RiskBand, number> = { CRITICO: 0, ALTO: 0, MEDIO: 0, BAIXO: 0 }
const riskCounts = (c: Partial<Record<RiskBand, number>> | undefined): Record<RiskBand, number> => ({ ...RISK_ZERO, ...c })

/** GET /v1/dashboard/summary. `agentsActive` é a contagem de agentes ativos, a mesma ideia do modo simulado. */
export function summaryFromApi(s: ApiDashboardSummary): DashboardSummary {
  return {
    activeAlerts: s.activeAlerts,
    maxAlert: s.maxAlert ? { id: s.maxAlert.id, title: s.maxAlert.title, severity: s.maxAlert.level, place: s.maxAlert.city } : null,
    openRescue: s.openRescue,
    openByRisk: riskCounts(s.openByRisk),
    sheltersWithSpots: s.sheltersWithSpots,
    shelterTotal: s.sheltersActive,
    spotsFree: s.spotsFree,
    spotsTotal: s.spotsTotal,
    agentsInField: s.agentsActive,
    agentsAttending: s.agentsAttending,
    simulated: false,
    updatedAt: s.updatedAt,
  }
}

/** GET /v1/dashboard/heatmap: a intensidade de cada célula é a contagem dela sobre a maior contagem. */
export function heatFromApi(h: ApiHeatmap): HeatCell[] {
  let max = 0
  for (const c of h.cells) if (c.count > max) max = c.count
  return h.cells.map((c) => ({ lat: c.latitude, lng: c.longitude, count: c.count, score: c.count, intensity: max > 0 ? c.count / max : 0 }))
}

/** GET /v1/dashboard/report */
export function reportFromApi(r: ApiReport): Report {
  return {
    periodHours: r.periodHours,
    from: r.from,
    to: r.to,
    rescue: { ...r.rescue, byRisk: riskCounts(r.rescue.byRisk) },
    alerts: r.alerts,
    shelters: r.shelters.map((s) => ({
      id: s.id,
      name: s.name,
      capacity: s.capacity,
      occupancy: s.currentOccupancy,
      available: s.availableSlots,
      rate: s.occupancyRate,
    })),
  }
}
