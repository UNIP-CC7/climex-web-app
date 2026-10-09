import type { Report } from '@/domain/types'
import { toCsv } from './format'

/** O relatório consolidado em CSV, no mesmo desenho (Seção, Indicador, Valor) do CSV da API. */
export function reportToCsv(r: Report): string {
  const rows: (string | number | null)[][] = [
    ['Período', 'Início', r.from],
    ['Período', 'Fim', r.to],
    ['Socorro', 'Total de solicitações', r.rescue.total],
    ['Socorro', 'SOS', r.rescue.sos],
    ['Socorro', 'Resolvidas', r.rescue.resolved],
    ['Socorro', 'Canceladas', r.rescue.cancelled],
    ['Socorro', 'Tempo médio de resolução (min)', r.rescue.avgResolutionMinutes],
    ...Object.entries(r.rescue.byStatus).map(([k, v]): (string | number)[] => ['Socorro/Status', k, v]),
    ...Object.entries(r.rescue.byRisk).map(([k, v]): (string | number)[] => ['Socorro/Risco', k, v]),
    ...Object.entries(r.rescue.byType).map(([k, v]): (string | number)[] => ['Socorro/Tipo', k, v]),
    ['Alertas', 'Total criados', r.alerts.total],
    ...Object.entries(r.alerts.byLevel).map(([k, v]): (string | number)[] => ['Alertas/Nível', k, v]),
    ...r.shelters.map((s): (string | number)[] => ['Abrigos', s.name, `${s.occupancy}/${s.capacity} (${s.rate}%)`]),
  ]
  return toCsv(rows.map(([section, indicator, value]) => ({ Seção: section ?? '', Indicador: indicator ?? '', Valor: value ?? '' })))
}
