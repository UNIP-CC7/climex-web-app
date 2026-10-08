import { useMemo, useState } from 'react'
import { Btn, Chip, Empty, ErrorMsg, Note, Page, Panel, RiskBadge, Skeleton, Table, TableWrap, Toolbar } from '@/components/ui'
import { RESCUE_STATUS_LABEL, RESCUE_TYPE_LABEL, type RescueRequest } from '@/domain/types'
import { useAuth } from '@/features/auth/store'
import { ago } from '@/lib/format'
import { useRescue, useSetRescueStatus } from '@/lib/queries'

type Filter = 'ABERTA' | 'EM_ATENDIMENTO' | 'CONCLUIDA' | 'SOS'

export default function RescueScreen() {
  const { user } = useAuth()
  const { data, isPending, isError, error } = useRescue()
  const setStatus = useSetRescueStatus()
  const [filter, setFilter] = useState<Filter>('ABERTA')
  const agent = user?.name ?? 'Agente'

  const count = (f: Filter) => (data ?? []).filter((r) => (f === 'SOS' ? r.sos && r.status !== 'CONCLUIDA' : r.status === f)).length
  const rows = useMemo(
    () =>
      (data ?? [])
        .filter((r) => (filter === 'SOS' ? r.sos && r.status !== 'CONCLUIDA' : r.status === filter))
        .sort((a, b) => b.risk.score - a.risk.score || a.distanceKm - b.distanceKm),
    [data, filter],
  )

  const tabs: [Filter, string][] = [
    ['ABERTA', 'Abertas'],
    ['EM_ATENDIMENTO', 'Em atendimento'],
    ['CONCLUIDA', 'Concluídas'],
    ['SOS', 'Somente SOS'],
  ]

  function action(r: RescueRequest) {
    if (r.status === 'ABERTA')
      return (
        <Btn disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: r.id, status: 'EM_ATENDIMENTO', agent })}>
          Aceitar
        </Btn>
      )
    if (r.status === 'EM_ATENDIMENTO') {
      return (
        <Btn
          $ghost
          disabled={setStatus.isPending}
          onClick={() => setStatus.mutate({ id: r.id, status: 'CONCLUIDA', agent, outcome: 'Atendida em campo' })}
        >
          Concluir
        </Btn>
      )
    }
    return <span style={{ color: '#9db3cf' }}>{r.outcome ?? 'Concluída'}</span>
  }

  return (
    <Page>
      <Toolbar role="group" aria-label="Filtros">
        {tabs.map(([k, label]) => (
          <Chip key={k} $on={filter === k} aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {label} · {count(k)}
          </Chip>
        ))}
      </Toolbar>
      <Panel>
        {isPending ? (
          <Skeleton rows={6} h={36} />
        ) : isError ? (
          <ErrorMsg error={error} />
        ) : rows.length === 0 ? (
          <Empty title="Nada por aqui" hint="Nenhuma solicitação neste filtro." />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Nível</th>
                  <th>Tipo</th>
                  <th>Local</th>
                  <th>Solicitante</th>
                  <th>Distância do agente</th>
                  <th>Aberta há</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <RiskBadge risk={r.risk} sos={r.sos} />
                    </td>
                    <td>{RESCUE_TYPE_LABEL[r.type]}</td>
                    <td>
                      {r.address}
                      <small>
                        {r.neighborhood}
                        {r.inAlertArea ? ', dentro de área de alerta' : ''}
                      </small>
                    </td>
                    <td>
                      {r.requesterName}, {r.people} {r.people === 1 ? 'pessoa' : 'pessoas'}
                    </td>
                    <td className="mono">{r.distanceKm.toFixed(1).replace('.', ',')} km</td>
                    <td className="mono">{ago(r.openedAt)}</td>
                    <td>
                      {RESCUE_STATUS_LABEL[r.status]}
                      {r.assignedTo && <small>{r.assignedTo}</small>}
                    </td>
                    <td>{action(r)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>
      <Note>
        Ordenada por nível de risco e, em empate, pela distância até o agente. Nível de risco de 0 a 100, nas faixas Baixo, Médio, Alto e Crítico. No
        modo simulado o valor vem de uma regra de exemplo, no modo HTTP vem da API. Dados simulados.
      </Note>
    </Page>
  )
}
