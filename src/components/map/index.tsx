import { useMemo, type ReactNode } from 'react'
import L from 'leaflet'
import { Circle, CircleMarker, MapContainer, Polygon, Popup, TileLayer, Marker } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import {
  RESCUE_TYPE_LABEL,
  SEVERITY_LABEL,
  type Alert,
  type LatLng,
  type RescueRequest,
  type RiskBand,
  type Severity,
  type Shelter,
} from '@/domain/types'
import { theme } from '@/theme'
import { CENTER } from '@/mocks/seed'
import { clock } from '@/lib/format'
import { heatCells } from '@/lib/heat'

export const SEVERITY_COLOR: Record<Severity, string> = {
  OBSERVACAO: theme.colors.severity.obs,
  ATENCAO: theme.colors.severity.atn,
  ALERTA: theme.colors.severity.alr,
  ALERTA_MAXIMO: theme.colors.severity.max,
}

const KIND_LABEL: Record<Shelter['kind'], string> = {
  escola: 'Escola',
  ginasio_esportivo: 'Ginásio ou centro esportivo',
  centro_comunitario: 'Centro comunitário',
  assistencia_social: 'Assistência social',
}

const shelterIcon = L.divIcon({
  className: '',
  html: `<div style="width:26px;height:26px;border-radius:8px;background:${theme.colors.primaryLighten};color:${theme.colors.primary};display:grid;place-items:center;font-weight:700;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.4)">A</div>`,
  iconSize: [26, 26],
})

const candidateIcon = L.divIcon({
  className: '',
  html: `<div style="width:22px;height:22px;border-radius:8px;border:2px dashed ${theme.colors.primaryLighten};background:rgba(8,26,56,.85);color:${theme.colors.primaryLighten};display:grid;place-items:center;font-weight:700;font-size:12px">?</div>`,
  iconSize: [22, 22],
})

export function BaseMap({
  center = CENTER,
  zoom = 12,
  wheel = false,
  height,
  children,
}: {
  center?: LatLng
  zoom?: number
  wheel?: boolean
  height?: number | string
  children?: ReactNode
}) {
  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom={wheel} style={{ height: height ?? '100%', minHeight: 320, width: '100%' }}>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© colaboradores do OpenStreetMap" maxZoom={19} />
      {children}
    </MapContainer>
  )
}

export function AlertLayer({ alerts }: { alerts: Alert[] }) {
  return (
    <>
      {alerts
        .filter((a) => a.active)
        .map((a) => (
          <Polygon
            key={a.id}
            positions={a.polygons.map((ring) => [ring])} // um polígono por anel (o Leaflet leria anéis soltos como buracos)
            pathOptions={{ color: SEVERITY_COLOR[a.severity], weight: 2, fillColor: SEVERITY_COLOR[a.severity], fillOpacity: 0.22 }}
          >
            <Popup>
              <b>{SEVERITY_LABEL[a.severity]}</b>
              <br />
              {a.title}
              <br />
              {a.neighborhood}
            </Popup>
          </Polygon>
        ))}
    </>
  )
}

/** `candidate` desenha os marcadores como locais ainda não validados, para ninguém confundir com abrigo cadastrado. */
export function ShelterLayer({ shelters, candidate = false }: { shelters: Shelter[]; candidate?: boolean }) {
  return (
    <MarkerClusterGroup chunkedLoading maxClusterRadius={50} showCoverageOnHover={false}>
      {shelters.map((s) => (
        <Marker
          key={s.id}
          position={[s.lat, s.lng]}
          icon={candidate ? candidateIcon : shelterIcon}
          title={candidate ? `${s.name} (candidato, não oficial)` : `${s.name} (abrigo)`}
        >
          <Popup>
            <b>{s.name}</b>
            <br />
            {KIND_LABEL[s.kind]}
            <br />
            {[s.street, s.neighborhood].filter(Boolean).join(', ')}
            <br />
            <span style={{ color: theme.colors.muted }}>
              {s.status === 'ATIVO' ? `Ocupação simulada: ${s.occupancy} / ${s.capacity}` : 'Candidato, ainda não validado pela Defesa Civil'}
            </span>
          </Popup>
        </Marker>
      ))}
    </MarkerClusterGroup>
  )
}

const RISK_COLOR: Record<RiskBand, string> = {
  CRITICO: theme.colors.severity.max,
  ALTO: theme.colors.severity.alr,
  MEDIO: theme.colors.severity.atn,
  BAIXO: theme.colors.severity.obs,
}

export function RescueLayer({ items }: { items: RescueRequest[] }) {
  return (
    <>
      {items
        .filter((r) => r.status === 'ABERTA' || r.status === 'EM_ATENDIMENTO')
        .map((r) => (
          <CircleMarker
            key={r.id}
            center={[r.lat, r.lng]}
            radius={9}
            pathOptions={{ color: '#fff', weight: 2, fillColor: RISK_COLOR[r.risk.band], fillOpacity: 1 }}
          >
            <Popup>
              <b>
                NR {r.risk.score}
                {r.sos ? ' (SOS)' : ''}, {RESCUE_TYPE_LABEL[r.type]}
              </b>
              <br />
              {r.address}
              <br />
              Aberta às {clock(r.openedAt)}
            </Popup>
          </CircleMarker>
        ))}
    </>
  )
}

/** Concentração de ocorrências em aberto: grade de ~550 m, mais quente onde o NR somado é maior. */
export function HeatLayer({ items }: { items: RescueRequest[] }) {
  const cells = useMemo(() => heatCells(items), [items])
  return (
    <>
      {cells.map((c) => (
        <Circle
          key={`${c.lat}:${c.lng}`}
          center={[c.lat, c.lng]}
          radius={380}
          pathOptions={{ stroke: false, fillColor: theme.colors.danger, fillOpacity: 0.12 + 0.5 * c.intensity }}
          interactive={false}
        />
      ))}
    </>
  )
}
