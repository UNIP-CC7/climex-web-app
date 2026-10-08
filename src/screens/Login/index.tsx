import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { CloudLightning } from '@phosphor-icons/react'
import { Btn, Field } from '@/components/ui'
import { ROLE_LABEL, type Role } from '@/domain/types'
import { useAuth } from '@/features/auth/store'
import { services, useMocks } from '@/services'
import { Card, Choice, Wrap } from './styles'

const OPTIONS: { role: Role; hint: string }[] = [
  { role: 'AGENTE', hint: 'Fila de socorro, mapa e painel' },
  { role: 'GESTOR', hint: 'Tudo do agente, mais abrigos, alertas e relatórios' },
  { role: 'ADMIN', hint: 'Tudo do gestor, mais usuários e auditoria' },
]

function PasswordForm() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return // dois envios seguidos abririam duas sessões
    const f = new FormData(e.currentTarget)
    setBusy(true)
    setError(null)
    try {
      signIn(await services.auth.loginWithPassword(String(f.get('phone')), String(f.get('password'))))
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      <Field>
        Telefone
        <input name="phone" type="tel" inputMode="tel" autoComplete="username" placeholder="(11) 99000-0001" required />
      </Field>
      <Field>
        Senha
        <input name="password" type="password" autoComplete="current-password" required />
      </Field>
      {error && <p role="alert">{error}</p>}
      <Btn type="submit" disabled={busy}>
        {busy ? 'Entrando...' : 'Entrar'}
      </Btn>
    </form>
  )
}

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
        {useMocks ? (
          <>
            <p>
              Painel da Defesa Civil, em modo simulado: não há login de verdade. Escolha um perfil para ver o painel como ele aparece para cada
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
          </>
        ) : (
          <>
            <p>Painel da Defesa Civil. Entre com o telefone e a senha cadastrados na API.</p>
            <PasswordForm />
          </>
        )}
        <small>Cidadãos não usam este painel. Eles acessam pelo aplicativo no celular.</small>
      </Card>
    </Wrap>
  )
}
