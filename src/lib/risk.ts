import type { Risk, RiskBand, RescueType, Severity } from '@/domain/types'

interface Urgent {
  risk: Risk
  distanceKm: number | null
}
/** Mais urgente primeiro: maior pontuação e, em empate, a mais perto. Sem distância vai para o fim do empate. */
export function byUrgency(a: Urgent, b: Urgent): number {
  if (a.risk.score !== b.risk.score) return b.risk.score - a.risk.score
  const da = a.distanceKm ?? Number.POSITIVE_INFINITY
  const db = b.distanceKm ?? Number.POSITIVE_INFINITY
  return da === db ? 0 : da < db ? -1 : 1
}

/** Cortes das faixas, iguais aos da API (módulo de Socorro): CRITICO >= 80, ALTO >= 55, MEDIO >= 30. */
export function riskBand(score: number): RiskBand {
  if (score >= 80) return 'CRITICO'
  if (score >= 55) return 'ALTO'
  if (score >= 30) return 'MEDIO'
  return 'BAIXO'
}

export function makeRisk(score: number): Risk {
  const s = Number.isFinite(score) ? Math.min(100, Math.max(0, Math.round(score))) : 0
  return { score: s, band: riskBand(s) }
}

const BASE: Record<RescueType, number> = { FERIDO: 50, ILHADO: 48, DESABAMENTO: 52, EVACUACAO: 25, OUTROS: 15 }
const SEV_BONUS: Record<Severity, number> = { OBSERVACAO: 0, ATENCAO: 5, ALERTA: 12, ALERTA_MAXIMO: 20 }

/**
 * Cálculo de exemplo do Nível de Risco, só para o painel simulado.
 * Em modo HTTP o valor vem pronto da API (`nrScore`).
 */
export function riskLevel(type: RescueType, inAlertArea: boolean, severity: Severity | null, sos: boolean): Risk {
  if (sos) return makeRisk(95)
  let n = BASE[type]
  if (inAlertArea) n += 15
  if (severity) n += SEV_BONUS[severity]
  return makeRisk(n)
}
