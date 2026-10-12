import { useState, type FormEvent } from 'react'
import { ActionError, Btn, ErrorMsg, Field, Note, Page, Panel, PanelHead, Skeleton, Table, TableWrap } from '@/components/ui'
import type { RiskConfigVersion } from '@/domain/types'
import { DEFAULT_RISK_CONFIG, RISK_GROUPS, changedFields, checkDraft, labelOf, toDraft, type RiskDraft } from '@/lib/riskConfig'
import { usePublishRiskConfig, useRiskConfig, useRiskHistory } from '@/lib/queries'
import { Actions, Changes, GroupBody, GroupError, Groups, Hint, NumberField, Publish } from './styles'

const MIN_REASON = 5
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export default function RiskConfigScreen() {
  const active = useRiskConfig()
  const history = useRiskHistory()
  const publish = usePublishRiskConfig()
  // null = o formulário mostra a versão em vigor; qualquer edição passa a valer sobre o rascunho
  const [edited, setEdited] = useState<RiskDraft | null>(null)
  const [reason, setReason] = useState('')

  if (active.isPending)
    return (
      <Page>
        <Skeleton rows={6} h={40} />
      </Page>
    )
  if (active.isError)
    return (
      <Page>
        <Panel>
          <ErrorMsg error={active.error} />
        </Panel>
      </Page>
    )

  const current = active.data
  const draft = edited ?? toDraft(current.config)
  const check = checkDraft(draft)
  const changed = changedFields(draft, current.config)
  const original = toDraft(current.config)
  const reasonOk = reason.trim().length >= MIN_REASON
  const canPublish = changed.length > 0 && check.config != null && reasonOk && !publish.isPending

  function setField(id: string, value: string) {
    setEdited({ ...draft, [id]: value })
  }
  function reset() {
    setEdited(null)
    setReason('')
    publish.reset()
  }
  function load(v: RiskConfigVersion) {
    setEdited(toDraft(v.config))
    setReason('')
    publish.reset()
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canPublish || check.config == null) return
    publish.mutate({ config: check.config, reason: reason.trim() }, { onSuccess: reset })
  }

  return (
    <Page>
      <Panel style={{ marginBottom: 16 }}>
        <PanelHead>
          <h2>{current.version === 0 ? 'Padrão do sistema em vigor' : `Versão ${String(current.version)} em vigor`}</h2>
          <span className="sp" />
          <small style={{ color: '#9db3cf' }}>{current.version === 0 ? 'Nenhuma versão gravada ainda' : `desde ${when(current.createdAt)}`}</small>
        </PanelHead>
        <GroupBody>
          <Hint>
            O Nível de Risco (0 a 100) de cada pedido de socorro soma os pesos abaixo. Não há protocolo oficial de calibração, por isso os pesos são
            ajustáveis. Cada publicação cria uma versão nova, fica na auditoria e vale só para pedidos criados depois: a fila aberta não é
            recalculada.
          </Hint>
        </GroupBody>
      </Panel>

      <form onSubmit={submit} aria-label="Pesos do nível de risco">
        <Groups>
          {RISK_GROUPS.map((g) => (
            <Panel key={g.id} role="group" aria-label={g.title}>
              <PanelHead>
                <h2>{g.title}</h2>
              </PanelHead>
              <GroupBody>
                <Hint>{g.hint}</Hint>
                {g.fields.map((f) => {
                  const id = `${g.id}.${f.key}`
                  const error = check.fields[id]
                  return (
                    <NumberField key={id} $changed={(draft[id] ?? '').trim() !== original[id]}>
                      {f.label}
                      <input
                        inputMode="numeric"
                        aria-label={`${g.title}: ${f.label}`}
                        aria-invalid={error != null}
                        value={draft[id] ?? ''}
                        onChange={(e) => setField(id, e.target.value)}
                      />
                      {error && (
                        <span className="err" role="alert">
                          {error}
                        </span>
                      )}
                    </NumberField>
                  )
                })}
                {check.groups[g.id] && <GroupError role="alert">{check.groups[g.id]}</GroupError>}
              </GroupBody>
            </Panel>
          ))}
        </Groups>

        <Panel role="region" aria-label="Publicar nova versão">
          <PanelHead>
            <h2>Publicar nova versão</h2>
          </PanelHead>
          <Publish>
            <ActionError error={publish.error} />
            {changed.length === 0 ? (
              <Hint>Altere algum peso para poder publicar.</Hint>
            ) : (
              <Changes aria-label="Alterações">
                {changed.map((id) => (
                  <li key={id}>
                    <span>{labelOf(id)}:</span>{' '}
                    <span className="arrow">
                      {original[id]} → {(draft[id] ?? '').trim() || '—'}
                    </span>
                  </li>
                ))}
              </Changes>
            )}
            <Field>
              Justificativa (vai para a auditoria)
              <textarea
                value={reason}
                maxLength={500}
                placeholder="Ex.: Aumentar o peso de idosos após a revisão com a Defesa Civil"
                onChange={(e) => setReason(e.target.value)}
              />
              {changed.length > 0 && !reasonOk && <span style={{ color: '#9db3cf', fontSize: 12 }}>Mínimo de {MIN_REASON} caracteres.</span>}
            </Field>
            <Actions>
              <Btn
                type="button"
                $ghost
                onClick={() => {
                  setEdited(toDraft(DEFAULT_RISK_CONFIG))
                  setReason('')
                }}
              >
                Restaurar padrão do sistema
              </Btn>
              <Btn type="button" $ghost disabled={edited == null} onClick={reset}>
                Descartar alterações
              </Btn>
              <span className="sp" />
              <Btn type="submit" disabled={!canPublish}>
                {publish.isPending ? 'Publicando…' : 'Publicar nova versão'}
              </Btn>
            </Actions>
          </Publish>
        </Panel>
      </form>

      <Panel style={{ marginTop: 16 }}>
        <PanelHead>
          <h2>Histórico de versões</h2>
        </PanelHead>
        {history.isPending ? (
          <Skeleton rows={3} h={32} />
        ) : history.isError ? (
          <ErrorMsg error={history.error} />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Versão</th>
                  <th>Quando</th>
                  <th>Justificativa</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {history.data.map((v) => (
                  <tr key={v.version}>
                    <td className="mono">{v.version}</td>
                    <td className="mono">{when(v.createdAt)}</td>
                    <td>{v.reason ?? '—'}</td>
                    <td>{v.isActive ? 'Em vigor' : 'Anterior'}</td>
                    <td>
                      <Btn type="button" $ghost onClick={() => load(v)} aria-label={`Carregar a versão ${String(v.version)} no formulário`}>
                        Carregar no formulário
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>
      <Note>
        Para reaproveitar uma versão antiga, carregue-a no formulário e publique: isso cria uma versão nova com os mesmos pesos, sem apagar o
        histórico.
      </Note>
    </Page>
  )
}
