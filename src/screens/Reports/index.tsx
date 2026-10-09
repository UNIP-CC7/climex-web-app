import { useRef, useState } from 'react'
import { DownloadSimple, FilePdf } from '@phosphor-icons/react'
import { Btn, Empty, ErrorMsg, Grid, Note, Page, Panel, PanelHead, Skeleton, Table, TableWrap } from '@/components/ui'
import { RESCUE_TYPE_LABEL, RISK_BAND_LABEL, type RescueType } from '@/domain/types'
import { fmt, toCsv } from '@/lib/format'
import { averageOpenAgeMinutes } from '@/lib/metrics'
import { buildReportPdf, reportFileName } from '@/lib/reportPdf'
import { useRescue, useReport } from '@/lib/queries'
import { services, useMocks } from '@/services'
import { Kpi, Kpis } from './styles'

/** Períodos do relatório pós-evento. A API pede a janela em horas (24 é o padrão dela). */
const PERIODS = [
  { hours: 24, label: 'Últimas 24 horas' },
  { hours: 168, label: 'Últimos 7 dias' },
  { hours: 720, label: 'Últimos 30 dias' },
] as const

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsScreen() {
  const [hours, setHours] = useState<number>(PERIODS[0].hours)
  const report = useReport(hours)
  const rescue = useRescue()
  const [pdfState, setPdfState] = useState<'idle' | 'busy' | 'error'>('idle')
  const [csvState, setCsvState] = useState<'idle' | 'busy' | 'error'>('idle')
  const pdfBusy = useRef(false) // trava síncrona: o estado só chega no render seguinte
  const csvBusy = useRef(false)

  if (report.isError || rescue.isError)
    return (
      <Page>
        <ErrorMsg error={report.error ?? rescue.error} />
      </Page>
    )
  if (report.isPending || rescue.isPending)
    return (
      <Page>
        <Panel>
          <Skeleton rows={6} h={40} />
        </Panel>
      </Page>
    )

  const r = report.data.rescue
  const all = rescue.data
  const since = new Date(report.data.from).getTime()
  const until = new Date(report.data.to).getTime()
  const inPeriod = all.filter((x) => {
    const t = new Date(x.openedAt).getTime()
    return t >= since && t <= until
  })
  const openAge = averageOpenAgeMinutes(all)
  const attendance = r.avgResolutionMinutes == null ? null : Math.round(r.avgResolutionMinutes)
  const occ = report.data.shelters.reduce((n, s) => n + s.occupancy, 0)
  const cap = report.data.shelters.reduce((n, s) => n + s.capacity, 0)
  const alertsTotal = report.data.alerts.total
  const occPercent = cap ? Math.round((100 * occ) / cap) : 0
  const periodLabel = PERIODS.find((p) => p.hours === hours)?.label ?? `Últimas ${hours} horas`
  const byType = (Object.keys(RESCUE_TYPE_LABEL) as RescueType[]).map((t) => ({ t, n: r.byType[t] ?? 0 }))
  const byNb = Object.entries(
    inPeriod.reduce<Record<string, number>>((m, x) => ({ ...m, [x.neighborhood || 'Sem bairro']: (m[x.neighborhood || 'Sem bairro'] ?? 0) + 1 }), {}),
  ).sort((x, y) => y[1] - x[1])

  /** Modo HTTP: o CSV consolidado vem da API. Modo simulado: uma linha por solicitação. */
  async function exportCsv() {
    if (useMocks) {
      download(
        'solicitacoes-climex.csv',
        toCsv(
          inPeriod.map((x) => ({
            id: x.id,
            tipo: RESCUE_TYPE_LABEL[x.type],
            nivel_risco: x.risk.score,
            faixa_risco: RISK_BAND_LABEL[x.risk.band],
            sos: x.sos ? 'sim' : 'nao',
            situacao: x.status,
            bairro: x.neighborhood,
            endereco: x.address,
            pessoas: x.people,
            aberta_em: x.openedAt,
            agente: x.assignedTo ?? '',
          })),
        ),
      )
      return
    }
    if (csvBusy.current) return
    csvBusy.current = true
    setCsvState('busy')
    try {
      download('relatorio-climex.csv', await services.dashboard.reportCsv(hours))
      setCsvState('idle')
    } catch {
      setCsvState('error')
    } finally {
      csvBusy.current = false
    }
  }

  async function exportPdf() {
    if (pdfBusy.current) return
    pdfBusy.current = true
    setPdfState('busy')
    try {
      const generatedAt = new Date()
      const blob = await buildReportPdf({
        generatedAt,
        periodLabel,
        total: r.total,
        requests: inPeriod,
        concluded: r.resolved,
        openAgeMinutes: openAge,
        attendanceMinutes: attendance,
        occupationPercent: occPercent,
        alertsCount: alertsTotal,
        neighborhoods: useMocks ? byNb : null,
        simulated: useMocks,
      })
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), { href: url, download: reportFileName(generatedAt) })
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000) // o navegador pode ainda estar lendo o arquivo
      setPdfState('idle')
    } catch {
      setPdfState('error')
    } finally {
      pdfBusy.current = false
    }
  }

  return (
    <Page>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          Período
          <select
            aria-label="Período do relatório"
            value={hours}
            onChange={(e) => {
              setHours(Number(e.target.value))
              setCsvState('idle')
              setPdfState('idle')
            }}
          >
            {PERIODS.map((p) => (
              <option key={p.hours} value={p.hours}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <Btn onClick={exportCsv} disabled={csvState === 'busy'}>
          <DownloadSimple size={18} />
          {csvState === 'busy' ? 'Gerando CSV...' : 'Exportar CSV'}
        </Btn>
        <Btn $ghost onClick={exportPdf} disabled={pdfState === 'busy'}>
          <FilePdf size={18} />
          {pdfState === 'busy' ? 'Gerando PDF...' : 'Exportar PDF'}
        </Btn>
      </div>
      {pdfState === 'error' && <ErrorMsg error={new Error('Não foi possível gerar o PDF. Tente de novo.')} />}
      {csvState === 'error' && <ErrorMsg error={new Error('Não foi possível baixar o CSV. Tente de novo.')} />}
      <Kpis>
        <Kpi>
          <span>Solicitações no período</span>
          <b className="mono">{fmt.format(r.total)}</b>
        </Kpi>
        <Kpi>
          <span>Concluídas</span>
          <b className="mono">{fmt.format(r.resolved)}</b>
        </Kpi>
        <Kpi>
          <span>Idade média das solicitações em aberto</span>
          <b className="mono">{openAge == null ? '-' : `${openAge} min`}</b>
        </Kpi>
        <Kpi>
          <span>Tempo médio de resolução</span>
          <b className="mono">{attendance == null ? '-' : `${attendance} min`}</b>
        </Kpi>
        <Kpi>
          <span>Ocupação dos abrigos ativos</span>
          <b className="mono">{occPercent}%</b>
        </Kpi>
        <Kpi>
          <span>Alertas emitidos</span>
          <b className="mono">{fmt.format(report.data.alerts.total)}</b>
        </Kpi>
      </Kpis>
      <Grid $cols="1fr 1fr">
        <Panel>
          <PanelHead>
            <h2>Solicitações por tipo</h2>
          </PanelHead>
          <TableWrap>
            <Table>
              <tbody>
                {byType.map(({ t, n }) => (
                  <tr key={t}>
                    <td>{RESCUE_TYPE_LABEL[t]}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>
                      {n}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Panel>
        <Panel>
          <PanelHead>
            <h2>Bairros com mais ocorrências</h2>
          </PanelHead>
          {useMocks ? (
            <TableWrap>
              <Table>
                <tbody>
                  {byNb.map(([n, c]) => (
                    <tr key={n}>
                      <td>{n}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {c}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          ) : (
            <Empty
              title="A API não informa o bairro"
              hint="A lista de socorro da API só traz a descrição e as coordenadas, então não há como agrupar por bairro."
            />
          )}
        </Panel>
      </Grid>
      <Note>
        {useMocks
          ? 'Indicadores calculados sobre dados simulados. O relatório oficial usará o histórico completo do evento, vindo da API.'
          : 'Indicadores calculados pela API para o período escolhido. A idade média das solicitações em aberto é calculada no painel, sobre a fila atual.'}
      </Note>
    </Page>
  )
}
