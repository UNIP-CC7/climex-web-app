import { describe, expect, it } from 'vitest'
import { bboxKey, snapBbox, toBboxParam } from './bbox'

const area = { minLng: -47.0, minLat: -23.5, maxLng: -46.8, maxLat: -23.3 }

describe('toBboxParam', () => {
  it('escreve oeste, sul, leste e norte, como a API espera', () => {
    expect(toBboxParam(area)).toBe('-47.0000,-23.5000,-46.8000,-23.3000')
    expect(toBboxParam(area)).toMatch(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/)
  })
})

describe('snapBbox', () => {
  it('alarga a área e nunca fica menor que a original', () => {
    const s = snapBbox({ minLng: -46.983, minLat: -23.471, maxLng: -46.871, maxLat: -23.389 })
    expect(s.minLng).toBeLessThan(-46.983)
    expect(s.minLat).toBeLessThan(-23.471)
    expect(s.maxLng).toBeGreaterThan(-46.871)
    expect(s.maxLat).toBeGreaterThan(-23.389)
  })

  it('um arrasto pequeno cai na mesma caixa, então não pede de novo', () => {
    const a = snapBbox({ minLng: -46.983, minLat: -23.471, maxLng: -46.871, maxLat: -23.389 })
    const b = snapBbox({ minLng: -46.981, minLat: -23.469, maxLng: -46.869, maxLat: -23.387 })
    expect(bboxKey(b)).toBe(bboxKey(a))
  })

  it('um arrasto grande muda a caixa', () => {
    const a = snapBbox(area)
    const b = snapBbox({ minLng: -46.5, minLat: -23.5, maxLng: -46.3, maxLat: -23.3 })
    expect(bboxKey(b)).not.toBe(bboxKey(a))
  })

  it('não passa dos limites do globo', () => {
    const s = snapBbox({ minLng: -179.9, minLat: -89.9, maxLng: 179.9, maxLat: 89.9 })
    expect([s.minLng, s.maxLng].every((n) => Math.abs(n) <= 180)).toBe(true)
    expect([s.minLat, s.maxLat].every((n) => Math.abs(n) <= 90)).toBe(true)
  })
})

describe('bboxKey', () => {
  it('sem área tem chave própria', () => {
    expect(bboxKey(null)).toBe('sem-area')
  })
})
