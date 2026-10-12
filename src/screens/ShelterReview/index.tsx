import { Fragment, useState, type FormEvent } from 'react'
import { ActionError, Btn, Chip, Empty, ErrorMsg, Note, Page, Panel, PanelHead, Skeleton, Table, TableWrap, Toolbar } from '@/components/ui'
import { SHELTER_REVIEW_LABEL, type ShelterCandidate, type ShelterConfirmInput, type ShelterReviewStatus } from '@/domain/types'
import { useAuth } from '@/features/auth/store'
import { fmt } from '@/lib/format'
import { useConfirmShelter, useRejectShelter, useReopenShelter, useShelterReview, useSyncShelters } from '@/lib/queries'
import { Decision, DecisionCell, ImportBox, Meta, Pager, RowActions, SearchForm } from './styles'

const PAGE = 20
const MIN_NOTE = 3
const MIN_SEARCH = 2
const VIEWS: ShelterReviewStatus[] = ['CANDIDATE', 'CONFIRMED', 'REJECTED']
const RESOURCES = [
  ['water', 'Água'],
  ['food', 'Comida'],
  ['medical', 'Atendimento médico'],
  ['accessible', 'Acessível'],
  ['pets', 'Aceita animais'],
] as const

type Acting = { id: string; kind: 'confirm' | 'reject' } | null

interface ConfirmFormProps {
  shelter: ShelterCandidate
  pending: boolean
  onSubmit: (input: ShelterConfirmInput) => void
  onCancel: () => void
}

function ConfirmForm({ shelter, pending, onSubmit, onCancel }: ConfirmFormProps) {
  const [capacity, setCapacity] = useState(shelter.capacity > 0 ? String(shelter.capacity) : '')
  const [resources, setResources] = useState(shelter.resources)
  const [phone, setPhone] = useState(shelter.phone ?? '')
  const [note, setNote] = useState('')
  const n = Number(capacity)
  const capacityOk = /^\d+$/.test(capacity.trim()) && n >= 1 && n <= 100_000
  const noteOk = note.trim() === '' || note.trim().length >= MIN_NOTE

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!capacityOk || !noteOk || pending) return
    onSubmit({ capacity: n, resources, phone: phone.trim() || undefined, note: note.trim() || undefined })
  }

  return (
    <Decision onSubmit={submit} aria-label={`Confirmar ${shelter.name} como abrigo`}>
      <label>
        Capacidade (pessoas)
        <input inputMode="numeric" aria-invalid={!capacityOk} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        {!capacityOk && (
          <span className="err" role="alert">
            Informe um número inteiro de 1 a 100.000. A API recusa abrigo sem capacidade.
          </span>
        )}
      </label>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontSize: 13, marginBottom: 4 }}>Recursos disponíveis</legend>
        <div className="checks">
          {RESOURCES.map(([key, label]) => (
            <label key={key}>
              <input type="checkbox" checked={resources[key]} onChange={(e) => setResources({ ...resources, [key]: e.target.checked })} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Telefone de contato (opcional)
        <input type="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label>
        Nota da revisão (opcional, só a equipe vê)
        <textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        {!noteOk && (
          <span className="err" role="alert">
            Mínimo de {MIN_NOTE} caracteres, ou deixe em branco.
          </span>
        )}
      </label>
      <RowActions>
        <Btn type="submit" disabled={!capacityOk || !noteOk || pending}>
          {pending ? 'Confirmando…' : 'Confirmar como abrigo'}
        </Btn>
        <Btn type="button" $ghost onClick={onCancel}>
          Cancelar
        </Btn>
      </RowActions>
    </Decision>
  )
}

interface RejectFormProps {
  shelter: ShelterCandidate
  pending: boolean
  onSubmit: (note: string) => void
  onCancel: () => void
}

function RejectForm({ shelter, pending, onSubmit, onCancel }: RejectFormProps) {
  const [note, setNote] = useState('')
  const ok = note.trim().length >= MIN_NOTE

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (ok && !pending) onSubmit(note.trim())
  }

  return (
    <Decision onSubmit={submit} aria-label={`Rejeitar ${shelter.name}`}>
      <label>
        Motivo da rejeição (vai para a auditoria)
        <textarea
          value={note}
          maxLength={500}
          placeholder="Ex.: Local particular, sem estrutura para receber pessoas"
          onChange={(e) => setNote(e.target.value)}
        />
        {!ok && note.length > 0 && (
          <span className="err" role="alert">
            Mínimo de {MIN_NOTE} caracteres.
          </span>
        )}
      </label>
      <RowActions>
        <Btn type="submit" $danger disabled={!ok || pending}>
          {pending ? 'Rejeitando…' : 'Rejeitar local'}
        </Btn>
        <Btn type="button" $ghost onClick={onCancel}>
          Cancelar
        </Btn>
      </RowActions>
    </Decision>
  )
}

