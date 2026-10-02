import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { services } from '@/services'
import type { RescueStatus, Role, Shelter } from '@/domain/types'

/** Atualização automática a cada 30 s (RF-DASH). WebSocket entra quando a API existir. */
export const REFRESH_MS = 30_000

export const useSummary = () => useQuery({ queryKey: ['summary'], queryFn: services.dashboard.summary, refetchInterval: REFRESH_MS })
export const useAlerts = () => useQuery({ queryKey: ['alerts'], queryFn: services.alerts.list, refetchInterval: REFRESH_MS })
export const useShelters = () => useQuery({ queryKey: ['shelters'], queryFn: services.shelters.list, staleTime: Infinity })
export const useRescue = () => useQuery({ queryKey: ['rescue'], queryFn: services.rescue.list, refetchInterval: REFRESH_MS })
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
  return useMutation({ mutationFn: (v: { id: string; active: boolean }) => services.users.setActive(v.id, v.active), onSuccess: () => inv('users', 'audit') })
}
