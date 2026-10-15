import type { Shelter } from '@/domain/types'

/** Texto de ocupação do abrigo. Só diz "simulada" quando o dado é mesmo simulado (modo sem API). */
export const occupancyText = (s: Pick<Shelter, 'occupancy' | 'capacity' | 'simulated'>): string =>
  `${s.simulated ? 'Ocupação simulada' : 'Ocupação'}: ${s.occupancy} / ${s.capacity}`
