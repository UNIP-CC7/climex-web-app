import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { services, useMocks } from '@/services'
import { buildSummary } from '@/services/http/mappers'
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

/** Modo simulado: o resumo vem do serviço, que calcula em cima do estado simulado. */
function useSummaryFromService(): SummaryState {
  const q = useQuery({ queryKey: ['summary'], queryFn: services.dashboard.summary, refetchInterval: REFRESH_MS })
  return { data: q.data, dataUpdatedAt: q.dataUpdatedAt, isPending: q.isPending, isError: q.isError, error: q.error }
}

/**
 * Modo HTTP: a API não tem rota de resumo, então ele é derivado das consultas de alertas, abrigos e socorro que as telas já usam.
 * Não há consulta própria: nenhuma busca repetida e nenhum jeito de o resumo ficar fora de sincronia com as listas.
 */
function useSummaryFromLists(): SummaryState {
  const alerts = useAlerts()
  const shelters = useShelters()
  const rescue = useRescue()
  const a = alerts.data
  const s = shelters.data
  const r = rescue.data
  const updatedAt = a && s && r ? Math.min(alerts.dataUpdatedAt, shelters.dataUpdatedAt, rescue.dataUpdatedAt) : 0 // vale a lista mais velha
  const data = useMemo(() => (a && s && r ? buildSummary(a, s, r, new Date(updatedAt)) : undefined), [a, s, r, updatedAt])
  return {
    data,
    dataUpdatedAt: updatedAt,
    isPending: alerts.isPending || shelters.isPending || rescue.isPending,
    isError: alerts.isError || shelters.isError || rescue.isError,
    error: alerts.error ?? shelters.error ?? rescue.error,
  }
}

// a escolha é uma constante do módulo, então a ordem dos hooks nunca muda entre renderizações
export const useSummary: () => SummaryState = useMocks ? useSummaryFromService : useSummaryFromLists

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
    onSuccess: () => inv('rescue', 'summary', 'audit'),
  })
}

export function useCreateAlert() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: services.alerts.create, onSuccess: () => inv('alerts', 'summary', 'audit') })
}
export function useCloseAlert() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: services.alerts.close, onSuccess: () => inv('alerts', 'summary', 'audit') })
}

export function useUpdateShelter() {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: (v: { id: string; patch: Partial<Pick<Shelter, 'capacity' | 'status' | 'resources'>> }) => services.shelters.update(v.id, v.patch),
    onSuccess: () => inv('shelters', 'summary', 'audit'),
  })
}
export function useCheckIn() {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: (v: { id: string; delta: number }) => services.shelters.checkIn(v.id, v.delta),
    onSuccess: () => inv('shelters', 'summary'),
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
