import { useCallback, useState } from 'react'
import { AlertLayer, BaseMap, AlertHeatLayer, HeatLayer, RescueLayer, ShelterLayer, SEVERITY_COLOR } from '@/components/map'
import { Page } from '@/components/ui'
import { bboxKey, snapBbox } from '@/lib/bbox'
import { fmt } from '@/lib/format'
import { SEVERITY_LABEL, type Bbox, type Severity } from '@/domain/types'
import { useAlerts, useHeatmap, useMapCandidates, useRescue, useShelters } from '@/lib/queries'
import { useMocks } from '@/services'
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

  const heat = useHeatmap(on.heat)
  const candidatesOn = !useMocks && on.candidates
  // área visível (alargada e na grade): é o que pedimos à API, e só muda quando o mapa anda de verdade
  const [area, setArea] = useState<Bbox | null>(null)
  const onBounds = useCallback(
    (b: Bbox) =>
      setArea((prev) => {
        const next = snapBbox(b)
        return bboxKey(prev) === bboxKey(next) ? prev : next
      }),
    [],
  )
  const cands = useMapCandidates(candidatesOn, area)
  const hidden = cands.data ? cands.data.total - cands.data.items.length : 0

  return (
    <Page>
      <Frame>
        <BaseMap wheel zoom={13} onBounds={onBounds}>
          {on.alerts && <AlertLayer alerts={alerts.data ?? []} />}
          {on.heat && <HeatLayer cells={heat.data ?? []} />}
          {on.alertHeat && <AlertHeatLayer alerts={alerts.data ?? []} />}
          {on.shelters && <ShelterLayer shelters={(shelters.data ?? []).filter((s) => s.status !== 'INATIVO')} />}
          {candidatesOn && cands.isSuccess && <ShelterLayer shelters={cands.data.items} candidate />}
          {on.rescue && <RescueLayer items={rescue.data ?? []} />}
        </BaseMap>
        {shelters.isPending && <Loading role="status">Carregando abrigos do estado...</Loading>}
        {candidatesOn && cands.isFetching && <Loading role="status">Carregando candidatos do OpenStreetMap...</Loading>}
        {candidatesOn && cands.isError && (
          <Loading role="alert">
            Não foi possível carregar os candidatos: {cands.error instanceof Error ? cands.error.message : 'tente de novo.'}
          </Loading>
        )}
        <Layers role="group" aria-label="Camadas do mapa">
          {LAYERS.map((l) => (
            <label key={l.key}>
              <input type="checkbox" checked={on[l.key]} onChange={(e) => setOn((s) => ({ ...s, [l.key]: e.target.checked }))} />
              {l.label}
            </label>
          ))}
        </Layers>
        {candidatesOn && cands.isSuccess && (
          <Credit>
            Candidatos: locais do OpenStreetMap,{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              © colaboradores do OpenStreetMap
            </a>{' '}
            (licença ODbL). Não são abrigos oficiais.
            {hidden > 0 &&
              cands.data &&
              ` Mostrando ${fmt.format(cands.data.items.length)} de ${fmt.format(cands.data.total)} candidatos nesta área. Aproxime o mapa para ver os demais.`}
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
