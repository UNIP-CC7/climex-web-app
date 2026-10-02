import { DownloadSimple, Printer } from '@phosphor-icons/react'
import { Btn, ErrorMsg, Grid, Note, Page, Panel, PanelHead, Skeleton, Table, TableWrap } from '@/components/ui'
import { RESCUE_TYPE_LABEL, type RescueType } from '@/domain/types'
import { fmt, minutesAgo, toCsv } from '@/lib/format'
import { useAlerts, useRescue, useShelters } from '@/lib/queries'
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

  if (rescue.isError) return <Page><ErrorMsg error={rescue.error} /></Page>
  if (rescue.isPending || shelters.isPending || alerts.isPending) return <Page><Panel><Skeleton rows={6} h={40} /></Panel></Page>

  const all = rescue.data
  const done = all.filter((r) => r.status === 'CONCLUIDA')
  const avg = all.length ? Math.round(all.reduce((n, r) => n + minutesAgo(r.openedAt), 0) / all.length) : 0
  const active = (shelters.data ?? []).filter((s) => s.status === 'ATIVO')
  const occ = active.reduce((n, s) => n + s.occupancy, 0)
  const cap = active.reduce((n, s) => n + s.capacity, 0)
  const byType = (Object.keys(RESCUE_TYPE_LABEL) as RescueType[]).map((t) => ({ t, n: all.filter((r) => r.type === t).length }))
  const byNb = Object.entries(all.reduce<Record<string, number>>((m, r) => ({ ...m, [r.neighborhood]: (m[r.neighborhood] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])

  function exportCsv() {
    download('solicitacoes-climex.csv', toCsv(all.map((r) => ({
      id: r.id, tipo: RESCUE_TYPE_LABEL[r.type], nivel_risco: r.risk, sos: r.sos ? 'sim' : 'nao', situacao: r.status,
      bairro: r.neighborhood, endereco: r.address, pessoas: r.people, aberta_em: r.openedAt, agente: r.assignedTo ?? '',
    }))))
  }

  return (
    <Page>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <Btn onClick={exportCsv}><DownloadSimple size={18} />Exportar CSV</Btn>
        <Btn $ghost onClick={() => window.print()}><Printer size={18} />Imprimir ou salvar em PDF</Btn>
      </div>
      <Kpis>
        <Kpi><span>Solicitações no período</span><b className="mono">{fmt.format(all.length)}</b></Kpi>
        <Kpi><span>Concluídas</span><b className="mono">{fmt.format(done.length)}</b></Kpi>
        <Kpi><span>Tempo médio desde a abertura</span><b className="mono">{avg} min</b></Kpi>
        <Kpi><span>Ocupação dos abrigos ativos</span><b className="mono">{cap ? Math.round((100 * occ) / cap) : 0}%</b></Kpi>
        <Kpi><span>Alertas emitidos</span><b className="mono">{fmt.format((alerts.data ?? []).length)}</b></Kpi>
      </Kpis>
      <Grid $cols="1fr 1fr">
        <Panel>
          <PanelHead><h2>Solicitações por tipo</h2></PanelHead>
          <TableWrap><Table><tbody>{byType.map(({ t, n }) => <tr key={t}><td>{RESCUE_TYPE_LABEL[t]}</td><td className="mono" style={{ textAlign: 'right' }}>{n}</td></tr>)}</tbody></Table></TableWrap>
        </Panel>
        <Panel>
          <PanelHead><h2>Bairros com mais ocorrências</h2></PanelHead>
          <TableWrap><Table><tbody>{byNb.map(([n, c]) => <tr key={n}><td>{n}</td><td className="mono" style={{ textAlign: 'right' }}>{c}</td></tr>)}</tbody></Table></TableWrap>
        </Panel>
      </Grid>
      <Note>Indicadores calculados sobre dados simulados. O relatório oficial usará o histórico completo do evento, vindo da API.</Note>
    </Page>
  )
}
