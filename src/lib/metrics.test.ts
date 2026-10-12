import { describe, expect, it } from 'vitest'
import type { RescueRequest } from '@/domain/types'
import { averageAttendanceMinutes, averageOpenAgeMinutes } from './metrics'

const NOW = new Date('2026-10-08T12:00:00Z').getTime()
const at = (minutesBefore: number) => new Date(NOW - minutesBefore * 60000).toISOString()

const base: RescueRequest = {
  id: 'r',
  type: 'EVACUACAO',
  status: 'ABERTA',
  risk: { score: 50, band: 'ALTO' },
  sos: false,
  lat: 0,
  lng: 0,
  address: '',
  neighborhood: '',
  inAlertArea: false,
  people: 1,
  requesterName: null,
  distanceKm: null,
  openedAt: at(10),
  resolvedAt: null,
  assignedTo: null,
  outcome: null,
}
const req = (p: Partial<RescueRequest>): RescueRequest => ({ ...base, ...p })

describe('averageOpenAgeMinutes', () => {
  it('só conta as em aberto (abertas e em atendimento)', () => {
    const list = [
      req({ openedAt: at(10) }),
      req({ status: 'EM_ATENDIMENTO', openedAt: at(30) }),
      req({ status: 'CONCLUIDA', openedAt: at(500) }),
      req({ status: 'CANCELADA', openedAt: at(500) }),
    ]
    expect(averageOpenAgeMinutes(list, NOW)).toBe(20)
  })

  it('sem solicitações em aberto, devolve null (não zero)', () => {
    expect(averageOpenAgeMinutes([], NOW)).toBeNull()
    expect(averageOpenAgeMinutes([req({ status: 'CONCLUIDA' })], NOW)).toBeNull()
  })
})

describe('averageAttendanceMinutes', () => {
  it('média da abertura até a conclusão, só das concluídas com resolvedAt', () => {
    const list = [
      req({ status: 'CONCLUIDA', openedAt: at(60), resolvedAt: at(30) }),
      req({ status: 'CONCLUIDA', openedAt: at(100), resolvedAt: at(40) }),
      req({ status: 'CONCLUIDA', openedAt: at(100), resolvedAt: null }),
      req({ status: 'ABERTA', openedAt: at(100), resolvedAt: at(1) }),
    ]
    expect(averageAttendanceMinutes(list)).toBe(45)
  })

  it('sem nenhuma data de conclusão (API de hoje), devolve null', () => {
    expect(averageAttendanceMinutes([req({ status: 'CONCLUIDA' })])).toBeNull()
  })

  it('data de conclusão anterior à abertura não vira tempo negativo', () => {
    const list = [req({ status: 'CONCLUIDA', openedAt: at(10), resolvedAt: at(20) })]
    expect(averageAttendanceMinutes(list)).toBe(0)
  })

  it('ignora datas inválidas em vez de devolver NaN', () => {
    const list = [
      req({ status: 'CONCLUIDA', openedAt: at(60), resolvedAt: at(30) }),
      req({ status: 'CONCLUIDA', openedAt: at(60), resolvedAt: '' }),
      req({ status: 'CONCLUIDA', openedAt: 'ontem', resolvedAt: at(30) }),
    ]
    expect(averageAttendanceMinutes(list)).toBe(30)
  })
})

describe('averageOpenAgeMinutes: relógio adiantado', () => {
  it('abertura no futuro não dá idade negativa', () => {
    expect(averageOpenAgeMinutes([req({ openedAt: at(-5) })], NOW)).toBe(0)
  })
})
