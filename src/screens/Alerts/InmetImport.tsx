import { useState } from 'react'
import { ActionError, Btn, Note, Panel, PanelHead } from '@/components/ui'
import { fmt } from '@/lib/format'
import { useSyncAlerts } from '@/lib/queries'
import { ImportBox } from '../ShelterReview/styles'

/** Busca os avisos do INMET agora. É a mesma rotina do polling da API, então só o administrador dispara. */
export function InmetImport() {
  const sync = useSyncAlerts()
  const [asking, setAsking] = useState(false)
  const r = sync.data

  return (
    <Panel role="region" aria-label="Importar avisos do INMET" style={{ marginBottom: 16 }}>
      <PanelHead>
        <h2>Importar avisos do INMET</h2>
      </PanelHead>
      <ImportBox>
        <Note style={{ margin: 0 }}>
          Busca os avisos ativos da área piloto: cria os novos, atualiza os existentes e encerra os que saíram do feed. Alertas novos podem disparar
          notificação para os aparelhos dos cidadãos.
        </Note>
        <ActionError error={sync.error} />
        <div className="row">
          {asking ? (
            <>
              <span>Isso pode enviar notificações. Importar agora?</span>
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
              {sync.isPending ? 'Importando…' : 'Importar avisos do INMET'}
            </Btn>
          )}
        </div>
        {r && (
          <p className="result" role="status">
            Importação concluída: {fmt.format(r.created)} novos, {fmt.format(r.updated)} atualizados, {fmt.format(r.reactivated)} reativados,{' '}
            {fmt.format(r.resolved + r.expired)} encerrados e {fmt.format(r.notified)} notificados. Foram recebidos {fmt.format(r.fetched)} avisos,{' '}
            {fmt.format(r.inScope)} dentro da área piloto e {fmt.format(r.invalid)} descartados por formato inválido.
          </p>
        )}
      </ImportBox>
    </Panel>
  )
}
