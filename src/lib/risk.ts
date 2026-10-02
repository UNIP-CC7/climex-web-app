import type { RescueType, RiskLevel, Severity } from '@/domain/types'

const BASE: Record<RescueType, number> = { FERIDO: 3, ILHADO: 3, DESABAMENTO: 3, EVACUACAO: 2 }
const SEV_BONUS: Record<Severity, number> = { OBSERVACAO: 0, ATENCAO: 0, ALERTA: 1, ALERTA_MAXIMO: 1 }

/**
 * Cálculo de exemplo do Nível de Risco, só para o painel simulado.
 * A regra real fica na API (módulo de Socorro) e deve substituir esta função.
 */
export function riskLevel(type: RescueType, inAlertArea: boolean, severity: Severity | null, sos: boolean): RiskLevel {
  if (sos) return 5
  let n = BASE[type]
  if (inAlertArea) n += 1
  if (severity) n += SEV_BONUS[severity]
  return Math.min(5, Math.max(1, n)) as RiskLevel
}
