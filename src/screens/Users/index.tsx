import { useState } from 'react'
import { ActionError, Btn, ErrorMsg, Page, Panel, Skeleton, Table, TableWrap, Toolbar } from '@/components/ui'
import { ROLE_LABEL, type Role, type UserRole } from '@/domain/types'
import { useAuth } from '@/features/auth/store'
import { ago } from '@/lib/format'
import { useSetUserActive, useSetUserRole, useUsers } from '@/lib/queries'

const roleLabel = (r: UserRole) => (r === 'CIDADAO' ? 'Cidadão' : ROLE_LABEL[r])

export default function UsersScreen() {
  const { user } = useAuth()
  const { data, isPending, isError, error } = useUsers()
  const setRole = useSetUserRole()
  const setActive = useSetUserActive()
  const [showCitizens, setShowCitizens] = useState(false)
  const rows = (data ?? []).filter((u) => showCitizens || u.role !== 'CIDADAO')

  return (
    <Page>
      <Toolbar>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={showCitizens} onChange={(e) => setShowCitizens(e.target.checked)} />
          Mostrar cidadãos
        </label>
      </Toolbar>
      <ActionError error={setRole.error ?? setActive.error} />
      <Panel>
        {isPending ? (
          <Skeleton rows={5} h={36} />
        ) : isError ? (
          <ErrorMsg error={error} />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>Perfil</th>
                  <th>Último acesso</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} style={{ opacity: u.active ? 1 : 0.55 }}>
                    <td>{u.name}</td>
                    <td className="mono">{u.phone}</td>
                    <td>
                      <select
                        aria-label={`Perfil de ${u.name}`}
                        value={u.role}
                        disabled={setRole.isPending || u.name === user?.name}
                        onChange={(e) => setRole.mutate({ id: u.id, role: e.target.value as Role })}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(202,230,255,.14)',
                          borderRadius: 8,
                          padding: '6px 8px',
                          color: 'inherit',
                        }}
                      >
                        {u.role === 'CIDADAO' && (
                          <option value="CIDADAO" disabled style={{ color: '#1E1E1E' }}>
                            {roleLabel('CIDADAO')}
                          </option>
                        )}
                        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                          <option key={r} value={r} style={{ color: '#1E1E1E' }}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="mono">{u.lastAccess ? `${ago(u.lastAccess)} atrás` : '-'}</td>
                    <td>{u.active ? 'Ativo' : 'Desativado'}</td>
                    <td>
                      {u.name !== user?.name && (
                        <Btn $ghost disabled={setActive.isPending} onClick={() => setActive.mutate({ id: u.id, active: !u.active })}>
                          {u.active ? 'Desativar' : 'Reativar'}
                        </Btn>
                      )}
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
