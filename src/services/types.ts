import type { Alert, AppUser, AuditEntry, DashboardSummary, LatLng, RescueRequest, RescueStatus, Role, Severity, Shelter } from '@/domain/types'

/**
 * Contratos de serviço do painel. Hoje existe só a implementação simulada (services/mock).
 * Quando a API estiver publicada, basta criar services/http com as mesmas assinaturas
 * e escolher em services/index.ts (VITE_USE_MOCKS=false).
 */
export interface SessionUser {
  id: string
  name: string
  role: Role
}
export interface AuthService {
  login(role: Role): Promise<SessionUser>
}
export interface AlertsService {
  list(): Promise<Alert[]>
  create(input: { title: string; severity: Severity; neighborhood: string; center: LatLng; radiusKm: number; hours: number }): Promise<Alert>
  close(id: string): Promise<void>
}
export interface SheltersService {
  list(): Promise<Shelter[]>
  update(id: string, patch: Partial<Pick<Shelter, 'capacity' | 'status' | 'resources'>>): Promise<Shelter>
  checkIn(id: string, delta: number): Promise<Shelter>
}
export interface RescueService {
  list(): Promise<RescueRequest[]>
  setStatus(id: string, status: RescueStatus, agent: string, outcome?: string): Promise<RescueRequest>
}
export interface DashboardService {
  summary(): Promise<DashboardSummary>
}
export interface UsersService {
  list(): Promise<AppUser[]>
  setRole(id: string, role: Role): Promise<AppUser>
  setActive(id: string, active: boolean): Promise<AppUser>
}
export interface AuditService {
  list(): Promise<AuditEntry[]>
}
export interface Services {
  auth: AuthService
  alerts: AlertsService
  shelters: SheltersService
  rescue: RescueService
  dashboard: DashboardService
  users: UsersService
  audit: AuditService
}
