import { useEffect, useState, useSyncExternalStore } from 'react'
import { onlineManager, useQueryClient } from '@tanstack/react-query'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowsClockwise,
  Bell,
  CloudLightning,
  FileText,
  HouseLine,
  Lifebuoy,
  MapTrifold,
  ShieldCheck,
  SignOut,
  WifiSlash,
  SquaresFour,
  Users,
  Warning,
} from '@phosphor-icons/react'
import { ROLE_LABEL, type Role } from '@/domain/types'
import { ROUTE_ROLES, useAuth } from '@/features/auth/store'
import { useAlerts, useRescue, useSummary } from '@/lib/queries'
import { Avatar, Badge, Brand, Content, Main, Me, Nav, NavGroup, Pill, Shell, Side, SubTitle, Top, TopTitle } from './styles'

interface Item {
  to: string
  label: string
  icon: typeof SquaresFour
  group?: 'admin'
}
const ITEMS: Item[] = [
  { to: '/', label: 'Painel', icon: SquaresFour },
  { to: '/mapa', label: 'Mapa', icon: MapTrifold },
  { to: '/socorro', label: 'Socorro', icon: Lifebuoy },
  { to: '/abrigos', label: 'Abrigos', icon: HouseLine },
  { to: '/alertas', label: 'Alertas', icon: Warning },
  { to: '/relatorios', label: 'Relatórios', icon: FileText },
  { to: '/usuarios', label: 'Usuários', icon: Users, group: 'admin' },
  { to: '/auditoria', label: 'Auditoria', icon: ShieldCheck, group: 'admin' },
]
const TITLES: Record<string, [string, string]> = {
  '/': ['Painel de situação', 'Santana de Parnaíba, SP'],
  '/mapa': ['Mapa operacional', 'Alertas, abrigos e solicitações'],
  '/socorro': ['Fila de socorro', 'Triagem por nível de risco'],
  '/abrigos': ['Abrigos', 'Cadastro e ocupação'],
  '/alertas': ['Alertas', 'Emissão e encerramento'],
  '/relatorios': ['Relatórios pós-evento', 'Indicadores e exportação'],
  '/usuarios': ['Usuários', 'Perfis e acesso'],
  '/auditoria': ['Trilha de auditoria', 'Registro encadeado de operações'],
}

const canSee = (path: string, role: Role) => ROUTE_ROLES[path]?.includes(role)

export function AppShell() {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const online = useSyncExternalStore(
    (notify) => onlineManager.subscribe(notify),
    () => onlineManager.isOnline(),
  )
  const summary = useSummary()
  const alerts = useAlerts()
  const rescue = useRescue()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!user) return null
  const [title, sub] = TITLES[pathname] ?? ['Climex', '']
  const open = rescue.data?.filter((r) => r.status === 'ABERTA').length ?? 0
  const secs = summary.dataUpdatedAt ? Math.max(0, Math.round((now - summary.dataUpdatedAt) / 1000)) : 0
  const active = alerts.data?.filter((a) => a.active).length ?? 0
  const visible = ITEMS.filter((i) => canSee(i.to, user.role))

  return (
    <Shell>
      <Side>
        <Brand>
          <CloudLightning size={24} weight="regular" />
          Climex
        </Brand>
        <Nav aria-label="Principal">
          {visible
            .filter((i) => !i.group)
            .map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.to === '/'}
                className={i.to === '/abrigos' || i.to === '/alertas' || i.to === '/relatorios' ? 'extra' : undefined}
              >
                <i.icon size={20} />
                {i.label}
                {i.to === '/socorro' && open > 0 && <Badge>{open}</Badge>}
              </NavLink>
            ))}
          {visible.some((i) => i.group) && <NavGroup className="extra">Administração</NavGroup>}
          {visible
            .filter((i) => i.group)
            .map((i) => (
              <NavLink key={i.to} to={i.to} className="extra">
                <i.icon size={20} />
                {i.label}
              </NavLink>
            ))}
        </Nav>
        <Me>
          <Avatar>
            {user.name
              .split(' ')
              .map((p) => p[0])
              .slice(0, 2)
              .join('')}
          </Avatar>
          <div>
            <b>{user.name}</b>
            <span>{ROLE_LABEL[user.role]}</span>
          </div>
          <button
            aria-label="Sair"
            title="Sair"
            onClick={() => {
              signOut()
              queryClient.clear() // nada do perfil anterior fica na memória da aba
              navigate('/entrar')
            }}
          >
            <SignOut size={18} />
          </button>
        </Me>
      </Side>

      <Main>
        <Top>
          <div>
            <TopTitle>{title}</TopTitle>
            <SubTitle>{sub}</SubTitle>
          </div>
          <span style={{ flex: 1 }} />
          {!online && (
            <Pill role="status">
              <WifiSlash size={16} />
              Sem conexão, dados salvos
            </Pill>
          )}
          <Pill $live className="hide">
            <ArrowsClockwise size={16} />
            <span className="mono">atualizado há {secs} s</span>
          </Pill>
          <Pill>
            <Bell size={16} />
            {active} {active === 1 ? 'alerta ativo' : 'alertas ativos'}
          </Pill>
        </Top>
        <Content>
          <Outlet />
        </Content>
      </Main>
    </Shell>
  )
}
