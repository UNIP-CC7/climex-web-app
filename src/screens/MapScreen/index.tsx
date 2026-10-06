import { useState } from 'react'
import { AlertLayer, BaseMap, HeatLayer, RescueLayer, ShelterLayer, SEVERITY_COLOR } from '@/components/map'
import { Page } from '@/components/ui'
import { SEVERITY_LABEL, type Severity } from '@/domain/types'
import { useAlerts, useRescue, useShelters } from '@/lib/queries'
import { Frame, Layers, Legend, Loading } from './styles'

type LayerKey = 'alerts' | 'shelters' | 'rescue' | 'heat'
const LAYERS: { key: LayerKey; label: string }[] = [
  { key: 'alerts', label: 'Áreas de alerta' },
  { key: 'shelters', label: 'Abrigos' },
  { key: 'rescue', label: 'Solicitações' },
  { key: 'heat', label: 'Concentração de ocorrências' },
]

export default function MapScreen() {
  const alerts = useAlerts()
  const shelters = useShelters()
  const rescue = useRescue()
  const [on, setOn] = useState<Record<LayerKey, boolean>>({ alerts: true, shelters: true, rescue: true, heat: false })

  return (
    <Page>
      <Frame>
        <BaseMap wheel zoom={13}>
          {on.alerts && <AlertLayer alerts={alerts.data ?? []} />}
          {on.heat && <HeatLayer items={rescue.data ?? []} />}
          {on.shelters && <ShelterLayer shelters={shelters.data ?? []} />}
          {on.rescue && <RescueLayer items={rescue.data ?? []} />}
        </BaseMap>
        {shelters.isPending && <Loading role="status">Carregando abrigos do estado...</Loading>}
        <Layers role="group" aria-label="Camadas do mapa">
          {LAYERS.map((l) => (
            <label key={l.key}>
              <input type="checkbox" checked={on[l.key]} onChange={(e) => setOn((s) => ({ ...s, [l.key]: e.target.checked }))} />
              {l.label}
            </label>
          ))}
        </Layers>
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
