export type Role = 'AGENTE' | 'GESTOR' | 'ADMIN'
export const ROLE_LABEL: Record<Role, string> = { AGENTE: 'Agente de campo', GESTOR: 'Gestor municipal', ADMIN: 'Administrador' }

export type Severity = 'OBSERVACAO' | 'ATENCAO' | 'ALERTA' | 'ALERTA_MAXIMO'
export const SEVERITY_LABEL: Record<Severity, string> = {
  OBSERVACAO: 'Observação',
  ATENCAO: 'Atenção',
  ALERTA: 'Alerta',
  ALERTA_MAXIMO: 'Alerta Máximo',
}
export type LatLng = [number, number]

export interface Alert {
  id: string
  title: string
  severity: Severity
  city: string
  neighborhood: string
  polygon: LatLng[]
  issuedAt: string
  expiresAt: string
  active: boolean
  source: 'INMET' | 'DEFESA_CIVIL' | 'MANUAL'
}

export type ShelterKind = 'escola' | 'ginasio_esportivo' | 'centro_comunitario' | 'assistencia_social'
export interface Shelter {
  id: string
  name: string
  kind: ShelterKind
  lat: number
  lng: number
  street: string | null
  neighborhood: string | null
  city: string | null
  phone: string | null
  capacity: number
  occupancy: number
  status: 'ATIVO' | 'INATIVO' | 'CANDIDATO'
  /** capacidade e ocupação são simuladas enquanto não existe cadastro oficial */
  simulated: boolean
  resources: { water: boolean; food: boolean; medical: boolean; accessible: boolean; pets: boolean }
}

export type RescueType = 'ILHADO' | 'FERIDO' | 'EVACUACAO' | 'DESABAMENTO'
export const RESCUE_TYPE_LABEL: Record<RescueType, string> = {
  ILHADO: 'Ilhado',
  FERIDO: 'Ferido',
  EVACUACAO: 'Evacuação',
  DESABAMENTO: 'Desabamento',
}
export type RescueStatus = 'ABERTA' | 'EM_ATENDIMENTO' | 'CONCLUIDA'
export const RESCUE_STATUS_LABEL: Record<RescueStatus, string> = {
  ABERTA: 'Aberta',
  EM_ATENDIMENTO: 'Em atendimento',
  CONCLUIDA: 'Concluída',
}
/** Nível de Risco, 1 a 5 */
export type RiskLevel = 1 | 2 | 3 | 4 | 5

export interface RescueRequest {
  id: string
  type: RescueType
  status: RescueStatus
  risk: RiskLevel
  sos: boolean
  lat: number
  lng: number
  address: string
  neighborhood: string
  inAlertArea: boolean
  people: number
  requesterName: string
  distanceKm: number
  openedAt: string
  assignedTo: string | null
  outcome: string | null
}

export interface DashboardSummary {
  activeAlerts: number
  maxAlert: Alert | null
  openRescue: number
  openByRisk: Record<RiskLevel, number>
  sheltersWithSpots: number
  shelterTotal: number
  spotsFree: number
  spotsTotal: number
  agentsInField: number
  agentsAttending: number
  updatedAt: string
}

export interface AppUser {
  id: string
  name: string
  role: Role
  phone: string
  lastAccess: string
  active: boolean
}

export interface AuditEntry {
  seq: number
  at: string
  author: string
  role: Role
  action: string
  entity: string
  status: number
  ip: string
  hash: string
  prevHash: string
}
