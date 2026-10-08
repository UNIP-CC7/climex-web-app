import { useNavigate } from 'react-router-dom'
import { ArrowRight, CloudRain, HouseLine, Lifebuoy, PersonSimpleRun, Waves, Warning, WarningOctagon, Wind } from '@phosphor-icons/react'
import { AlertLayer, BaseMap, RescueLayer, ShelterLayer } from '@/components/map'
import {
  Btn,
  Empty,
  ErrorMsg,
  Grid,
  LinkBtn,
  Note,
  Page,
  Panel,
  PanelHead,
  RiskBadge,
  SeverityBadge,
  Skeleton,
  Table,
  TableWrap,
} from '@/components/ui'
import { RESCUE_TYPE_LABEL, RISK_BAND_LABEL, SEVERITY_LABEL, type Severity } from '@/domain/types'
import { useAuth } from '@/features/auth/store'
import { ago, clock, fmt } from '@/lib/format'
import { byUrgency } from '@/lib/risk'
import { useMocks } from '@/services'
import { useAlerts, useRescue, useSetRescueStatus, useShelters, useSummary } from '@/lib/queries'
import { CENTER } from '@/mocks/seed'
import { Alerted, Item, Occ, RiskRow, Stat, Stats } from './styles'

const SEV_ICON: Record<Severity, typeof CloudRain> = { ALERTA_MAXIMO: CloudRain, ALERTA: Waves, ATENCAO: Wind, OBSERVACAO: Warning }

function km(a: number, b: number, c: number, d: number) {
  const r = Math.PI / 180
  return 6371 * Math.sqrt(((c - a) * r) ** 2 + ((d - b) * r * Math.cos(a * r)) ** 2)
}

