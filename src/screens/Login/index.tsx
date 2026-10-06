import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { CloudLightning } from '@phosphor-icons/react'
import { ROLE_LABEL, type Role } from '@/domain/types'
import { useAuth } from '@/features/auth/store'
import { services } from '@/services'
import { Card, Choice, Wrap } from './styles'

const OPTIONS: { role: Role; hint: string }[] = [
  { role: 'AGENTE', hint: 'Fila de socorro, mapa e painel' },
  { role: 'GESTOR', hint: 'Tudo do agente, mais abrigos, alertas e relatórios' },
  { role: 'ADMIN', hint: 'Tudo do gestor, mais usuários e auditoria' },
]

export default function LoginScreen() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<Role | null>(null)
  if (user) return <Navigate to="/" replace />

  async function enter(role: Role) {
    setBusy(role)
    signIn(await services.auth.login(role))
    navigate('/', { replace: true })
  }

  return (
    <Wrap>
      <Card>
        <h1>
          <CloudLightning size={28} />
          Climex
        </h1>
        <p>
          Painel da Defesa Civil. Neste protótipo ainda não há login de verdade: escolha um perfil para ver o painel como ele aparece para cada
          função.
        </p>
        <div role="group" aria-label="Perfil de acesso">
          {OPTIONS.map((o) => (
            <Choice key={o.role} disabled={busy !== null} onClick={() => enter(o.role)}>
              <b>Entrar como {ROLE_LABEL[o.role].toLowerCase()}</b>
              <span>{busy === o.role ? 'Entrando...' : o.hint}</span>
            </Choice>
          ))}
        </div>
        <small>Cidadãos não usam este painel. Eles acessam pelo aplicativo no celular.</small>
      </Card>
    </Wrap>
  )
}
