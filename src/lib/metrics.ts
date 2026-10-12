import type { RescueRequest } from '@/domain/types'
import { minutesAgo } from './format'

const isClosed = (r: RescueRequest) => r.status === 'CONCLUIDA' || r.status === 'CANCELADA'

/** Idade média, em minutos, das solicitações ainda em aberto (abertas ou em atendimento). null se não há nenhuma. */
export function averageOpenAgeMinutes(list: RescueRequest[], now = Date.now()): number | null {
  const open = list.filter((r) => !isClosed(r))
  if (!open.length) return null
  return Math.round(open.reduce((n, r) => n + minutesAgo(r.openedAt, now), 0) / open.length)
}

/**
 * Tempo médio de atendimento, em minutos: da abertura até a conclusão, só das solicitações concluídas que informam quando foram resolvidas.
 * null enquanto a API não entregar `resolvedAt` (hoje o modo HTTP não tem esse dado).
 */
export function averageAttendanceMinutes(list: RescueRequest[]): number | null {
  const times = list
    .filter((r) => r.status === 'CONCLUIDA' && r.resolvedAt != null)
    .map((r) => (new Date(r.resolvedAt as string).getTime() - new Date(r.openedAt).getTime()) / 60000)
    .filter(Number.isFinite) // data malformada não contamina a média
    .map((t) => Math.max(0, t))
  if (!times.length) return null
  return Math.round(times.reduce((n, t) => n + t, 0) / times.length)
}
