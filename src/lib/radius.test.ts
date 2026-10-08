import { describe, expect, it } from 'vitest'
import { RADIUS_MAX_KM, RADIUS_MIN_KM, formatRadius, formatRadiusInput, kmToSlider, parseRadiusKm, sliderToKm } from './radius'

describe('radius', () => {
  it('os extremos do controle são 500 m e 50 km', () => {
    expect(sliderToKm(0)).toBe(RADIUS_MIN_KM)
    expect(sliderToKm(1)).toBe(RADIUS_MAX_KM)
    expect(kmToSlider(RADIUS_MIN_KM)).toBe(0)
    expect(kmToSlider(RADIUS_MAX_KM)).toBe(1)
  })

  it('valores fora do controle ou inválidos ficam dentro dos limites', () => {
    expect(sliderToKm(-3)).toBe(RADIUS_MIN_KM)
    expect(sliderToKm(7)).toBe(RADIUS_MAX_KM)
    expect(sliderToKm(Number.NaN)).toBe(RADIUS_MIN_KM)
    expect(kmToSlider(0)).toBe(0)
    expect(kmToSlider(500)).toBe(1)
    expect(kmToSlider(Number.NaN)).toBe(0)
  })

  it('é crescente e a escala é logarítmica (o meio do controle fica em 5 km)', () => {
    expect(sliderToKm(0.5)).toBe(5)
    let anterior = 0
    for (let t = 0; t <= 1; t += 0.05) {
      const km = sliderToKm(t)
      expect(km).toBeGreaterThanOrEqual(anterior)
      anterior = km
    }
  })

  it('ida e volta mantém o valor próximo', () => {
    for (const km of [0.5, 1.2, 3, 10, 25, 50]) {
      expect(Math.abs(sliderToKm(kmToSlider(km)) - km)).toBeLessThanOrEqual(km < 5 ? 0.06 : 0.6)
    }
  })

  it('formata em metros abaixo de 1 km e em km com vírgula', () => {
    expect(formatRadius(0.5)).toBe('500 m')
    expect(formatRadius(0.9)).toBe('900 m')
    expect(formatRadius(1.2)).toBe('1,2 km')
    expect(formatRadius(1)).toBe('1 km')
    expect(formatRadius(12)).toBe('12 km')
    expect(formatRadius(50)).toBe('50 km')
  })

  it('parseRadiusKm aceita vírgula e ponto, limita aos extremos e recusa lixo', () => {
    expect(parseRadiusKm('2,5')).toBe(2.5)
    expect(parseRadiusKm(' 2.5 ')).toBe(2.5)
    expect(parseRadiusKm('0,1')).toBe(RADIUS_MIN_KM)
    expect(parseRadiusKm('900')).toBe(RADIUS_MAX_KM)
    expect(parseRadiusKm('')).toBeNull()
    expect(parseRadiusKm('abc')).toBeNull()
    expect(parseRadiusKm('Infinity')).toBeNull()
  })

  it('formatRadiusInput mostra o raio como se digita', () => {
    expect(formatRadiusInput(0.5)).toBe('0,5')
    expect(formatRadiusInput(1.25)).toBe('1,3')
    expect(formatRadiusInput(12)).toBe('12')
  })
})
