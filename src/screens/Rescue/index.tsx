import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ActionError,
  Btn,
  Chip,
  Empty,
  ErrorMsg,
  Field,
  FormGrid,
  Note,
  Page,
  Panel,
  PanelHead,
  RiskBadge,
  Skeleton,
  Table,
  TableWrap,
  Toolbar,
} from '@/components/ui'
import { RESCUE_STATUS_LABEL, RESCUE_TYPE_LABEL, type RescueRequest } from '@/domain/types'
import { useAuth } from '@/features/auth/store'
import { ago } from '@/lib/format'
import { byUrgency } from '@/lib/risk'
import { useRescue, useSetRescueStatus } from '@/lib/queries'
import { useMocks } from '@/services'

type Filter = 'ABERTA' | 'EM_ATENDIMENTO' | 'CONCLUIDA' | 'CANCELADA' | 'SOS'
const isClosed = (r: RescueRequest) => r.status === 'CONCLUIDA' || r.status === 'CANCELADA'

export default function RescueScreen() {
  const { user } = useAuth()
  const { data, isPending, isError, error } = useRescue()
  const setStatus = useSetRescueStatus()
  const [filter, setFilter] = useState<Filter>('ABERTA')
  const [closingId, setClosingId] = useState<string | null>(null)
  const outcomeRef = useRef<HTMLInputElement>(null)
  const agent = user?.name ?? 'Agente'

  const count = (f: Filter) => (data ?? []).filter((r) => (f === 'SOS' ? r.sos && !isClosed(r) : r.status === f)).length
  const rows = useMemo(
    () => (data ?? []).filter((r) => (filter === 'SOS' ? r.sos && !isClosed(r) : r.status === filter)).sort(byUrgency),
    [data, filter],
  )

  const tabs: [Filter, string][] = [
    ['ABERTA', 'Abertas'],
    ['EM_ATENDIMENTO', 'Em atendimento'],
    ['CONCLUIDA', 'Concluídas'],
    ['CANCELADA', 'Canceladas'],
    ['SOS', 'Somente SOS'],
  ]

  // o formulário só vale para um caso que ainda está em atendimento: se outro agente concluiu ou o caso saiu da lista, fecha
  const closing = (data ?? []).find((r) => r.id === closingId && r.status === 'EM_ATENDIMENTO') ?? null
  useEffect(() => {
    if (closing) outcomeRef.current?.focus() // quem usa teclado ou leitor de tela cai direto no campo novo
  }, [closing?.id]) // eslint-disable-line react-hooks/exhaustive-deps -- só ao abrir para outro caso

  function finish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!closing) return
    const outcome = String(new FormData(e.currentTarget).get('outcome')).trim()
    if (outcome.length < 3) {
      // o navegador já validou o texto cru: só espaços passam por ele e viram vazio aqui
      outcomeRef.current?.setCustomValidity('Escreva pelo menos 3 letras.')
      outcomeRef.current?.reportValidity()
      return
    }
    setStatus.mutate({ id: closing.id, status: 'CONCLUIDA', agent, outcome }, { onSuccess: () => setClosingId(null) })
  }

  function action(r: RescueRequest) {
    if (r.status === 'ABERTA')
      return (
        <Btn disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: r.id, status: 'EM_ATENDIMENTO', agent })}>
          Aceitar
        </Btn>
      )
    if (r.status === 'EM_ATENDIMENTO') {
      return (
        <Btn $ghost disabled={setStatus.isPending} onClick={() => setClosingId(r.id)}>
          Concluir
        </Btn>
      )
    }
    return <span style={{ color: '#9db3cf' }}>{r.outcome ?? RESCUE_STATUS_LABEL[r.status]}</span>
  }

  return (
    <Page>
      <Toolbar role="group" aria-label="Filtros">
        {tabs.map(([k, label]) => (
          <Chip
            key={k}
            $on={filter === k}
            aria-pressed={filter === k}
            onClick={() => {
              setFilter(k)
              setClosingId(null)
            }}
          >
            {label} · {count(k)}
          </Chip>
        ))}
      </Toolbar>
      {closing && (
        <Panel>
          <PanelHead>
            <h2>Desfecho do atendimento</h2>
          </PanelHead>
          <FormGrid key={closing.id} onSubmit={finish}>
            <Field className="full">
              Como terminou o atendimento?
              <input
                ref={outcomeRef}
                onChange={(e) => e.currentTarget.setCustomValidity('')}
                name="outcome"
                required
                minLength={3}
                maxLength={1000}
                placeholder="Ex.: Duas pessoas levadas ao abrigo"
              />
            </Field>
            <div className="full" style={{ display: 'flex', gap: 10 }}>
              <Btn type="submit" disabled={setStatus.isPending}>
                Registrar desfecho
              </Btn>
              <Btn type="button" $ghost onClick={() => setClosingId(null)}>
                Cancelar
              </Btn>
            </div>
          </FormGrid>
        </Panel>
      )}
      <ActionError error={setStatus.error} />
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
                      <small>{[r.neighborhood, r.inAlertArea ? 'dentro de área de alerta' : ''].filter(Boolean).join(', ')}</small>
                    </td>
                    <td>
                      {r.requesterName ? `${r.requesterName}, ` : ''}
                      {r.people} {r.people === 1 ? 'pessoa' : 'pessoas'}
                    </td>
                    <td className="mono">{r.distanceKm == null ? '-' : `${r.distanceKm.toFixed(1).replace('.', ',')} km`}</td>
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
        {useMocks
          ? 'Ordenada por nível de risco e, em empate, pela distância até o agente. O nível vai de 0 a 100, nas faixas Baixo, Médio, Alto e Crítico, e vem de uma regra de exemplo. Dados simulados.'
          : 'Ordenada pelo nível de risco, de 0 a 100 (faixas Baixo, Médio, Alto e Crítico), calculado pela API. A API ainda não informa a distância até o agente, o bairro nem o nome de quem pediu.'}
      </Note>
    </Page>
  )
}
