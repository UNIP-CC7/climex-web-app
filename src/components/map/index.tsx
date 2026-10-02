import type { ReactNode } from 'react'
import L from 'leaflet'
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer, Marker } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { RESCUE_TYPE_LABEL, SEVERITY_LABEL, type Alert, type LatLng, type RescueRequest, type Severity, type Shelter } from '@/domain/types'
import { theme } from '@/theme'
import { CENTER } from '@/mocks/seed'
import { clock } from '@/lib/format'

export const SEVERITY_COLOR: Record<Severity, string> = {
  OBSERVACAO: theme.colors.severity.obs,
  ATENCAO: theme.colors.severity.atn,
  ALERTA: theme.colors.severity.alr,
  ALERTA_MAXIMO: theme.colors.severity.max,
}

const KIND_LABEL: Record<Shelter['kind'], string> = {
  escola: 'Escola', ginasio_esportivo: 'Ginásio ou centro esportivo', centro_comunitario: 'Centro comunitário', assistencia_social: 'Assistência social',
}

const shelterIcon = L.divIcon({
  className: '',
  html: `<div style="width:26px;height:26px;border-radius:8px;background:${theme.colors.primaryLighten};color:${theme.colors.primary};display:grid;place-items:center;font-weight:700;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.4)">A</div>`,
  iconSize: [26, 26],
})

export function BaseMap({ center = CENTER, zoom = 12, wheel = false, height, children }: { center?: LatLng; zoom?: number; wheel?: boolean; height?: number | string; children?: ReactNode }) {
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
      {alerts.filter((a) => a.active).map((a) => (
        <Polygon key={a.id} positions={a.polygon} pathOptions={{ color: SEVERITY_COLOR[a.severity], weight: 2, fillColor: SEVERITY_COLOR[a.severity], fillOpacity: 0.22 }}>
          <Popup><b>{SEVERITY_LABEL[a.severity]}</b><br />{a.title}<br />{a.neighborhood}</Popup>
        </Polygon>
      ))}
    </>
  )
}

export function ShelterLayer({ shelters }: { shelters: Shelter[] }) {
  return (
    <MarkerClusterGroup chunkedLoading maxClusterRadius={50} showCoverageOnHover={false}>
      {shelters.map((s) => (
        <Marker key={s.id} position={[s.lat, s.lng]} icon={shelterIcon}>
          <Popup>
            <b>{s.name}</b><br />{KIND_LABEL[s.kind]}<br />{[s.street, s.neighborhood].filter(Boolean).join(', ')}
            <br /><span style={{ color: theme.colors.muted }}>
              {s.status === 'ATIVO' ? `Ocupação simulada: ${s.occupancy} / ${s.capacity}` : 'Candidato, ainda não validado pela Defesa Civil'}
            </span>
          </Popup>
        </Marker>
      ))}
    </MarkerClusterGroup>
  )
}

const RISK_COLOR = (r: number) => (r >= 5 ? theme.colors.severity.max : r === 4 ? theme.colors.severity.alr : theme.colors.severity.atn)

export function RescueLayer({ items }: { items: RescueRequest[] }) {
  return (
    <>
      {items.filter((r) => r.status !== 'CONCLUIDA').map((r) => (
        <CircleMarker key={r.id} center={[r.lat, r.lng]} radius={9} pathOptions={{ color: '#fff', weight: 2, fillColor: RISK_COLOR(r.risk), fillOpacity: 1 }}>
          <Popup><b>NR {r.risk}{r.sos ? ' (SOS)' : ''}, {RESCUE_TYPE_LABEL[r.type]}</b><br />{r.address}<br />Aberta às {clock(r.openedAt)}</Popup>
        </CircleMarker>
      ))}
    </>
  )
}

/** Concentração de ocorrências: círculos translúcidos somados por bairro. */
export function HeatLayer({ items }: { items: RescueRequest[] }) {
  return (
    <>
      {items.map((r) => (
        <CircleMarker key={r.id} center={[r.lat, r.lng]} radius={26} pathOptions={{ stroke: false, fillColor: theme.colors.danger, fillOpacity: 0.16 }} interactive={false} />
      ))}
    </>
  )
}
