import L from 'leaflet'
import { useState, type FormEvent } from 'react'
import { Circle, Marker, Polygon, Polyline, useMapEvents } from 'react-leaflet'
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
import { centroid, MIN_VERTICES, selfIntersects } from '@/lib/polygon'
import { formatRadius, formatRadiusInput, kmToSlider, parseRadiusKm, sliderToKm } from '@/lib/radius'
import { useAlerts, useCloseAlert, useCreateAlert } from '@/lib/queries'
import { useAuth } from '@/features/auth/store'
import { InmetImport } from './InmetImport'
import { CENTER } from '@/mocks/seed'
import { Split } from './styles'

const SOURCE = { INMET: 'INMET', DEFESA_CIVIL: 'Defesa Civil', MANUAL: 'Manual' } as const

const vertexIcon = L.divIcon({
  className: '',
  html: '<span style="display:block;width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid #1d4ed8;box-shadow:0 0 0 1px #fff"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

type Shape = 'circle' | 'polygon'

function Picker({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) })
  return null
}

export default function AlertsScreen() {
  const { data, isPending, isError, error } = useAlerts()
  const role = useAuth((s) => s.user?.role)
  const create = useCreateAlert()
  const close = useCloseAlert()
  const [center, setCenter] = useState<LatLng>(CENTER)
  const [radius, setRadius] = useState(1.2)
  const [radiusText, setRadiusText] = useState('1,2')
  const [severity, setSeverity] = useState<Severity>('ALERTA')
  const [shape, setShape] = useState<Shape>('circle')
  const [vertices, setVertices] = useState<LatLng[]>([])

  // o campo exato tem que ser um número: senão o alerta sairia com um raio diferente do que está escrito
  const radiusInvalid = shape === 'circle' && parseRadiusKm(radiusText) == null
  const crossing = shape === 'polygon' && selfIntersects(vertices)
  const polygonInvalid = shape === 'polygon' && (vertices.length < MIN_VERTICES || crossing)
  const color = SEVERITY_COLOR[severity]

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (radiusInvalid || polygonInvalid) return
    const form = e.currentTarget // depois do await o evento já perdeu o currentTarget
    const f = new FormData(form)
    create.mutate(
      {
        title: String(f.get('title')),
        neighborhood: String(f.get('neighborhood')),
        severity,
        center: shape === 'polygon' ? centroid(vertices) : center,
        radiusKm: radius,
        hours: Number(f.get('hours')) || 6,
        ...(shape === 'polygon' ? { polygon: vertices } : {}),
      },
      {
        onSuccess: () => {
          form.reset()
          setVertices([])
        },
      },
    )
  }

  return (
    <Page>
      {role === 'ADMIN' && <InmetImport />}
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
              <input name="neighborhood" required placeholder="Ex.: Jardim Mirante" />
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
            <Field className="full">
              Forma da área
              <select aria-label="Forma da área" value={shape} onChange={(e) => setShape(e.target.value as Shape)}>
                <option value="circle">Círculo</option>
                <option value="polygon">Polígono</option>
              </select>
            </Field>
            {shape === 'circle' && (
              <>
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
              </>
            )}
            <div className="full" style={{ height: 260, borderRadius: 8, overflow: 'hidden' }}>
              <BaseMap height={260} zoom={12} wheel>
                <Picker onPick={shape === 'polygon' ? (p) => setVertices((v) => [...v, p]) : setCenter} />
                {shape === 'circle' ? (
                  <>
                    <FitCircle center={center} radiusMeters={radius * 1000} />
                    <Circle center={center} radius={radius * 1000} pathOptions={{ color, fillColor: color, fillOpacity: 0.25 }} />
                  </>
                ) : (
                  <>
                    {vertices.length >= MIN_VERTICES ? (
                      <Polygon
                        positions={vertices}
                        pathOptions={{
                          color: crossing ? '#ff8a8a' : color,
                          fillColor: color,
                          fillOpacity: 0.25,
                          dashArray: crossing ? '6 6' : undefined,
                        }}
                      />
                    ) : (
                      vertices.length === 2 && <Polyline positions={vertices} pathOptions={{ color }} />
                    )}
                    {vertices.map((v, i) => (
                      <Marker
                        key={i}
                        position={v}
                        icon={vertexIcon}
                        draggable
                        eventHandlers={{
                          dragend: (e) => {
                            const { lat, lng } = (e.target as L.Marker).getLatLng()
                            setVertices((all) => all.map((p, j) => (j === i ? [lat, lng] : p)))
                          },
                        }}
                      />
                    ))}
                  </>
                )}
              </BaseMap>
            </div>
            <p className="full" style={{ color: '#9db3cf', fontSize: 12.5 }}>
              {shape === 'circle'
                ? 'Clique no mapa para posicionar o centro da área afetada.'
                : 'Clique no mapa para adicionar vértices; arraste um vértice para ajustar a forma. São necessários ao menos 3.'}
            </p>
            {shape === 'polygon' && (
              <div className="full" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <Btn type="button" $ghost disabled={vertices.length === 0} onClick={() => setVertices((v) => v.slice(0, -1))}>
                  Desfazer último ponto
                </Btn>
                <Btn type="button" $ghost disabled={vertices.length === 0} onClick={() => setVertices([])}>
                  Limpar desenho
                </Btn>
                <span role={crossing ? 'alert' : undefined} style={{ color: crossing ? '#ff8a8a' : '#9db3cf', fontSize: 12.5 }}>
                  {crossing
                    ? 'As linhas do contorno se cruzam. Ajuste os vértices.'
                    : `${vertices.length} vértice(s)${vertices.length < MIN_VERTICES ? ` · faltam ${MIN_VERTICES - vertices.length}` : ''}`}
                </span>
              </div>
            )}
            <div className="full">
              <Btn type="submit" disabled={create.isPending || radiusInvalid || polygonInvalid}>
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
