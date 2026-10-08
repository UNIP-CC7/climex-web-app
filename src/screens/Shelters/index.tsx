import { useMemo, useState, type FormEvent } from 'react'
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
  Skeleton,
  Table,
  TableWrap,
  Toolbar,
} from '@/components/ui'
import type { Shelter, ShelterKind } from '@/domain/types'
import { fmt } from '@/lib/format'
import { useCheckIn, useShelters, useUpdateShelter } from '@/lib/queries'
import { useMocks } from '@/services'
import { Meter, SearchBox } from './styles'

const KIND: Record<ShelterKind, string> = {
  escola: 'Escola',
  ginasio_esportivo: 'Ginásio ou centro esportivo',
  centro_comunitario: 'Centro comunitário',
  assistencia_social: 'Assistência social',
}
const PAGE = 40
type View = 'ATIVO' | 'CANDIDATO'
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function SheltersScreen() {
  const { data, isPending, isError, error } = useShelters()
  const update = useUpdateShelter()
  const checkIn = useCheckIn()
  const [view, setView] = useState<View>('ATIVO')
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<ShelterKind | 'todos'>('todos')
  const [limit, setLimit] = useState(PAGE)
  const [editing, setEditing] = useState<Shelter | null>(null)
  const [fail, setFail] = useState<string | null>(null)

  const list = useMemo(() => {
    const nq = norm(q.trim())
    return (data ?? []).filter(
      (s) =>
        s.status === view &&
        (kind === 'todos' || s.kind === kind) &&
        (!nq || norm(`${s.name} ${s.neighborhood ?? ''} ${s.street ?? ''} ${s.city ?? ''}`).includes(nq)),
    )
  }, [data, view, kind, q])
  const countActive = (data ?? []).filter((s) => s.status === 'ATIVO').length

  // zerar a mutation em andamento reabilitaria o Salvar e permitiria um segundo envio
  function clearUpdateError() {
    if (!update.isPending) update.reset()
  }

  async function tryCheckIn(id: string, delta: number) {
    setFail(null)
    clearUpdateError()
    try {
      await checkIn.mutateAsync({ id, delta })
    } catch (e) {
      setFail(e instanceof Error ? e.message : 'Não foi possível atualizar')
    }
  }

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editing) return
    const f = new FormData(e.currentTarget)
    const capacity = Math.max(1, Number(f.get('capacity')) || editing.capacity)
    update.mutate(
      {
        id: editing.id,
        patch: {
          capacity,
          status: f.get('status') as Shelter['status'],
          resources: { water: f.has('water'), food: f.has('food'), medical: f.has('medical'), accessible: f.has('accessible'), pets: f.has('pets') },
        },
      },
      { onSuccess: () => setEditing(null) },
    )
  }

  return (
    <Page>
      <Toolbar>
        <Chip
          $on={view === 'ATIVO'}
          aria-pressed={view === 'ATIVO'}
          onClick={() => {
            setView('ATIVO')
            setLimit(PAGE)
          }}
        >
          Abrigos ativos · {countActive}
        </Chip>
        <Chip
          $on={view === 'CANDIDATO'}
          aria-pressed={view === 'CANDIDATO'}
          onClick={() => {
            setView('CANDIDATO')
            setLimit(PAGE)
          }}
        >
          Candidatos · {fmt.format((data?.length ?? 0) - countActive)}
        </Chip>
        <SearchBox>
          <label htmlFor="busca">Buscar</label>
          <input
            id="busca"
            type="search"
            placeholder="Nome, bairro ou rua"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setLimit(PAGE)
            }}
          />
        </SearchBox>
        <SearchBox>
          <label htmlFor="tipo">Tipo</label>
          <select
            id="tipo"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as ShelterKind | 'todos')
              setLimit(PAGE)
            }}
          >
            <option value="todos">Todos</option>
            {Object.entries(KIND).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </SearchBox>
      </Toolbar>

      {editing && (
        <Panel style={{ marginBottom: 16 }}>
          <PanelHead>
            <h2>Editar: {editing.name}</h2>
          </PanelHead>
          <FormGrid onSubmit={save}>
            <Field>
              Capacidade (pessoas)
              <input name="capacity" type="number" min={1} defaultValue={editing.capacity} />
            </Field>
            <Field>
              Situação
              <select name="status" defaultValue={editing.status}>
                <option value="ATIVO">Ativo (recebendo pessoas)</option>
                <option value="CANDIDATO">Candidato (não validado)</option>
                <option value="INATIVO">Inativo</option>
              </select>
            </Field>
            <div className="full" style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              {(
                [
                  ['water', 'Água'],
                  ['food', 'Alimentação'],
                  ['medical', 'Atendimento médico'],
                  ['accessible', 'Acessível'],
                  ['pets', 'Aceita animais'],
                ] as const
              ).map(([k, label]) => (
                <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" name={k} defaultChecked={editing.resources[k]} />
                  {label}
                </label>
              ))}
            </div>
            <div className="full" style={{ display: 'flex', gap: 10 }}>
              <Btn type="submit" disabled={update.isPending}>
                Salvar
              </Btn>
              <Btn
                type="button"
                $ghost
                onClick={() => {
                  clearUpdateError()
                  setEditing(null)
                }}
              >
                Cancelar
              </Btn>
            </div>
          </FormGrid>
        </Panel>
      )}
      <ActionError error={update.error} />
      {fail && (
        <p role="alert" style={{ color: '#ff9b9a', marginBottom: 10 }}>
          {fail}
        </p>
      )}

      <Panel>
        {isPending ? (
          <Skeleton rows={6} h={36} />
        ) : isError ? (
          <ErrorMsg error={error} />
        ) : list.length === 0 ? (
          <Empty
            title="Nenhum local encontrado"
            hint={view === 'ATIVO' ? 'Ative um candidato para ele aparecer aqui.' : 'Tente outro termo de busca.'}
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Local</th>
                  <th>Tipo</th>
                  <th>Ocupação</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.slice(0, limit).map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.name}
                      <small>{[s.street, s.neighborhood, s.city].filter(Boolean).join(', ') || 'Endereço não informado'}</small>
                    </td>
                    <td>{KIND[s.kind]}</td>
                    <td style={{ minWidth: 180 }}>
                      {s.status === 'ATIVO' ? (
                        <>
                          <span className="mono">
                            {s.occupancy} / {s.capacity}
                          </span>
                          <Meter>
                            <i style={{ width: `${Math.min(100, (100 * s.occupancy) / s.capacity)}%` }} />
                          </Meter>
                        </>
                      ) : (
                        <small>Capacidade ainda não informada</small>
                      )}
                    </td>
                    <td>{s.status === 'ATIVO' ? 'Ativo' : s.status === 'INATIVO' ? 'Inativo' : 'Candidato'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {s.status === 'ATIVO' && (
                        <>
                          <Btn $ghost aria-label={`Registrar saída em ${s.name}`} onClick={() => tryCheckIn(s.id, -1)}>
                            -1
                          </Btn>{' '}
                          <Btn $ghost aria-label={`Registrar entrada em ${s.name}`} onClick={() => tryCheckIn(s.id, 1)}>
                            +1
                          </Btn>{' '}
                        </>
                      )}
                      <Btn
                        $ghost
                        onClick={() => {
                          clearUpdateError()
                          setFail(null)
                          setEditing(s)
                        }}
                      >
                        Editar
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
        {list.length > limit && (
          <div style={{ padding: 14, textAlign: 'center' }}>
            <Btn $ghost onClick={() => setLimit((l) => l + PAGE)}>
              Mostrar mais ({fmt.format(list.length - limit)} restantes)
            </Btn>
          </div>
        )}
      </Panel>
      <Note>
        {useMocks
          ? 'Os candidatos vêm do OpenStreetMap (ODbL, © colaboradores do OpenStreetMap) e não são abrigos oficiais. Capacidade e ocupação são simuladas até existir o cadastro da Defesa Civil.'
          : 'Abrigos ativos cadastrados na API. Ela ainda não tem rota para registrar a saída de pessoas nem para cadastrar abrigos, e um abrigo desativado some desta lista.'}
      </Note>
    </Page>
  )
}
