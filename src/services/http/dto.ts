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
  radiusMeters: number
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
  isAccessible?: boolean
  isPetFriendly?: boolean
}
export interface ApiCheckInResult {
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

export interface ApiChangeRoleResult {
  user: ApiUser
}