function ShelterImport() {
  const sync = useSyncShelters()
  const [asking, setAsking] = useState(false)
  const r = sync.data

  return (
    <Panel role="region" aria-label="Importar candidatos" style={{ marginBottom: 16 }}>
      <PanelHead>
        <h2>Importar candidatos do OpenStreetMap</h2>
      </PanelHead>
      <ImportBox>
        <Note style={{ margin: 0 }}>
          Busca locais públicos na fonte e cria candidatos inativos e sem capacidade. Importar de novo não duplica nem sobrescreve o que já foi
          revisado: o que sumiu da fonte só recebe um aviso, nada é apagado.
        </Note>
        <ActionError error={sync.error} />
        <div className="row">
          {asking ? (
            <>
              <span>Importar agora?</span>
              <Btn
                type="button"
                disabled={sync.isPending}
                onClick={() => {
                  setAsking(false)
                  sync.mutate()
                }}
              >
                Sim, importar
              </Btn>
              <Btn type="button" $ghost onClick={() => setAsking(false)}>
                Cancelar
              </Btn>
            </>
          ) : (
            <Btn type="button" disabled={sync.isPending} onClick={() => setAsking(true)}>
              {sync.isPending ? 'Importando…' : 'Importar abrigos do OpenStreetMap'}
            </Btn>
          )}
        </div>
        {r && (
          <p className="result" role="status">
            Importação concluída: {fmt.format(r.created)} novos, {fmt.format(r.updated)} atualizados, {fmt.format(r.unchanged)} sem mudança,{' '}
            {fmt.format(r.removedFromSource)} sumiram da fonte e {fmt.format(r.skipped)} foram descartados (de {fmt.format(r.fetched)} recebidos).
          </p>
        )}
      </ImportBox>
    </Panel>
  )
}

