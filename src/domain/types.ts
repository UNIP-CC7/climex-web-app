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
  /** Um anel externo por área. Um alerta com várias áreas separadas (MultiPolygon da API) tem mais de um. */
  polygons: LatLng[][]
  issuedAt: string
  /** null quando a API não informa validade */
  expiresAt: string | null
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

export type RescueType = 'ILHADO' | 'FERIDO' | 'EVACUACAO' | 'DESABAMENTO' | 'OUTROS'
export const RESCUE_TYPE_LABEL: Record<RescueType, string> = {
  ILHADO: 'Ilhado',
  FERIDO: 'Ferido',
  EVACUACAO: 'Evacuação',
  DESABAMENTO: 'Desabamento',
  OUTROS: 'Outros',
}
export type RescueStatus = 'ABERTA' | 'EM_ATENDIMENTO' | 'CONCLUIDA' | 'CANCELADA'
export const RESCUE_STATUS_LABEL: Record<RescueStatus, string> = {
  ABERTA: 'Aberta',
  EM_ATENDIMENTO: 'Em atendimento',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
}
/** Faixa de risco, a mesma que a API devolve em `riskLevel` */
export type RiskBand = 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO'
export const RISK_BANDS: readonly RiskBand[] = ['CRITICO', 'ALTO', 'MEDIO', 'BAIXO']
export const RISK_BAND_LABEL: Record<RiskBand, string> = { BAIXO: 'Baixo', MEDIO: 'Médio', ALTO: 'Alto', CRITICO: 'Crítico' }
/** Nível de Risco (NR): pontuação de 0 a 100 e a faixa correspondente */
export interface Risk {
  score: number
  band: RiskBand
}

export interface RescueRequest {
  id: string
  type: RescueType
  status: RescueStatus
  risk: Risk
  sos: boolean
  lat: number
  lng: number
  address: string
  neighborhood: string
  inAlertArea: boolean
  people: number
  /** null quando a API não informa (a lista de socorro não traz o nome de quem pediu) */
  requesterName: string | null
  /** null quando a API não informa a distância até o agente */
  distanceKm: number | null
  openedAt: string
  assignedTo: string | null
  outcome: string | null
}

export interface DashboardSummary {
  activeAlerts: number
  maxAlert: Alert | null
  openRescue: number
  openByRisk: Record<RiskBand, number>
  sheltersWithSpots: number
  shelterTotal: number
  spotsFree: number
  spotsTotal: number
  /** null quando a API não informa quais agentes estão em campo */
  agentsInField: number | null
  agentsAttending: number
  /** true quando capacidade e ocupação dos abrigos são simuladas */
  simulated: boolean
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
  role: Role | null
  action: string
  entity: string
  status: number
  ip: string
  hash: string
  prevHash: string
}
