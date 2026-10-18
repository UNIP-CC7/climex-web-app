import type { LatLng } from '@/domain/types'

export const MIN_VERTICES = 3

export function centroid(points: readonly LatLng[]): LatLng {
  if (points.length === 0) return [0, 0]
  const sum = points.reduce<LatLng>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
  return [sum[0] / points.length, sum[1] / points.length]
}

function cross(o: LatLng, a: LatLng, b: LatLng) {
  return (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1])
}

function crosses(p: LatLng, q: LatLng, r: LatLng, s: LatLng) {
  const d1 = cross(p, q, r)
  const d2 = cross(p, q, s)
  const d3 = cross(r, s, p)
  const d4 = cross(r, s, q)
  return d1 * d2 < 0 && d3 * d4 < 0
}

export function selfIntersects(points: readonly LatLng[]): boolean {
  const n = points.length
  if (n < 4) return false
  for (let i = 0; i < n; i++) {
    const a = points[i]!
    const b = points[(i + 1) % n]!
    for (let j = i + 1; j < n; j++) {
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue
      if (crosses(a, b, points[j]!, points[(j + 1) % n]!)) return true
    }
  }
  return false
}

export interface GeoJsonPolygon {
  type: 'Polygon'
  coordinates: [number, number][][]
}

export function toGeoJsonPolygon(points: readonly LatLng[]): GeoJsonPolygon {
  const ring = points.map((p): [number, number] => [p[1], p[0]])
  const first = ring[0]
  if (first) ring.push([first[0], first[1]])
  return { type: 'Polygon', coordinates: [ring] }
}
