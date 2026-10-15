import type { Bbox } from '@/domain/types'

/** No formato da API: `minLng,minLat,maxLng,maxLat`. */
export const toBboxParam = (b: Bbox): string => [b.minLng, b.minLat, b.maxLng, b.maxLat].map((n) => n.toFixed(4)).join(',')

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * Alarga a área visível e arredonda para uma grade. A folga mostra um pouco além da borda da tela, e a grade faz com que
 * mexer pouco no mapa dê a mesma caixa, então não gera um pedido novo à API a cada arrasto.
 */
export function snapBbox(b: Bbox, pad = 0.25, step = 0.02): Bbox {
  const dLng = (b.maxLng - b.minLng) * pad
  const dLat = (b.maxLat - b.minLat) * pad
  const down = (n: number) => Math.floor(n / step + 1e-9) * step
  const up = (n: number) => Math.ceil(n / step - 1e-9) * step
  return {
    minLng: clamp(down(b.minLng - dLng), -180, 180),
    minLat: clamp(down(b.minLat - dLat), -90, 90),
    maxLng: clamp(up(b.maxLng + dLng), -180, 180),
    maxLat: clamp(up(b.maxLat + dLat), -90, 90),
  }
}

/** Chave estável da caixa, para a chave de cache da consulta. */
export const bboxKey = (b: Bbox | null): string => (b ? toBboxParam(b) : 'sem-area')
