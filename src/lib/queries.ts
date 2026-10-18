import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { services } from '@/services'
import { bboxKey } from './bbox'
import { loadMapCandidates } from './candidates'
import type { Bbox, DashboardSummary, RescueStatus, RiskConfig, Role, Shelter, ShelterConfirmInput, ShelterReviewQuery } from '@/domain/types'

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

/**
 * Candidatos a abrigo da API para a camada do mapa, só dentro da área visível e só quando a camada está ligada. A chave
 * começa com `shelter-review`, então qualquer decisão da revisão (confirmar, rejeitar, devolver, importar) também atualiza o mapa.
 * Ao mexer no mapa os pontos antigos ficam na tela até os novos chegarem.
 */
export const useMapCandidates = (enabled: boolean, area: Bbox | null) =>
  useQuery({
    queryKey: ['shelter-review', 'map', bboxKey(area)],
    queryFn: ({ signal }) => loadMapCandidates(services.shelterReview.list, area, undefined, signal),
    enabled: enabled && area != null,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: services.users.list })
export const useAudit = () => useQuery({ queryKey: ['audit'], queryFn: services.audit.list })
export const useRiskConfig = () => useQuery({ queryKey: ['risk-config'], queryFn: services.riskConfig.active })
export const useRiskHistory = () => useQuery({ queryKey: ['risk-history'], queryFn: services.riskConfig.history })

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
    mutationFn: (v: { id: string; people: number }) => services.shelters.checkIn(v.id, v.people),
    onSuccess: () => inv('shelters', 'summary', 'report', 'occupants'),
  })
}
export function useCheckOut() {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: (v: { id: string; occupantId: string }) => services.shelters.checkOut(v.id, v.occupantId),
    onSuccess: () => inv('shelters', 'summary', 'report', 'occupants'),
  })
}
export const useOccupants = (shelterId: string | null) =>
  useQuery({
    queryKey: ['occupants', shelterId],
    queryFn: () => services.shelters.occupants(shelterId!),
    enabled: shelterId != null,
  })

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

export function usePublishRiskConfig() {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: (v: { config: RiskConfig; reason: string }) => services.riskConfig.publish(v.config, v.reason),
    onSuccess: () => inv('risk-config', 'risk-history', 'audit'),
  })
}

/** Locais por situação na revisão de abrigos. Não vai para o disco: é dado da equipe e muda a cada decisão. */
export const useShelterReview = (query: ShelterReviewQuery) =>
  useQuery({ queryKey: ['shelter-review', query], queryFn: () => services.shelterReview.list(query), placeholderData: keepPreviousData })

export function useConfirmShelter() {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: (v: { id: string; input: ShelterConfirmInput }) => services.shelterReview.confirm(v.id, v.input),
    // também no erro: a confirmação são dois passos, e o primeiro (capacidade e recursos) pode ter valido
    onSettled: () => inv('shelter-review', 'shelters', 'summary', 'report', 'audit'),
  })
}
export function useRejectShelter() {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: (v: { id: string; note: string }) => services.shelterReview.reject(v.id, v.note),
    onSuccess: () => inv('shelter-review', 'shelters', 'audit'),
  })
}
export function useReopenShelter() {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: (v: { id: string; note?: string }) => services.shelterReview.reopen(v.id, v.note),
    onSuccess: () => inv('shelter-review', 'shelters', 'summary', 'report', 'audit'),
  })
}

export function useSyncAlerts() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: services.imports.syncAlerts, onSuccess: () => inv('alerts', 'summary', 'report', 'audit') })
}
export function useSyncShelters() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: services.imports.syncShelters, onSuccess: () => inv('shelter-review', 'audit') })
}
