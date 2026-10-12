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
  /** null quando ainda não foi concluída ou quando a API não informa (hoje ela não envia a data de conclusão) */
  resolvedAt: string | null
  assignedTo: string | null
  outcome: string | null
}

/** O alerta mais grave no ar: o suficiente para o cartão do painel. `place` é o bairro (modo simulado) ou a cidade (API). */
export interface MaxAlert {
  id: string
  title: string
  severity: Severity
  place: string
}

export interface DashboardSummary {
  activeAlerts: number
  maxAlert: MaxAlert | null
  openRescue: number
  openByRisk: Record<RiskBand, number>
  sheltersWithSpots: number
  shelterTotal: number
  spotsFree: number
  spotsTotal: number
  /** agentes ativos (cadastrados e habilitados); `agentsAttending` diz quantos têm um caso aceito agora */
  agentsInField: number
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

/** Relatório pós-evento de um período (RF-DASH). Os números vêm da API ou, no modo simulado, do estado simulado. */
export interface Report {
  periodHours: number
  from: string
  to: string
  rescue: {
    total: number
    sos: number
    resolved: number
    cancelled: number
    /** minutos da abertura até a conclusão; null sem nenhuma concluída no período */
    avgResolutionMinutes: number | null
    byStatus: Record<string, number>
    byRisk: Record<RiskBand, number>
    byType: Record<string, number>
  }
  alerts: { total: number; byLevel: Record<string, number> }
  shelters: { id: string; name: string; capacity: number; occupancy: number; available: number; rate: number }[]
}

/**
 * Pesos e limiares do Nível de Risco (NR) das solicitações de socorro.
 * Não há protocolo oficial de calibração, então o gestor ajusta e cada mudança vira uma versão nova.
 */
export interface RiskConfig {
  type: { FERIDO: number; ILHADO: number; DESABAMENTO: number; EVACUACAO: number; OUTROS: number }
  alert: { ALERTA_MAXIMO: number; ALERTA: number; ATENCAO: number; OBSERVACAO: number }
  water: { SUBMERSO: number; PESCOCO: number; CINTURA: number; JOELHOS: number }
  structural: { DESABAMENTO_IMINENTE: number; RACHADURAS: number; NENHUM: number }
  vulnerability: { children: number; elderly: number; disabled: number; medicalNeeds: number }
  victims: { fromTwo: number; fromFive: number }
  thresholds: { MEDIO: number; ALTO: number; CRITICO: number }
}

export interface RiskConfigVersion {
  version: number
  config: RiskConfig
  isActive: boolean
  reason: string | null
  createdAt: string
}

/** Situação de um local na revisão da Defesa Civil: candidato (importado), confirmado como abrigo ou rejeitado. */
export type ShelterReviewStatus = 'CANDIDATE' | 'CONFIRMED' | 'REJECTED'
export const SHELTER_REVIEW_LABEL: Record<ShelterReviewStatus, string> = {
  CANDIDATE: 'Candidatos',
  CONFIRMED: 'Confirmados',
  REJECTED: 'Rejeitados',
}
export interface ShelterCandidate {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  /** categoria na fonte, por exemplo amenity=school */
  category: string | null
  source: string | null
  /** o local sumiu da fonte na última importação; nada é apagado, só sinalizado */
  removedFromSource: boolean
  status: ShelterReviewStatus
  capacity: number
  occupancy: number
  phone: string | null
  resources: Shelter['resources']
  reviewedAt: string | null
  /** nota da revisão, visível só para a equipe */
  reviewNote: string | null
}
export interface ShelterReviewPage {
  items: ShelterCandidate[]
  /** total que atende aos filtros, antes da paginação */
  total: number
}
export interface ShelterReviewQuery {
  status: ShelterReviewStatus
  search?: string
  limit: number
  offset: number
}
/** Dados que o gestor informa ao confirmar um candidato como abrigo. */
export interface ShelterConfirmInput {
  capacity: number
  phone?: string
  note?: string
  resources: Shelter['resources']
}

export interface AlertSyncResult {
  fetched: number
  invalid: number
  inScope: number
  created: number
  updated: number
  reactivated: number
  resolved: number
  expired: number
  /** alertas que dispararam notificação push */
  notified: number
}
export interface ShelterSyncResult {
  source: string
  fetched: number
  skipped: number
  created: number
  updated: number
  unchanged: number
  removedFromSource: number
}
