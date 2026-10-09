import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { services } from '@/services'
import { candidateToShelter, loadOsmCandidates } from '@/services/osm'
import type { DashboardSummary, RescueStatus, Role, Shelter } from '@/domain/types'

/** Atualização automática a cada 30 s (RF-DASH). WebSocket entra quando a API existir. */
export const REFRESH_MS = 30_000

export const useAlerts = () => useQuery({ queryKey: ['alerts'], queryFn: services.alerts.list, refetchInterval: REFRESH_MS })
export const useShelters = () => useQuery({ queryKey: ['shelters'], queryFn: services.shelters.list, refetchInterval: REFRESH_MS })
export const useRescue = () => useQuery({ queryKey: ['rescue'], queryFn: services.rescue.list, refetchInterval: REFRESH_MS })

export interface SummaryState {
  data: DashboardSummary | undefined
  dataUpdatedAt: number
  isPending: boolean
  isError: boolean
  error: unknown
}

/** O resumo vem do serviço: da API (GET /v1/dashboard/summary) ou, no modo simulado, do estado simulado. */
export function useSummary(): SummaryState {
  const q = useQuery({ queryKey: ['summary'], queryFn: services.dashboard.summary, refetchInterval: REFRESH_MS })
  return { data: q.data, dataUpdatedAt: q.dataUpdatedAt, isPending: q.isPending, isError: q.isError, error: q.error }
}

/** Janela do mapa de calor: as últimas 24 horas, o padrão da API. */
export const HEAT_HOURS = 24

/** Mapa de calor de ocorrências. Só busca quando a camada está ligada. */
export const useHeatmap = (enabled: boolean, hours = HEAT_HOURS) =>
  useQuery({ queryKey: ['heatmap', hours], queryFn: () => services.dashboard.heatmap(hours), enabled, refetchInterval: REFRESH_MS })

/** Relatório pós-evento do período. */
export const useReport = (hours: number) =>
  useQuery({ queryKey: ['report', hours], queryFn: () => services.dashboard.report(hours), refetchInterval: REFRESH_MS })

/** Candidatos a abrigo do OpenStreetMap, só quando a camada está ligada. O arquivo é estático, então nunca fica velho e não vai para o disco. */
export const useOsmCandidates = (enabled: boolean) =>
  useQuery({
    queryKey: ['osm-candidates'],
    queryFn: async () => (await loadOsmCandidates()).map(candidateToShelter),
    enabled,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  })
export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: services.users.list })
export const useAudit = () => useQuery({ queryKey: ['audit'], queryFn: services.audit.list })

function useInvalidate() {
  const qc = useQueryClient()
  return (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
}

export function useSetRescueStatus() {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: (v: { id: string; status: RescueStatus; agent: string; outcome?: string }) =>
      services.rescue.setStatus(v.id, v.status, v.agent, v.outcome),
    onSuccess: () => inv('rescue', 'summary', 'heatmap', 'report', 'audit'),
  })
}

export function useCreateAlert() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: services.alerts.create, onSuccess: () => inv('alerts', 'summary', 'report', 'audit') })
}
export function useCloseAlert() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: services.alerts.close, onSuccess: () => inv('alerts', 'summary', 'report', 'audit') })
}

export function useUpdateShelter() {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: (v: { id: string; patch: Partial<Pick<Shelter, 'capacity' | 'status' | 'resources'>> }) => services.shelters.update(v.id, v.patch),
    onSuccess: () => inv('shelters', 'summary', 'report', 'audit'),
  })
}
export function useCheckIn() {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: (v: { id: string; delta: number }) => services.shelters.checkIn(v.id, v.delta),
    onSuccess: () => inv('shelters', 'summary', 'report'),
  })
}

export function useSetUserRole() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: (v: { id: string; role: Role }) => services.users.setRole(v.id, v.role), onSuccess: () => inv('users', 'audit') })
}
export function useSetUserActive() {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: (v: { id: string; active: boolean }) => services.users.setActive(v.id, v.active),
    onSuccess: () => inv('users', 'audit'),
  })
}
