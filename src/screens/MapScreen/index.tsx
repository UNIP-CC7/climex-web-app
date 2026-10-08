import { useMemo, useState } from 'react'
import { AlertLayer, BaseMap, AlertHeatLayer, HeatLayer, RescueLayer, ShelterLayer, SEVERITY_COLOR } from '@/components/map'
import { Page } from '@/components/ui'
import { SEVERITY_LABEL, type Severity } from '@/domain/types'
import { useAlerts, useOsmCandidates, useRescue, useShelters } from '@/lib/queries'
import { useMocks } from '@/services'
import { withoutRegistered } from '@/services/osm'
import { Credit, Frame, Layers, Legend, Loading } from './styles'

type LayerKey = 'alerts' | 'shelters' | 'rescue' | 'heat' | 'alertHeat' | 'candidates'
const LAYERS: { key: LayerKey; label: string }[] = [
  { key: 'alerts', label: 'Áreas de alerta' },
  { key: 'shelters', label: 'Abrigos' },
  { key: 'rescue', label: 'Solicitações' },
  { key: 'heat', label: 'Concentração de ocorrências' },
  { key: 'alertHeat', label: 'Densidade de alertas' },
  // no modo simulado os candidatos já vêm na lista de abrigos; com a API eles são uma camada à parte
  ...(useMocks ? [] : [{ key: 'candidates' as const, label: 'Candidatos do OpenStreetMap (não oficiais)' }]),
]

export default function MapScreen() {
  const alerts = useAlerts()
  const shelters = useShelters()
  const rescue = useRescue()
  const [on, setOn] = useState<Record<LayerKey, boolean>>({
    alerts: true,
    shelters: true,
    rescue: true,
    heat: false,
    alertHeat: false,
    candidates: false,
  })

  const candidatesOn = !useMocks && on.candidates
  const osm = useOsmCandidates(candidatesOn)
  // abrigo cadastrado e candidato no mesmo ponto: vale o cadastrado
  const candidates = useMemo(() => withoutRegistered(osm.data ?? [], shelters.data ?? []), [osm.data, shelters.data])

  return (
    <Page>
      <Frame>
        <BaseMap wheel zoom={13}>
          {on.alerts && <AlertLayer alerts={alerts.data ?? []} />}
          {on.heat && <HeatLayer items={rescue.data ?? []} />}
          {on.alertHeat && <AlertHeatLayer alerts={alerts.data ?? []} />}
          {on.shelters && <ShelterLayer shelters={shelters.data ?? []} />}
          {candidatesOn && osm.isSuccess && <ShelterLayer shelters={candidates} candidate />}
          {on.rescue && <RescueLayer items={rescue.data ?? []} />}
        </BaseMap>
        {shelters.isPending && <Loading role="status">Carregando abrigos do estado...</Loading>}
        {candidatesOn && osm.isFetching && <Loading role="status">Carregando candidatos do OpenStreetMap...</Loading>}
        {candidatesOn && osm.isError && (
          <Loading role="alert">Não foi possível carregar os candidatos: {osm.error instanceof Error ? osm.error.message : 'tente de novo.'}</Loading>
        )}
        <Layers role="group" aria-label="Camadas do mapa">
          {LAYERS.map((l) => (
            <label key={l.key}>
              <input type="checkbox" checked={on[l.key]} onChange={(e) => setOn((s) => ({ ...s, [l.key]: e.target.checked }))} />
              {l.label}
            </label>
          ))}
        </Layers>
        {candidatesOn && osm.isSuccess && (
          <Credit>
            Candidatos: locais do OpenStreetMap,{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              © colaboradores do OpenStreetMap
            </a>{' '}
            (licença ODbL). Não são abrigos oficiais.
          </Credit>
        )}
        <Legend>
          {(['OBSERVACAO', 'ATENCAO', 'ALERTA', 'ALERTA_MAXIMO'] as Severity[]).map((s) => (
            <div key={s}>
              <i style={{ background: SEVERITY_COLOR[s] }} />
              {SEVERITY_LABEL[s]}
            </div>
          ))}
        </Legend>
      </Frame>
    </Page>
  )
}
