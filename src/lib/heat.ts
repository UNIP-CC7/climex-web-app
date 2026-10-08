import type { RescueRequest } from '@/domain/types'

export interface HeatCell {
  lat: number
  lng: number
  /** quantas solicitações em aberto caem na célula */
  count: number
  /** soma do NR (0 a 100) das solicitações da célula */
  score: number
  /** 0 a 1: a célula mais quente do mapa vale 1 */
  intensity: number
}

/** Lado da célula, em graus (~550 m). Funciona sem depender de bairro, que a API não informa. */
export const HEAT_CELL_DEG = 0.005

const validCoord = (lat: number, lng: number) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180

/**
 * Agrupa as solicitações em aberto numa grade e pesa cada uma pelo NR, para as áreas críticas esquentarem mais
 * que as de muitas ocorrências leves. Fora de aberto (concluídas, canceladas) não entra.
 */
export function heatCells(items: RescueRequest[], cell = HEAT_CELL_DEG): HeatCell[] {
  const grid = new Map<string, { count: number; score: number }>()
  for (const r of items) {
    if (r.status !== 'ABERTA' && r.status !== 'EM_ATENDIMENTO') continue
    if (!validCoord(r.lat, r.lng) || !Number.isFinite(r.risk.score)) continue
    const score = Math.min(100, Math.max(0, r.risk.score))
    const key = `${Math.floor(r.lat / cell)}:${Math.floor(r.lng / cell)}`
    const cur = grid.get(key) ?? { count: 0, score: 0 }
    grid.set(key, { count: cur.count + 1, score: cur.score + score })
  }
  let max = 0 // laço em vez de Math.max(...): não estoura o limite de argumentos com muitas células
  for (const c of grid.values()) if (c.score > max) max = c.score
  return Array.from(grid, ([key, c]) => {
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