export default function ShelterReviewScreen() {
  const role = useAuth((s) => s.user?.role)
  const [status, setStatus] = useState<ShelterReviewStatus>('CANDIDATE')
  const [term, setTerm] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [acting, setActing] = useState<Acting>(null)
  const list = useShelterReview({ status, search: search.length >= MIN_SEARCH ? search : undefined, limit: PAGE, offset })
  const confirm = useConfirmShelter()
  const reject = useRejectShelter()
  const reopen = useReopenShelter()
  // decidir o último item da página esvazia ela: volta uma página para não ficar numa lista vazia
  const done = () => {
    setActing(null)
    if (offset > 0 && (list.data?.items.length ?? 0) <= 1) setOffset(Math.max(0, offset - PAGE))
  }
  // a lista anterior fica na tela enquanto a nova carrega: as ações ficam travadas para não agir sobre o item de outra aba
  const stale = list.isPlaceholderData
  const busy = stale || confirm.isPending || reject.isPending || reopen.isPending

  function decide(id: string, kind: 'confirm' | 'reject') {
    confirm.reset()
    reject.reset()
    setActing({ id, kind })
  }
  function view(next: ShelterReviewStatus) {
    setStatus(next)
    setOffset(0)
    setActing(null)
  }
  function find(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSearch(term.trim())
    setOffset(0)
  }

  const total = list.data?.total ?? 0

  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE, total)
  const columns = status === 'CANDIDATE' ? 3 : 5

  return (
    <Page>
      {role === 'ADMIN' && <ShelterImport />}
      <Toolbar>
        {VIEWS.map((v) => (
          <Chip key={v} $on={status === v} aria-pressed={status === v} onClick={() => view(v)}>
            {SHELTER_REVIEW_LABEL[v]}
            {status === v && list.data ? ` · ${fmt.format(total)}` : ''}
          </Chip>
        ))}
        <SearchForm onSubmit={find} role="search">
          <input
            type="search"
            aria-label="Buscar por nome ou endereço"
            placeholder="Nome ou endereço"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          <Btn type="submit" $ghost>
            Buscar
          </Btn>
        </SearchForm>
      </Toolbar>
      <Panel>
        <ActionError error={reopen.error} />
        {list.isPending ? (
          <Skeleton rows={6} h={36} />
        ) : list.isError ? (
          <ErrorMsg error={list.error} />
        ) : list.data.items.length === 0 ? (
          <Empty
            title={search ? 'Nenhum local encontrado' : `Nenhum local em "${SHELTER_REVIEW_LABEL[status].toLowerCase()}"`}
            hint={
              status === 'CANDIDATE' && !search
                ? 'Um administrador pode importar candidatos do OpenStreetMap na parte de cima desta tela.'
                : undefined
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Local</th>
                  <th>Categoria</th>
                  {status !== 'CANDIDATE' && <th>Capacidade</th>}
                  {status !== 'CANDIDATE' && <th>Revisão</th>}
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((s) => {
                  const open = acting?.id === s.id
                  return (
                    <Fragment key={s.id}>
                      <tr>
                        <td>
                          <b>{s.name}</b>
                          <Meta>{s.address || 'Sem endereço'}</Meta>
                          {s.removedFromSource && <Meta>Este local sumiu da fonte na última importação.</Meta>}
                        </td>
                        <td className="mono">{s.category ?? '—'}</td>
                        {status !== 'CANDIDATE' && <td className="mono">{fmt.format(s.capacity)}</td>}
                        {status !== 'CANDIDATE' && (
                          <td>
                            {s.reviewedAt ? new Date(s.reviewedAt).toLocaleDateString('pt-BR') : '—'}
                            {s.reviewNote && <Meta>{s.reviewNote}</Meta>}
                          </td>
                        )}
                        <td>
                          <RowActions>
                            {status === 'CANDIDATE' ? (
                              <>
                                <Btn type="button" disabled={open || busy} onClick={() => decide(s.id, 'confirm')} aria-label={`Confirmar ${s.name}`}>
                                  Confirmar
                                </Btn>
                                <Btn
                                  type="button"
                                  $danger
                                  disabled={open || busy}
                                  onClick={() => decide(s.id, 'reject')}
                                  aria-label={`Rejeitar ${s.name}`}
                                >
                                  Rejeitar
                                </Btn>
                              </>
                            ) : (
                              <Btn
                                type="button"
                                $ghost
                                disabled={busy}
                                aria-label={`Devolver ${s.name} a candidato`}
                                onClick={() => {
                                  reopen.reset()
                                  reopen.mutate({ id: s.id }, { onSuccess: done })
                                }}
                              >
                                Devolver a candidato
                              </Btn>
                            )}
                          </RowActions>
                        </td>
                      </tr>
                      {open && acting && (
                        <tr>
                          <DecisionCell colSpan={columns}>
                            <ActionError error={acting.kind === 'confirm' ? confirm.error : reject.error} />
                            {acting.kind === 'confirm' ? (
                              <ConfirmForm
                                shelter={s}
                                pending={confirm.isPending}
                                onCancel={done}
                                onSubmit={(input) => confirm.mutate({ id: s.id, input }, { onSuccess: done })}
                              />
                            ) : (
                              <RejectForm
                                shelter={s}
                                pending={reject.isPending}
                                onCancel={done}
                                onSubmit={(note) => reject.mutate({ id: s.id, note }, { onSuccess: done })}
                              />
                            )}
                          </DecisionCell>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
        {list.data && total > PAGE && (
          <Pager>
            <Btn type="button" $ghost disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
              Anterior
            </Btn>
            <span>
              {fmt.format(from)} a {fmt.format(to)} de {fmt.format(total)}
            </span>
            <Btn type="button" $ghost disabled={to >= total} onClick={() => setOffset(offset + PAGE)}>
              Próxima
            </Btn>
          </Pager>
        )}
      </Panel>
      <Note>
        Candidatos vêm de fontes abertas e não são abrigos oficiais. Só aparecem para a população depois que um gestor confirma o local com a
        capacidade real. Toda decisão fica registrada na auditoria.
      </Note>
    </Page>
  )
}
