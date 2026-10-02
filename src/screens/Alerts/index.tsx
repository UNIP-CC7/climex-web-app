import { useState, type FormEvent } from 'react'
import { Circle, useMapEvents } from 'react-leaflet'
import { AlertLayer, BaseMap, SEVERITY_COLOR } from '@/components/map'
import { Btn, Empty, ErrorMsg, Field, FormGrid, Page, Panel, PanelHead, SeverityBadge, Skeleton, Table, TableWrap } from '@/components/ui'
import { SEVERITY_LABEL, type LatLng, type Severity } from '@/domain/types'
import { clock } from '@/lib/format'
import { useAlerts, useCloseAlert, useCreateAlert } from '@/lib/queries'
import { CENTER } from '@/mocks/seed'
import { Split } from './styles'

const SOURCE = { INMET: 'INMET', DEFESA_CIVIL: 'Defesa Civil', MANUAL: 'Manual' } as const

function Picker({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) })
  return null
}

export default function AlertsScreen() {
  const { data, isPending, isError, error } = useAlerts()
  const create = useCreateAlert()
  const close = useCloseAlert()
  const [center, setCenter] = useState<LatLng>(CENTER)
  const [radius, setRadius] = useState(1.2)
  const [severity, setSeverity] = useState<Severity>('ALERTA')

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    create.mutate(
      { title: String(f.get('title')), neighborhood: String(f.get('neighborhood')), severity, center, radiusKm: radius, hours: Number(f.get('hours')) || 6 },
      { onSuccess: () => e.currentTarget.reset() },
    )
  }

  return (
    <Page>
      <Split>
        <Panel>
          <PanelHead><h2>Novo alerta</h2></PanelHead>
          <FormGrid onSubmit={submit}>
            <Field className="full">Descrição<input name="title" required minLength={5} placeholder="Ex.: Chuva forte com risco de enchente" /></Field>
            <Field>Bairro<input name="neighborhood" required placeholder="Ex.: Fazendinha" /></Field>
            <Field>Duração (horas)<input name="hours" type="number" min={1} max={72} defaultValue={6} /></Field>
            <Field>Severidade
              <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
                {(Object.keys(SEVERITY_LABEL) as Severity[]).map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
              </select>
            </Field>
            <Field>Raio da área: {radius.toFixed(1).replace('.', ',')} km
              <input type="range" min={0.3} max={4} step={0.1} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
            </Field>
            <div className="full" style={{ height: 260, borderRadius: 8, overflow: 'hidden' }}>
              <BaseMap height={260} zoom={12} wheel>
                <Picker onPick={setCenter} />
                <Circle center={center} radius={radius * 1000} pathOptions={{ color: SEVERITY_COLOR[severity], fillColor: SEVERITY_COLOR[severity], fillOpacity: 0.25 }} />
              </BaseMap>
            </div>
            <p className="full" style={{ color: '#9db3cf', fontSize: 12.5 }}>Clique no mapa para posicionar o centro da área afetada.</p>
            <div className="full"><Btn type="submit" disabled={create.isPending}>{create.isPending ? 'Emitindo...' : 'Emitir alerta'}</Btn></div>
          </FormGrid>
        </Panel>

        <Panel>
          <PanelHead><h2>Alertas</h2></PanelHead>
          {isPending ? <Skeleton rows={4} h={36} /> : isError ? <ErrorMsg error={error} /> : data.length === 0 ? <Empty title="Nenhum alerta" /> : (
            <TableWrap>
              <Table>
                <thead><tr><th>Severidade</th><th>Área</th><th>Validade</th><th /></tr></thead>
                <tbody>
                  {data.map((a) => (
                    <tr key={a.id} style={{ opacity: a.active ? 1 : 0.55 }}>
                      <td><SeverityBadge severity={a.severity} /></td>
                      <td>{a.title}<small>{a.neighborhood} · fonte: {SOURCE[a.source]}</small></td>
                      <td className="mono">{clock(a.issuedAt)} a {clock(a.expiresAt)}</td>
                      <td>{a.active ? <Btn $ghost disabled={close.isPending} onClick={() => close.mutate(a.id)}>Encerrar</Btn> : <small>Encerrado</small>}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
          <div style={{ height: 240 }}>
            <BaseMap height={240}><AlertLayer alerts={data ?? []} /></BaseMap>
          </div>
        </Panel>
      </Split>
    </Page>
  )
}
