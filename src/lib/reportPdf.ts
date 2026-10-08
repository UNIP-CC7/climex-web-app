import { RESCUE_STATUS_LABEL, RESCUE_TYPE_LABEL, RISK_BAND_LABEL, type RescueRequest, type RescueType } from '@/domain/types'
import { clock } from './format'

export interface ReportData {
  generatedAt: Date
  requests: RescueRequest[]
  concluded: number
  /** minutos; null quando não há dado */
  openAgeMinutes: number | null
  attendanceMinutes: number | null
  /** 0 a 100 */
  occupationPercent: number
  alertsCount: number
  /** só preenchido no modo simulado */
  neighborhoods: [string, number][] | null
  simulated: boolean
}

const minutes = (m: number | null) => (m == null ? '-' : `${m} min`)

/** Limite de linhas na tabela detalhada: acima disso a geração trava a aba. O CSV leva todas. */
export const PDF_MAX_ROWS = 2000
const MAX_TEXT = 160

/** Texto de fora (endereço, bairro) sem quebras nem caracteres de controle e com tamanho limitado. */
export function pdfText(value: string): string {
  const noControls = Array.from(value, (ch) => {
    const code = ch.charCodeAt(0)
    return code < 32 || code === 127 ? ' ' : ch
  }).join('')
  const clean = noControls.replace(/ {2,}/g, ' ').trim()
  return clean.length > MAX_TEXT ? `${clean.slice(0, MAX_TEXT - 1)}…` : clean
}

/** Data local (a mesma que aparece no relatório), não UTC: perto da meia-noite o dia não pula. */
export function reportFileName(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `relatorio-climex-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.pdf`
}

/**
 * Monta o relatório em PDF. A biblioteca é carregada só aqui, quando a pessoa pede o PDF,
 * para não pesar no carregamento do painel.
 */
export async function buildReportPdf(data: ReportData): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const left = 40
  let y = 48

  doc.setFontSize(18)
  doc.text('Climex: relatório de ocorrências', left, y)
  y += 18
  doc.setFontSize(10)
  doc.text(`Gerado em ${data.generatedAt.toLocaleString('pt-BR')}`, left, y)
  if (data.simulated) {
    y += 14
    doc.text('Dados simulados. Não use como relatório oficial.', left, y)
  }
  y += 16

  autoTable(doc, {
    startY: y,
    head: [['Indicador', 'Valor']],
    body: [
      ['Solicitações no período', String(data.requests.length)],
      ['Concluídas', String(data.concluded)],
      ['Idade média das solicitações em aberto', minutes(data.openAgeMinutes)],
      ['Tempo médio de atendimento', minutes(data.attendanceMinutes)],
      ['Ocupação dos abrigos ativos', `${data.occupationPercent}%`],
      ['Alertas emitidos', String(data.alertsCount)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [31, 58, 95] },
    margin: { left },
  })

  const perType = new Map<RescueType, number>()
  for (const r of data.requests) perType.set(r.type, (perType.get(r.type) ?? 0) + 1)
  const types = (Object.keys(RESCUE_TYPE_LABEL) as RescueType[]).map((t) => [RESCUE_TYPE_LABEL[t], String(perType.get(t) ?? 0)])
  autoTable(doc, {
    head: [['Tipo', 'Solicitações']],
    body: types,
    theme: 'grid',
    headStyles: { fillColor: [31, 58, 95] },
    margin: { left },
  })

  if (data.neighborhoods) {
    autoTable(doc, {
      head: [['Bairro', 'Solicitações']],
      body: data.neighborhoods.slice(0, 200).map(([n, c]) => [pdfText(n), String(c)]),
      theme: 'grid',
      headStyles: { fillColor: [31, 58, 95] },
      margin: { left },
    })
  }

  const rows = data.requests.slice(0, PDF_MAX_ROWS)
  if (rows.length < data.requests.length) {
    const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    doc.setFontSize(9)
    doc.text(`A tabela abaixo mostra ${rows.length} das ${data.requests.length} solicitações. O CSV tem todas.`, left, (last?.finalY ?? 100) + 16)
  }
  autoTable(doc, {
    head: [['Tipo', 'NR', 'Faixa', 'Situação', 'Endereço', 'Pessoas', 'Aberta às']],
    body: rows.map((r) => [
      RESCUE_TYPE_LABEL[r.type],
      String(r.risk.score),
      RISK_BAND_LABEL[r.risk.band],
      RESCUE_STATUS_LABEL[r.status],
      pdfText(r.address),
      String(r.people),
      clock(r.openedAt),
    ]),
    theme: 'striped',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [31, 58, 95] },
    margin: { left },
  })

  return doc.output('blob')
}
