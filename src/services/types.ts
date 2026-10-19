import type {
  Alert,
  AppUser,
  AuditEntry,
  DashboardSummary,
  LatLng,
  Occupant,
  Report,
  RescueRequest,
  RescueStatus,
  RiskConfig,
  RiskConfigVersion,
  Role,
  Severity,
  Shelter,
  AlertSyncResult,
  ShelterCandidate,
  ShelterConfirmInput,
  ShelterReviewPage,
  ShelterReviewQuery,
  ShelterSyncResult,
} from '@/domain/types'
import type { HeatCell } from '@/lib/heat'

/**
 * Contratos de serviço do painel. Há duas implementações com as mesmas assinaturas:
 * services/mock (dados simulados) e services/http (climex-api). A escolha fica em services/index.ts (VITE_USE_MOCKS).
 */
export interface SessionUser {
  id: string
  name: string
  role: Role
}
export interface AuthService {
  /** Modo simulado: entra direto com o perfil escolhido. */
  login(role: Role): Promise<SessionUser>
  /** Modo HTTP: telefone e senha. Recusa o cidadão, que usa só o aplicativo. */
  loginWithPassword(phone: string, password: string): Promise<SessionUser>
  /** Revoga a sessão no servidor (se houver). Apagar a sessão local é do signOut do store. */
  logout(): Promise<void>
}
export interface AlertsService {
  list(): Promise<Alert[]>
  create(input: {
    title: string
    severity: Severity
    neighborhood: string
    center: LatLng
    radiusKm: number
    hours: number
    polygon?: LatLng[]
  }): Promise<Alert>
  close(id: string): Promise<void>
}
export interface SheltersService {
  list(): Promise<Shelter[]>
  update(id: string, patch: Partial<Pick<Shelter, 'capacity' | 'status' | 'resources'>>): Promise<Shelter>
  checkIn(id: string, people: number): Promise<Shelter>
  occupants(id: string): Promise<Occupant[]>
  checkOut(id: string, occupantId: string): Promise<Shelter>
}
export interface RescueService {
  list(): Promise<RescueRequest[]>
  setStatus(id: string, status: RescueStatus, agent: string, outcome?: string): Promise<RescueRequest>
}
export interface DashboardService {
  summary(): Promise<DashboardSummary>
  /** Concentração de solicitações de socorro nas últimas `hours` horas, em células de grade. */
  heatmap(hours: number): Promise<HeatCell[]>
  /** Relatório pós-evento das últimas `hours` horas. */
  report(hours: number): Promise<Report>
  /** O mesmo relatório em CSV, pronto para baixar. */
  reportCsv(hours: number): Promise<string>
}
export interface UsersService {
  list(): Promise<AppUser[]>
  setRole(id: string, role: Role): Promise<AppUser>
  setActive(id: string, active: boolean): Promise<AppUser>
}
export interface AuditService {
  list(): Promise<AuditEntry[]>
}
export interface RiskConfigService {
  /** Versão em vigor (version 0 = padrão embutido na API, sem versão gravada). */
  active(): Promise<RiskConfigVersion>
  /** Versões gravadas, da mais nova para a mais antiga. */
  history(): Promise<RiskConfigVersion[]>
  /** Cria uma versão nova e a ativa; nunca sobrescreve. Vale só para solicitações criadas depois. */
  publish(config: RiskConfig, reason: string): Promise<RiskConfigVersion>
}
export interface Services {
  auth: AuthService
  alerts: AlertsService
  shelters: SheltersService
  rescue: RescueService
  dashboard: DashboardService
  users: UsersService
  audit: AuditService
  riskConfig: RiskConfigService
  shelterReview: ShelterReviewService
  imports: ImportService
}

export interface ShelterReviewService {
  /** Lista locais por situação, paginada (equipe). */
  list(query: ShelterReviewQuery): Promise<ShelterReviewPage>
  /** Confirma o candidato como abrigo. Exige capacidade maior que zero. */
  confirm(id: string, input: ShelterConfirmInput): Promise<ShelterCandidate>
  /** Rejeita o candidato, com o motivo. */
  reject(id: string, note: string): Promise<ShelterCandidate>
  /** Devolve um local confirmado ou rejeitado para a lista de candidatos. */
  reopen(id: string, note?: string): Promise<ShelterCandidate>
}
export interface ImportService {
  /** Busca os avisos do INMET agora (administrador). Pode disparar notificações. */
  syncAlerts(): Promise<AlertSyncResult>
  /** Importa candidatos a abrigo da fonte, hoje só o OpenStreetMap (administrador). */
  syncShelters(): Promise<ShelterSyncResult>
}
