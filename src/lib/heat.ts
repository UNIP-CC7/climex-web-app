import type { Alert, RescueRequest, Severity } from '@/domain/types'

export interface HeatCell {
  lat: number
  lng: number
  /** quantos pontos (solicitações ou alertas) caem na célula */
  count: number
  /** soma dos pesos (0 a 100 cada) dos pontos da célula */
  score: number
  /** 0 a 1: a célula mais quente do mapa vale 1 */
  intensity: number
}

/** Lado da célula, em graus (~550 m). Funciona sem depender de bairro, que a API não informa. */
export const HEAT_CELL_DEG = 0.005

/** Teto de células desenhadas: cada uma vira um círculo no mapa. Passando disso ficam as mais quentes. */
export const MAX_HEAT_CELLS = 1500

const validCoord = (lat: number, lng: number) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180

export interface HeatPoint {
  lat: number
  lng: number
  /** 0 a 100; fora disso é limitado, inválido é ignorado */
  weight: number
}

/** Agrupa pontos numa grade e soma o peso de cada um por célula. */
export function heatCellsFromPoints(points: HeatPoint[], cell = HEAT_CELL_DEG): HeatCell[] {
  const grid = new Map<string, { count: number; score: number }>()
  for (const p of points) {
    if (!validCoord(p.lat, p.lng) || !Number.isFinite(p.weight)) continue
    const score = Math.min(100, Math.max(0, p.weight))
    const key = `${Math.floor(p.lat / cell)}:${Math.floor(p.lng / cell)}`
    const cur = grid.get(key) ?? { count: 0, score: 0 }
    grid.set(key, { count: cur.count + 1, score: cur.score + score })
  }
  let max = 0 // laço em vez de Math.max(...): não estoura o limite de argumentos com muitas células
  for (const c of grid.values()) if (c.score > max) max = c.score
  const entries = Array.from(grid)
  if (entries.length > MAX_HEAT_CELLS) entries.sort((a, b) => b[1].score - a[1].score).length = MAX_HEAT_CELLS
  return entries.map(([key, c]) => {
    const [i, j] = key.split(':').map(Number) as [number, number]
    return {
      lat: Math.min(90, Math.max(-90, (i + 0.5) * cell)),
      lng: Math.min(180, Math.max(-180, (j + 0.5) * cell)),
      count: c.count,
      score: c.score,
      intensity: max > 0 ? c.score / max : 0,
    }
  })
}

/**
 * Agrupa as solicitações em aberto numa grade e pesa cada uma pelo NR, para as áreas críticas esquentarem mais
 * que as de muitas ocorrências leves. Fora de aberto (concluídas, canceladas) não entra.
 */
export function heatCells(items: RescueRequest[], cell = HEAT_CELL_DEG): HeatCell[] {
  return heatCellsFromPoints(
    items.filter((r) => r.status === 'ABERTA' || r.status === 'EM_ATENDIMENTO').map((r) => ({ lat: r.lat, lng: r.lng, weight: r.risk.score })),
    cell,
  )
}

const SEVERITY_WEIGHT: Record<Severity, number> = { OBSERVACAO: 25, ATENCAO: 50, ALERTA: 75, ALERTA_MAXIMO: 100 }

/** Centro de um anel: média dos vértices (basta para saber em que célula o alerta cai). */
function ringCenter(ring: [number, number][]): [number, number] | null {
  if (!ring.length) return null
  let lat = 0
  let lng = 0
  for (const [a, b] of ring) {
    lat += a
    lng += b
  }
  return [lat / ring.length, lng / ring.length]
}

/**
 * Densidade dos alertas ativos: cada área (anel) conta como um ponto pesado pela gravidade, então várias áreas
 * no mesmo lugar, ou uma de Alerta Máximo, esquentam mais que uma de Observação.
 */
export function alertHeatCells(alerts: Alert[], cell = HEAT_CELL_DEG): HeatCell[] {
  const points: HeatPoint[] = []
  for (const a of alerts) {
    if (!a.active) continue
    for (const ring of a.polygons) {
      const c = ringCenter(ring)
      if (c) points.push({ lat: c[0], lng: c[1], weight: SEVERITY_WEIGHT[a.severity] })
    }
  }
  return heatCellsFromPoints(points, cell)
}
