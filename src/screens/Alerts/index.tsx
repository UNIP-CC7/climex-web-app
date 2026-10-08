import { useState, type FormEvent } from 'react'
import { Circle, useMapEvents } from 'react-leaflet'
import { AlertLayer, BaseMap, FitCircle, SEVERITY_COLOR } from '@/components/map'
import {
  ActionError,
  Btn,
  Empty,
  ErrorMsg,
  Field,
  FormGrid,
  Page,
  Panel,
  PanelHead,
  SeverityBadge,
  Skeleton,
  Table,
  TableWrap,
} from '@/components/ui'
import { SEVERITY_LABEL, type LatLng, type Severity } from '@/domain/types'
import { clock } from '@/lib/format'
import { formatRadius, formatRadiusInput, kmToSlider, parseRadiusKm, sliderToKm } from '@/lib/radius'
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
  const [radiusText, setRadiusText] = useState('1,2')
  const [severity, setSeverity] = useState<Severity>('ALERTA')

  // o campo exato tem que ser um número: senão o alerta sairia com um raio diferente do que está escrito
  const radiusInvalid = parseRadiusKm(radiusText) == null

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (radiusInvalid) return
    const form = e.currentTarget // depois do await o evento já perdeu o currentTarget
    const f = new FormData(form)
    create.mutate(
      {
        title: String(f.get('title')),
        neighborhood: String(f.get('neighborhood')),
        severity,
        center,
        radiusKm: radius,
        hours: Number(f.get('hours')) || 6,
      },
      { onSuccess: () => form.reset() },
    )
  }

  return (
    <Page>
      <Split>
        <Panel role="region" aria-label="Novo alerta">
          <PanelHead>
            <h2>Novo alerta</h2>
          </PanelHead>
          <ActionError error={create.error} />
          <FormGrid onSubmit={submit}>
            <Field className="full">
              Descrição
              <input name="title" required minLength={5} placeholder="Ex.: Chuva forte com risco de enchente" />
            </Field>
            <Field>
              Bairro
              <input name="neighborhood" required placeholder="Ex.: Fazendinha" />
            </Field>
            <Field>
              Duração (horas)
              <input name="hours" type="number" min={1} max={72} defaultValue={6} />
            </Field>
            <Field>
              Severidade
              <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
                {(Object.keys(SEVERITY_LABEL) as Severity[]).map((s) => (
                  <option key={s} value={s}>
                    {SEVERITY_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              Raio da área: {formatRadius(radius)}
              <input
                type="range"
                min={0}
                max={1}
                step="any"
                value={kmToSlider(radius)}
                aria-valuetext={formatRadius(radius)}
                onChange={(e) => {
                  const km = sliderToKm(Number(e.target.value))
                  setRadius(km)
                  setRadiusText(formatRadiusInput(km))
                }}
              />
            </Field>
            <Field>
              Raio exato (km)
              <input
                inputMode="decimal"
                aria-label="Raio exato em quilômetros"
                aria-invalid={radiusInvalid}
                value={radiusText}
                onChange={(e) => {
                  setRadiusText(e.target.value)
                  const km = parseRadiusKm(e.target.value)
                  if (km != null) setRadius(km)
                }}
                onBlur={() => setRadiusText(formatRadiusInput(radius))}
              />
              <span style={{ color: radiusInvalid ? '#ff8a8a' : '#9db3cf', fontSize: 12 }} role={radiusInvalid ? 'alert' : undefined}>
                {radiusInvalid ? 'Digite um número entre 0,5 e 50.' : 'De 500 m (0,5) a 50 km.'}
              </span>
            </Field>
            <div className="full" style={{ height: 260, borderRadius: 8, overflow: 'hidden' }}>
              <BaseMap height={260} zoom={12} wheel>
                <Picker onPick={setCenter} />
                <FitCircle center={center} radiusMeters={radius * 1000} />
                <Circle
                  center={center}
                  radius={radius * 1000}
                  pathOptions={{ color: SEVERITY_COLOR[severity], fillColor: SEVERITY_COLOR[severity], fillOpacity: 0.25 }}
                />
              </BaseMap>
            </div>
            <p className="full" style={{ color: '#9db3cf', fontSize: 12.5 }}>
              Clique no mapa para posicionar o centro da área afetada.
            </p>
            <div className="full">
              <Btn type="submit" disabled={create.isPending || radiusInvalid}>
                {create.isPending ? 'Emitindo...' : 'Emitir alerta'}
              </Btn>
            </div>
          </FormGrid>
        </Panel>

        <Panel role="region" aria-label="Alertas">
          <PanelHead>
            <h2>Alertas</h2>
          </PanelHead>
          <ActionError error={close.error} />
          {isPending ? (
            <Skeleton rows={4} h={36} />
          ) : isError ? (
            <ErrorMsg error={error} />
          ) : data.length === 0 ? (
            <Empty title="Nenhum alerta" />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <th>Severidade</th>
                    <th>Área</th>
                    <th>Validade</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.map((a) => (
                    <tr key={a.id} style={{ opacity: a.active ? 1 : 0.55 }}>
                      <td>
                        <SeverityBadge severity={a.severity} />
                      </td>
                      <td>
                        {a.title}
                        <small>
                          {a.neighborhood} · fonte: {SOURCE[a.source]}
                        </small>
                      </td>
                      <td className="mono">
                        {clock(a.issuedAt)} a {a.expiresAt ? clock(a.expiresAt) : 'sem prazo'}
                      </td>
                      <td>
                        {a.active ? (
                          <Btn $ghost disabled={close.isPending} onClick={() => close.mutate(a.id)}>
                            Encerrar
                          </Btn>
                        ) : (
                          <small>Encerrado</small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
          <div style={{ height: 240 }}>
            <BaseMap height={240}>
              <AlertLayer alerts={data ?? []} />
            </BaseMap>
          </div>
        </Panel>
      </Split>
    </Page>
  )
}
