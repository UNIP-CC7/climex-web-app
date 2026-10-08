import { useRef, useState } from 'react'
import { DownloadSimple, FilePdf } from '@phosphor-icons/react'
import { Btn, Empty, ErrorMsg, Grid, Note, Page, Panel, PanelHead, Skeleton, Table, TableWrap } from '@/components/ui'
import { RESCUE_TYPE_LABEL, RISK_BAND_LABEL, type RescueType } from '@/domain/types'
import { fmt, toCsv } from '@/lib/format'
import { averageAttendanceMinutes, averageOpenAgeMinutes } from '@/lib/metrics'
import { buildReportPdf, reportFileName } from '@/lib/reportPdf'
import { useAlerts, useRescue, useShelters } from '@/lib/queries'
import { useMocks } from '@/services'
import { Kpi, Kpis } from './styles'

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsScreen() {
  const rescue = useRescue()
  const shelters = useShelters()
  const alerts = useAlerts()
  const [pdfState, setPdfState] = useState<'idle' | 'busy' | 'error'>('idle')
  const pdfBusy = useRef(false) // trava síncrona: o estado só chega no render seguinte

  if (rescue.isError)
    return (
      <Page>
        <ErrorMsg error={rescue.error} />
      </Page>
    )
  if (rescue.isPending || shelters.isPending || alerts.isPending)
    return (
      <Page>
        <Panel>
          <Skeleton rows={6} h={40} />
        </Panel>
      </Page>
    )

  const all = rescue.data
  const done = all.filter((r) => r.status === 'CONCLUIDA')
  const openAge = averageOpenAgeMinutes(all)
  const attendance = averageAttendanceMinutes(all)
  const active = (shelters.data ?? []).filter((s) => s.status === 'ATIVO')
  const occ = active.reduce((n, s) => n + s.occupancy, 0)
  const cap = active.reduce((n, s) => n + s.capacity, 0)
  const byType = (Object.keys(RESCUE_TYPE_LABEL) as RescueType[]).map((t) => ({ t, n: all.filter((r) => r.type === t).length }))
  const byNb = Object.entries(
    all.reduce<Record<string, number>>((m, r) => ({ ...m, [r.neighborhood || 'Sem bairro']: (m[r.neighborhood || 'Sem bairro'] ?? 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1])

  function exportCsv() {
    download(
      'solicitacoes-climex.csv',
      toCsv(
        all.map((r) => ({
          id: r.id,
          tipo: RESCUE_TYPE_LABEL[r.type],
          nivel_risco: r.risk.score,
          faixa_risco: RISK_BAND_LABEL[r.risk.band],
          sos: r.sos ? 'sim' : 'nao',
          situacao: r.status,
          bairro: r.neighborhood,
          endereco: r.address,
          pessoas: r.people,
          aberta_em: r.openedAt,
          agente: r.assignedTo ?? '',
        })),
      ),
    )
  }

  async function exportPdf() {
    if (pdfBusy.current) return
    pdfBusy.current = true
    setPdfState('busy')
    try {
      const generatedAt = new Date()
      const blob = await buildReportPdf({
        generatedAt,
        requests: all,
        concluded: done.length,
        openAgeMinutes: openAge,
        attendanceMinutes: attendance,
        occupationPercent: cap ? Math.round((100 * occ) / cap) : 0,
        alertsCount: (alerts.data ?? []).length,
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
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <Btn onClick={exportCsv}>
          <DownloadSimple size={18} />
          Exportar CSV
        </Btn>
        <Btn $ghost onClick={exportPdf} disabled={pdfState === 'busy'}>
          <FilePdf size={18} />
          {pdfState === 'busy' ? 'Gerando PDF...' : 'Exportar PDF'}
        </Btn>
      </div>
      {pdfState === 'error' && <ErrorMsg error={new Error('Não foi possível gerar o PDF. Tente de novo.')} />}
      <Kpis>
        <Kpi>
          <span>Solicitações no período</span>
          <b className="mono">{fmt.format(all.length)}</b>
        </Kpi>
        <Kpi>
          <span>Concluídas</span>
          <b className="mono">{fmt.format(done.length)}</b>
        </Kpi>
        <Kpi>
          <span>Idade média das solicitações em aberto</span>
          <b className="mono">{openAge == null ? '-' : `${openAge} min`}</b>
        </Kpi>
        <Kpi>
          <span>Tempo médio de atendimento</span>
          <b className="mono">{attendance == null ? '-' : `${attendance} min`}</b>
        </Kpi>
        <Kpi>
          <span>Ocupação dos abrigos ativos</span>
          <b className="mono">{cap ? Math.round((100 * occ) / cap) : 0}%</b>
        </Kpi>
        <Kpi>
          <span>Alertas emitidos</span>
          <b className="mono">{fmt.format((alerts.data ?? []).length)}</b>
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
          : 'Indicadores calculados no navegador sobre as solicitações, os alertas e os abrigos que a API devolve. A API ainda não tem rota de relatório.'}
      </Note>
    </Page>
  )
}
