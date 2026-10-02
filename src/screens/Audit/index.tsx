import { ErrorMsg, Note, Page, Panel, Skeleton, Table, TableWrap } from '@/components/ui'
import { ROLE_LABEL } from '@/domain/types'
import { useAudit } from '@/lib/queries'

export default function AuditScreen() {
  const { data, isPending, isError, error } = useAudit()
  return (
    <Page>
      <Panel>
        {isPending ? <Skeleton rows={6} h={32} /> : isError ? <ErrorMsg error={error} /> : (
          <TableWrap>
            <Table>
              <thead><tr><th>#</th><th>Quando</th><th>Autor</th><th>Ação</th><th>Entidade</th><th>Status</th><th>Hash</th></tr></thead>
              <tbody>
                {data.map((e) => (
                  <tr key={e.seq}>
                    <td className="mono">{e.seq}</td>
                    <td className="mono">{new Date(e.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>{e.author}<small>{ROLE_LABEL[e.role]} · {e.ip}</small></td>
                    <td>{e.action}</td>
                    <td className="mono">{e.entity}</td>
                    <td className="mono">{e.status}</td>
                    <td className="mono" title={`Anterior: ${e.prevHash}`}>{e.hash.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>
      <Note>Cada registro guarda o hash do anterior, formando uma cadeia. Aqui o hash é ilustrativo. A verificação de integridade real será feita pela API (SHA-256 encadeado).</Note>
    </Page>
  )
}
