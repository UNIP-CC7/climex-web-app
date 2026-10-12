import { describe, expect, it } from 'vitest'
import type { Alert, RescueRequest, Severity } from '@/domain/types'
import { HEAT_CELL_DEG, MAX_HEAT_CELLS, alertHeatCells, heatCells, heatCellsFromPoints } from './heat'

const req = (lat: number, lng: number, score: number, status: RescueRequest['status'] = 'ABERTA'): RescueRequest => ({
  id: `${lat}${lng}${score}${status}`,
  type: 'EVACUACAO',
  status,
  risk: { score, band: 'ALTO' },
  sos: false,
  lat,
  lng,
  address: '',
  neighborhood: '',
  inAlertArea: false,
  people: 1,
  requesterName: null,
  distanceKm: null,
  openedAt: '2026-10-08T12:00:00Z',
  resolvedAt: null,
  assignedTo: null,
  outcome: null,
})

describe('heatCells', () => {
  it('sem solicitações, nenhuma célula', () => {
    expect(heatCells([])).toEqual([])
  })

  it('junta as do mesmo quadrado e soma contagem e NR', () => {
    const cells = heatCells([req(-23.4281, -46.8901, 40), req(-23.4282, -46.8902, 60)])
    expect(cells).toHaveLength(1)
    expect(cells[0]).toMatchObject({ count: 2, score: 100, intensity: 1 })
  })

  it('o centro da célula fica dentro do quadrado do ponto', () => {
    const lat = -23.4281
    const lng = -46.8901
    const [c] = heatCells([req(lat, lng, 50)])
    expect(Math.abs(c!.lat - lat)).toBeLessThanOrEqual(HEAT_CELL_DEG / 2 + 1e-9)
    expect(Math.abs(c!.lng - lng)).toBeLessThanOrEqual(HEAT_CELL_DEG / 2 + 1e-9)
  })

  it('pontos distantes viram células separadas e a mais crítica vale 1', () => {
    const cells = heatCells([req(-23.4, -46.8, 90), req(-23.5, -46.9, 30)])
    expect(cells).toHaveLength(2)
    const sorted = [...cells].sort((a, b) => b.intensity - a.intensity)
    expect(sorted[0]!.intensity).toBe(1)
    expect(sorted[1]!.intensity).toBeCloseTo(1 / 3)
  })

  it('várias leves não passam uma crítica quando o NR somado é menor', () => {
    const cells = heatCells([req(-23.4, -46.8, 95), req(-23.5, -46.9, 10), req(-23.5, -46.9, 10)])
    const critica = cells.find((c) => c.count === 1)!
    expect(critica.intensity).toBe(1)
  })

  it('concluídas, canceladas e coordenadas inválidas não esquentam o mapa', () => {
    const cells = heatCells([req(-23.4, -46.8, 90, 'CONCLUIDA'), req(-23.4, -46.8, 90, 'CANCELADA'), req(Number.NaN, -46.8, 90)])
    expect(cells).toEqual([])
  })

  it('em atendimento ainda conta', () => {
    expect(heatCells([req(-23.4, -46.8, 50, 'EM_ATENDIMENTO')])).toHaveLength(1)
  })

  it('NR inválido não contamina a escala das outras células', () => {
    const cells = heatCells([req(-23.4, -46.8, 50), req(-23.5, -46.9, Number.NaN), req(-23.6, -46.7, Number.POSITIVE_INFINITY)])
    expect(cells).toHaveLength(1)
    expect(cells[0]!.intensity).toBe(1)
  })

  it('NR fora de 0 a 100 é limitado', () => {
    const [c] = heatCells([req(-23.4, -46.8, 500)])
    expect(c!.score).toBe(100)
  })

  it('coordenada fora do globo é descartada e a célula do polo não passa de 90 graus', () => {
    expect(heatCells([req(120, -46.8, 50), req(-23.4, 400, 50)])).toEqual([])
    const [c] = heatCells([req(90, 180, 50)])
    expect(c!.lat).toBeLessThanOrEqual(90)
    expect(c!.lng).toBeLessThanOrEqual(180)
  })

  it('aguenta muitos pontos dispersos sem estourar', () => {
    const many = Array.from({ length: 150000 }, (_, i) => req(-80 + (i % 300) * 0.5, -170 + Math.floor(i / 300) * 0.6, 10))
    expect(heatCells(many)).toHaveLength(MAX_HEAT_CELLS) // passou do teto: só as mais quentes
  })
})

