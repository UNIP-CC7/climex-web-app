/**
 * Formato das respostas da climex-api (prefixo /v1), só com os campos que o painel usa.
 * Escrito à mão de propósito: o painel é público e a API é privada, então o openapi.json não entra neste repositório.
 */

export type ApiRole = 'CIDADAO' | 'AGENTE' | 'GESTOR' | 'ADMINISTRADOR'

export interface ApiUser {
  id: string
  name: string
  phone: string
  role: ApiRole
  createdAt: string
}

export interface ApiTokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: ApiUser
}

export interface ApiPagination {
  page: number
  limit: number
  total: number
  pages: number
  hasNext: boolean
}
export interface ApiPage<T> {
  data: T[]
  pagination: ApiPagination
}

/** Corpo de erro `application/problem+json` (RFC 7807) */
export interface ApiProblem {
  type?: string
  title?: string
  status?: number
  detail?: string
  code?: string
  traceId?: string
  errors?: { field: string; message: string }[]
}

export interface ApiRiskConfigVersion {
  version: number
  config: import('@/domain/types').RiskConfig
  isActive: boolean
  reason: string | null
  createdBy: string | null
  createdAt: string
}

export type ApiAlertLevel = 'OBSERVACAO' | 'ATENCAO' | 'ALERTA' | 'ALERTA_MAXIMO'
export type ApiAlertStatus = 'ACTIVE' | 'MONITORING' | 'RESOLVED' | 'EXPIRED'
export interface ApiAlert {
  id: string
  title: string
  description: string
  level: ApiAlertLevel
  status: ApiAlertStatus
  latitude: number
  longitude: number
  radiusMeters: number | null
  city: string
  state: string
  source: string
  /** GeoJSON Polygon ou MultiPolygon, [lng, lat] */
  polygon: unknown
  expiresAt: string | null
  createdAt: string
}
export interface ApiCreateAlert {
  title: string
  description: string
  level: ApiAlertLevel
  latitude: number
  longitude: number
  radiusMeters?: number
  polygon?: { type: 'Polygon'; coordinates: [number, number][][] }
  city: string
  state: string
  expiresAt: string
}

export interface ApiShelter {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  capacity: number
  currentOccupancy: number
  isActive: boolean
  isAccessible: boolean
  isPetFriendly: boolean
  hasWater: boolean
  hasFood: boolean
  hasMedical: boolean
  hasPowerBackup: boolean
  contactPhone: string | null
}
export interface ApiShelterPatch {
  capacity?: number
  isActive?: boolean
  hasWater?: boolean
  hasFood?: boolean
  hasMedical?: boolean
  contactPhone?: string
  isAccessible?: boolean
  isPetFriendly?: boolean
}
export interface ApiCheckInResult {
  shelter: ApiShelter
}
export interface ApiCheckInRecord {
  id: string
  displayName: string
  isRegisteredUser: boolean
  guestCount: number
  checkedInAt: string
  checkedOutAt: string | null
}
export interface ApiCheckOutResult {
  checkInId: string
  shelterId: string
  guestCount: number
  checkedOutAt: string
  shelter: ApiShelter
}

export type ApiRescueType = 'EVACUACAO' | 'FERIDO' | 'ILHADO' | 'DESABAMENTO' | 'OUTROS'
export type ApiRescueStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED'
export type ApiRiskLevel = 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO'
export interface ApiRescue {
  id: string
  type: ApiRescueType
  status: ApiRescueStatus
  riskLevel: ApiRiskLevel
  nrScore: number
  isSos: boolean
  description: string | null
  latitude: number
  longitude: number
  victimCount: number
  outcomeNote: string | null
  alertId: string | null
  assignedAgentId: string | null
  createdAt: string
  /** quando o atendimento foi concluído; null enquanto estiver em aberto */
  resolvedAt: string | null
}
export interface ApiRescueStatusPatch {
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED'
  outcomeNote?: string
}

export interface ApiAuditEntry {
  id: string
  sequence: number
  userId: string | null
  userRole: string | null
  action: string
  entityType: string
  entityId: string | null
  statusCode: number | null
  ipAddress: string | null
  hash: string
  previousHash: string | null
  createdAt: string
}

export interface ApiAdminUser {
  id: string
  name: string
  phone: string
  role: ApiRole
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}
export interface ApiChangeRoleResult {
  user: ApiAdminUser
}
export interface ApiUserStatusResult {
  user: ApiAdminUser
  revokedSessions: number
}

/* ---------- /v1/dashboard ---------- */
export interface ApiRiskCounts {
  BAIXO: number
  MEDIO: number
  ALTO: number
  CRITICO: number
}
export interface ApiDashboardSummary {
  activeAlerts: number
  maxAlert: { id: string; title: string; level: ApiAlertLevel; city: string } | null
  openRescue: number
  inProgressRescue: number
  openByRisk: ApiRiskCounts
  sheltersActive: number
  sheltersWithSpots: number
  spotsFree: number
  spotsTotal: number
  /** agentes cadastrados e ativos (não é presença em campo) */
  agentsActive: number
  agentsAttending: number
  updatedAt: string
}
export interface ApiHeatmap {
  periodHours: number
  cellDegrees: number
  total: number
  cells: { latitude: number; longitude: number; count: number }[]
}
export interface ApiReport {
  periodHours: number
  from: string
  to: string
  rescue: {
    total: number
    sos: number
    resolved: number
    cancelled: number
    avgResolutionMinutes: number | null
    byStatus: Record<string, number>
    byRisk: ApiRiskCounts
    byType: Record<string, number>
  }
  alerts: { total: number; byLevel: Record<string, number> }
  shelters: { id: string; name: string; capacity: number; currentOccupancy: number; availableSlots: number; occupancyRate: number }[]
}

export type ApiShelterStatus = 'CANDIDATE' | 'CONFIRMED' | 'REJECTED'
/** Abrigo com os campos de revisão, que a API devolve para a equipe. */
export interface ApiReviewShelter extends ApiShelter {
  status: ApiShelterStatus
  source: string | null
  sourceCategory: string | null
  sourceRemovedAt: string | null
  reviewedAt: string | null
  reviewNote: string | null
}
export interface ApiReviewList {
  data: ApiReviewShelter[]
  total: number
}
export interface ApiShelterStatusBody {
  status: ApiShelterStatus
  note?: string
}
export interface ApiSyncInmet {
  fetched: number
  invalid: number
  inScope: number
  created: number
  updated: number
  reactivated: number
  resolved: number
  expired: number
  notified: number
}
export interface ApiSyncShelters {
  source: string
  fetched: number
  skipped: number
  created: number
  updated: number
  unchanged: number
  removedFromSource: number
}
