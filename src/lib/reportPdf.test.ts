import { describe, expect, it } from 'vitest'
import type { RescueRequest } from '@/domain/types'
import { buildReportPdf, PDF_MAX_ROWS, pdfText, reportFileName, type ReportData } from './reportPdf'

const req = (id: string): RescueRequest => ({
  id,
  type: 'EVACUACAO',
  status: 'ABERTA',
  risk: { score: 80, band: 'CRITICO' },
  sos: false,
  lat: -23.4,
  lng: -46.8,
  address: 'Rua das Acácias, 45',
  neighborhood: 'Fazendinha',
  inAlertArea: true,
  people: 3,
  requesterName: null,
  distanceKm: null,
  openedAt: '2026-10-08T12:00:00Z',
  resolvedAt: null,
  assignedTo: null,
  outcome: null,
})

const data = (over: Partial<ReportData> = {}): ReportData => ({
  generatedAt: new Date('2026-10-08T15:00:00Z'),
  periodLabel: 'Últimas 24 horas',
  total: 2,
  requests: [req('a'), req('b')],
  concluded: 0,
  openAgeMinutes: 12,
  attendanceMinutes: null,
  occupationPercent: 40,
  alertsCount: 2,
  neighborhoods: null,
  simulated: false,
  ...over,
})

const head = async (blob: Blob) => new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 5))

describe('reportFileName', () => {
  it('usa a data local, não a UTC (22h em São Paulo continua no mesmo dia)', () => {
    expect(reportFileName(new Date(2026, 9, 8, 22, 30))).toBe('relatorio-climex-2026-10-08.pdf')
  })
})

describe('pdfText', () => {
  it('troca quebras e controles por espaço e limita o tamanho', () => {
    expect(pdfText('Rua A\n\r\tNúmero\u0000 5')).toBe('Rua A Número 5')
    expect(pdfText('x'.repeat(5000)).length).toBeLessThanOrEqual(160)
  })
})

describe('buildReportPdf', () => {
  it('gera um PDF de verdade', async () => {
    const blob = await buildReportPdf(data())
    expect(blob.type).toBe('application/pdf')
    expect(await head(blob)).toBe('%PDF-')
    expect(blob.size).toBeGreaterThan(1500)
  }, 20000)

  it('com bairros (modo simulado) e sem solicitações também gera', async () => {
    const blob = await buildReportPdf(data({ requests: [], neighborhoods: [['Fazendinha', 3]], simulated: true }))
    expect(await head(blob)).toBe('%PDF-')
  }, 20000)

  it('muitas linhas viram várias páginas', async () => {
    const pequeno = await buildReportPdf(data({ requests: [req('a')] }))
    const grande = await buildReportPdf(data({ requests: Array.from({ length: 400 }, (_, i) => req(String(i))) }))
    expect(grande.size).toBeGreaterThan(pequeno.size * 3)
  }, 30000)

  it('tabela detalhada passa do limite: gera mesmo assim', async () => {
    const lotes = Array.from({ length: PDF_MAX_ROWS + 50 }, (_, i) => req(String(i)))
    expect(await head(await buildReportPdf(data({ requests: lotes })))).toBe('%PDF-')
  }, 60000)
})
