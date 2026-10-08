import { Btn, Empty, ErrorMsg, Page, Panel, Skeleton, Table, TableWrap } from '@/components/ui'
import { ROLE_LABEL, type Role } from '@/domain/types'
import { useAuth } from '@/features/auth/store'
import { ago } from '@/lib/format'
import { useSetUserActive, useSetUserRole, useUsers } from '@/lib/queries'
import { capabilities } from '@/services'

export default function UsersScreen() {
  const { user } = useAuth()
  const { data, isPending, isError, error } = useUsers()
  const setRole = useSetUserRole()
  const setActive = useSetUserActive()

  if (!capabilities.listUsers)
    return (
      <Page>
        <Panel>
          <Empty
            title="A API ainda não lista usuários"
            hint="Falta a rota GET /admin/users. Sem ela o painel não tem de onde tirar os usuários para trocar o perfil ou desativar contas. Esta tela volta a funcionar quando a rota existir."
          />
        </Panel>
      </Page>
    )

  return (
    <Page>
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
                {data.map((u) => (
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
                        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                          <option key={r} value={r} style={{ color: '#1E1E1E' }}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="mono">{ago(u.lastAccess)} atrás</td>
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
