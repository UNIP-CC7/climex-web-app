import { describe, expect, it } from 'vitest'
import type { LatLng } from '@/domain/types'
import { centroid, selfIntersects, toGeoJsonPolygon } from './polygon'

const square: LatLng[] = [
  [0, 0],
  [0, 2],
  [2, 2],
  [2, 0],
]

describe('polygon', () => {
  it('centro de um quadrado', () => {
    expect(centroid(square)).toEqual([1, 1])
  })

  it('quadrado não se cruza; "8" se cruza', () => {
    expect(selfIntersects(square)).toBe(false)
    expect(
      selfIntersects([
        [0, 0],
        [2, 2],
        [0, 2],
        [2, 0],
      ]),
    ).toBe(true)
  })

  it('triângulo nunca se cruza', () => {
    expect(
      selfIntersects([
        [0, 0],
        [0, 1],
        [1, 0],
      ]),
    ).toBe(false)
  })

  it('GeoJSON sai em [lng, lat] e com o anel fechado', () => {
    const g = toGeoJsonPolygon([
      [-23.5, -46.9],
      [-23.5, -46.8],
      [-23.4, -46.8],
    ])
    expect(g.coordinates[0]).toEqual([
      [-46.9, -23.5],
      [-46.8, -23.5],
      [-46.8, -23.4],
      [-46.9, -23.5],
    ])
  })
})
