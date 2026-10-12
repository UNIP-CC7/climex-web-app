import { describe, expect, it } from 'vitest'
import { occupancyText } from './shelterLabel'

describe('occupancyText', () => {
  it('não chama de simulada a ocupação que veio da API', () => {
    expect(occupancyText({ occupancy: 12, capacity: 80, simulated: false })).toBe('Ocupação: 12 / 80')
  })

  it('mantém o aviso quando o dado é simulado', () => {
    expect(occupancyText({ occupancy: 8, capacity: 80, simulated: true })).toBe('Ocupação simulada: 8 / 80')
  })
})