export default function DashboardScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const summary = useSummary()
  const alerts = useAlerts()
  const shelters = useShelters()
  const rescue = useRescue()
  const accept = useSetRescueStatus()

  const s = summary.data
  const active = alerts.data?.filter((a) => a.active) ?? []
  const nearby = shelters.data?.filter((x) => km(CENTER[0], CENTER[1], x.lat, x.lng) <= 12) ?? []
  const ativos = shelters.data?.filter((x) => x.status === 'ATIVO').slice(0, 3) ?? []
  const next = (rescue.data ?? [])
    .filter((r) => r.status === 'ABERTA')
    .sort(byUrgency)
    .slice(0, 3)

  return (
    <Page>
      <Stats>
        <Alerted>
          <div className="l">
            <WarningOctagon size={18} />
            Alertas ativos
          </div>
          <div className="v mono">{s ? s.activeAlerts : '-'}</div>
          <div className="d">
            {s?.maxAlert ? `Maior: ${SEVERITY_LABEL[s.maxAlert.severity]}, ${s.maxAlert.neighborhood}` : 'Nenhum alerta no momento'}
          </div>
        </Alerted>
        <Stat>
          <div className="l">
            <Lifebuoy size={18} />
            Solicitações abertas
          </div>
          <div className="v mono">{s ? s.openRescue : '-'}</div>
          <RiskRow>
            {s &&
              (['CRITICO', 'ALTO', 'MEDIO'] as const).map((b) => (
                <span key={b} className={`${b.toLowerCase()} mono`}>
                  {RISK_BAND_LABEL[b]} · {s.openByRisk[b]}
                </span>
              ))}
          </RiskRow>
        </Stat>
        <Stat>
          <div className="l">
            <HouseLine size={18} />
            Abrigos com vagas
          </div>
          <div className="v mono">
            {s ? (
              <>
                {s.sheltersWithSpots}
                <small> / {s.shelterTotal}</small>
              </>
            ) : (
              '-'
            )}
          </div>
          <div className="d">
            {s ? `${fmt.format(s.spotsFree)} vagas livres de ${fmt.format(s.spotsTotal)}${s.simulated ? ' (simulado)' : ''}` : 'carregando'}
          </div>
        </Stat>
        <Stat>
          <div className="l">
            <PersonSimpleRun size={18} />
            {s && s.agentsInField == null ? 'Agentes em atendimento' : 'Agentes em campo'}
          </div>
          <div className="v mono">{s ? (s.agentsInField ?? s.agentsAttending) : '-'}</div>
          <div className="d">
            {!s ? 'carregando' : s.agentsInField == null ? 'a API ainda não informa quem está em campo' : `${s.agentsAttending} em atendimento agora`}
          </div>
        </Stat>
      </Stats>
      {summary.isError && <ErrorMsg error={summary.error} />}

      <Grid $cols="minmax(0,1.7fr) minmax(300px,1fr)">
        <Panel style={{ display: 'flex', flexDirection: 'column' }}>
          <PanelHead>
            <h2>Situação no território</h2>
            <span className="sp" />
            <LinkBtn onClick={() => navigate('/mapa')}>
              Abrir mapa completo
              <ArrowRight size={14} />
            </LinkBtn>
          </PanelHead>
          <div style={{ flex: 1, minHeight: 420 }}>
            <BaseMap height="100%" zoom={12} center={[-23.428, -46.89]}>
              <AlertLayer alerts={active} />
              <ShelterLayer shelters={nearby} />
              <RescueLayer items={rescue.data ?? []} />
            </BaseMap>
          </div>
        </Panel>

        <Panel>
          <PanelHead>
            <h2>Alertas ativos</h2>
          </PanelHead>
          {alerts.isPending ? (
            <Skeleton rows={3} h={44} />
          ) : active.length === 0 ? (
            <Empty title="Nenhum alerta ativo" hint="Quando houver um alerta, ele aparece aqui." />
          ) : (
            <div>
              {active.map((a) => {
                const Icon = SEV_ICON[a.severity]
                return (
                  <Item key={a.id}>
                    <span className="ico" data-sev={a.severity}>
                      <Icon size={19} />
                    </span>
                    <div>
                      <b>
                        {a.title}, {a.neighborhood}
                      </b>
                      <span>
                        Emitido às {clock(a.issuedAt)} · {a.expiresAt ? `expira ${clock(a.expiresAt)}` : 'sem prazo de expiração'}
                      </span>
                    </div>
                    <SeverityBadge severity={a.severity} />
                  </Item>
                )
              })}
            </div>
          )}
          <PanelHead style={{ borderTop: '1px solid rgba(202,230,255,.14)' }}>
            <h2>Ocupação dos abrigos</h2>
          </PanelHead>
          {shelters.isPending ? (
            <Skeleton rows={3} h={28} />
          ) : (
            <Occ>
              {ativos.map((x) => (
                <div className="row" key={x.id}>
                  <div className="t">
                    <span>{x.name}</span>
                    <span className="mono">
                      {x.occupancy} / {x.capacity}
                    </span>
                  </div>
                  <div className="bar">
                    <i style={{ width: `${Math.round((100 * x.occupancy) / x.capacity)}%` }} />
                  </div>
                </div>
              ))}
            </Occ>
          )}
          <Note style={{ padding: '0 18px 14px', margin: 0 }}>
            {useMocks
              ? `Locais reais do OpenStreetMap (${fmt.format(shelters.data?.length ?? 0)} candidatos no estado). Capacidade e ocupação são simuladas.`
              : 'Abrigos ativos cadastrados na API.'}
          </Note>
        </Panel>
      </Grid>

      <Panel style={{ marginTop: 16 }}>
        <PanelHead>
          <h2>Próximas na fila de socorro</h2>
          <span className="sp" />
          <LinkBtn onClick={() => navigate('/socorro')}>
            Ver fila completa
            <ArrowRight size={14} />
          </LinkBtn>
        </PanelHead>
        {rescue.isPending ? (
          <Skeleton rows={3} h={32} />
        ) : next.length === 0 ? (
          <Empty title="Fila vazia" hint="Nenhuma solicitação aberta agora." />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Nível</th>
                  <th>Tipo</th>
                  <th>Local</th>
                  <th>Aberta há</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {next.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <RiskBadge risk={r.risk} sos={r.sos} />
                    </td>
                    <td>{RESCUE_TYPE_LABEL[r.type]}</td>
                    <td>{[r.address, r.neighborhood].filter(Boolean).join(', ')}</td>
                    <td className="mono">{ago(r.openedAt)}</td>
                    <td>
                      <Btn
                        disabled={accept.isPending}
                        onClick={() => accept.mutate({ id: r.id, status: 'EM_ATENDIMENTO', agent: user?.name ?? 'Agente' })}
                      >
                        Aceitar
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>
    </Page>
  )
}