const alerta = (id: string, severity: Severity, polygons: [number, number][][], active = true): Alert => ({
  id,
  title: id,
  severity,
  city: 'X',
  neighborhood: 'Y',
  polygons,
  issuedAt: '2026-10-08T12:00:00Z',
  expiresAt: null,
  active,
  source: 'MANUAL',
})
const quadrado = (lat: number, lng: number): [number, number][] => [
  [lat, lng],
  [lat + 0.001, lng],
  [lat + 0.001, lng + 0.001],
  [lat, lng + 0.001],
]

describe('alertHeatCells', () => {
  it('sem alertas, nada', () => {
    expect(alertHeatCells([])).toEqual([])
  })

  it('alerta máximo esquenta mais que observação, em lugares diferentes', () => {
    const cells = alertHeatCells([alerta('a', 'ALERTA_MAXIMO', [quadrado(-23.4, -46.8)]), alerta('b', 'OBSERVACAO', [quadrado(-23.6, -46.6)])])
    expect(cells).toHaveLength(2)
    const sorted = [...cells].sort((x, y) => y.intensity - x.intensity)
    expect(sorted[0]!.intensity).toBe(1)
    expect(sorted[1]!.intensity).toBeCloseTo(0.25)
  })

  it('várias áreas no mesmo lugar somam', () => {
    const cells = alertHeatCells([alerta('a', 'ALERTA', [quadrado(-23.4001, -46.8001)]), alerta('b', 'ALERTA', [quadrado(-23.4002, -46.8002)])])
    expect(cells).toHaveLength(1)
    expect(cells[0]).toMatchObject({ count: 2, score: 150 })
  })

  it('um alerta com duas áreas separadas conta duas vezes', () => {
    const cells = alertHeatCells([alerta('a', 'ATENCAO', [quadrado(-23.4, -46.8), quadrado(-23.7, -46.5)])])
    expect(cells).toHaveLength(2)
  })

  it('encerrados e sem área não entram', () => {
    expect(alertHeatCells([alerta('a', 'ALERTA', [quadrado(-23.4, -46.8)], false), alerta('b', 'ALERTA', []), alerta('c', 'ALERTA', [[]])])).toEqual(
      [],
    )
  })
})

describe('heatCellsFromPoints', () => {
  it('ignora peso inválido e limita o peso a 0 a 100', () => {
    const cells = heatCellsFromPoints([
      { lat: -23.4, lng: -46.8, weight: Number.NaN },
      { lat: -23.5, lng: -46.7, weight: 900 },
    ])
    expect(cells).toHaveLength(1)
    expect(cells[0]!.score).toBe(100)
  })
})

describe('limite de células', () => {
  it('passando do teto, ficam as mais quentes e a escala continua certa', () => {
    const points = Array.from({ length: MAX_HEAT_CELLS + 500 }, (_, i) => ({
      lat: -80 + (i % 300) * 0.5,
      lng: -170 + Math.floor(i / 300) * 0.6,
      weight: i === 7 ? 100 : 10,
    }))
    const cells = heatCellsFromPoints(points)
    expect(cells).toHaveLength(MAX_HEAT_CELLS)
    expect(Math.max(...cells.map((c) => c.intensity))).toBe(1)
    expect(cells.some((c) => c.score === 100)).toBe(true)
  })
})
