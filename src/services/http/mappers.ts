import type {
  Alert,
  AuditEntry,
  DashboardSummary,
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
import { makeRisk } from '@/lib/risk'
import type { SessionUser } from '../types'
import type {
  ApiAlert,
  ApiAlertLevel,
  ApiAuditEntry,
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

/** GeoJSON [lng, lat] para o [lat, lng] do Leaflet. Usa o anel externo do primeiro polígono. */
export function polygonFromGeoJson(geo: unknown): LatLng[] | null {
  const g = geo as { type?: string; coordinates?: unknown } | null
  if (!g || !Array.isArray(g.coordinates)) return null
  if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') return null
  const ring = (g.type === 'MultiPolygon' ? (g.coordinates as unknown[][][][])[0]?.[0] : (g.coordinates as unknown[][][])[0]) as unknown[] | undefined
  if (!Array.isArray(ring) || !ring.length) return null
  const points: LatLng[] = []
  for (const p of ring) {
    // um ponto malformado invalida o polígono todo, e aí vale o círculo de reserva
    if (!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null
    points.push([p[1] as number, p[0] as number])
  }
  return points
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
    polygon: polygonFromGeoJson(a.polygon) ?? circle(a.latitude, a.longitude, a.radiusMeters ?? 1000),
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
const SEV_ORDER: Record<Severity, number> = { OBSERVACAO: 0, ATENCAO: 1, ALERTA: 2, ALERTA_MAXIMO: 3 }

/** A API não tem rota de resumo: o painel calcula a partir das três listas. */
export function buildSummary(alerts: Alert[], shelters: Shelter[], rescue: RescueRequest[], now = new Date()): DashboardSummary {
  const active = alerts.filter((a) => a.active)
  const open = rescue.filter((r) => r.status === 'ABERTA')
  const openByRisk: Record<RiskBand, number> = { CRITICO: 0, ALTO: 0, MEDIO: 0, BAIXO: 0 }
  open.forEach((r) => openByRisk[r.risk.band]++)
  const live = shelters.filter((s) => s.status === 'ATIVO')
  const free = (s: Shelter) => Math.max(0, s.capacity - s.occupancy)
  return {
    activeAlerts: active.length,
    maxAlert: [...active].sort((a, b) => SEV_ORDER[b.severity] - SEV_ORDER[a.severity])[0] ?? null,
    openRescue: open.length,
    openByRisk,
    sheltersWithSpots: live.filter((s) => free(s) > 0).length,
    shelterTotal: live.length,
    spotsFree: live.reduce((n, s) => n + free(s), 0),
    spotsTotal: live.reduce((n, s) => n + s.capacity, 0),
    agentsInField: null, // a API não informa quais agentes estão em campo
    agentsAttending: new Set(rescue.filter((r) => r.status === 'EM_ATENDIMENTO' && r.assignedTo).map((r) => r.assignedTo)).size,
    simulated: false,
    updatedAt: now.toISOString(),
  }
}
