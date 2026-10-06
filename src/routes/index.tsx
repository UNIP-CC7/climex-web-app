import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { Page, Skeleton } from '@/components/ui'
import { ROUTE_ROLES, useAuth } from '@/features/auth/store'

const Login = lazy(() => import('@/screens/Login'))
const Dashboard = lazy(() => import('@/screens/Dashboard'))
const MapScreen = lazy(() => import('@/screens/MapScreen'))
const Rescue = lazy(() => import('@/screens/Rescue'))
const Shelters = lazy(() => import('@/screens/Shelters'))
const Alerts = lazy(() => import('@/screens/Alerts'))
const Reports = lazy(() => import('@/screens/Reports'))
const Users = lazy(() => import('@/screens/Users'))
const Audit = lazy(() => import('@/screens/Audit'))

const Loading = () => (
  <Page>
    <Skeleton rows={4} h={40} />
  </Page>
)

function Protected({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user)
  return user ? <>{children}</> : <Navigate to="/entrar" replace />
}

/** Bloqueia a rota quando o perfil não tem acesso. O backend também precisa validar (RBAC). */
function Guard({ path, children }: { path: string; children: ReactNode }) {
  const role = useAuth((s) => s.user?.role)
  if (!role || !ROUTE_ROLES[path]?.includes(role)) return <Navigate to="/" replace />
  return <Suspense fallback={<Loading />}>{children}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/entrar',
    element: (
      <Suspense fallback={null}>
        <Login />
      </Suspense>
    ),
  },
  {
    element: (
      <Protected>
        <AppShell />
      </Protected>
    ),
    children: [
      {
        path: '/',
        element: (
          <Guard path="/">
            <Dashboard />
          </Guard>
        ),
      },
      {
        path: '/mapa',
        element: (
          <Guard path="/mapa">
            <MapScreen />
          </Guard>
        ),
      },
      {
        path: '/socorro',
        element: (
          <Guard path="/socorro">
            <Rescue />
          </Guard>
        ),
      },
      {
        path: '/abrigos',
        element: (
          <Guard path="/abrigos">
            <Shelters />
          </Guard>
        ),
      },
      {
        path: '/alertas',
        element: (
          <Guard path="/alertas">
            <Alerts />
          </Guard>
        ),
      },
      {
        path: '/relatorios',
        element: (
          <Guard path="/relatorios">
            <Reports />
          </Guard>
        ),
      },
      {
        path: '/usuarios',
        element: (
          <Guard path="/usuarios">
            <Users />
          </Guard>
        ),
      },
      {
        path: '/auditoria',
        element: (
          <Guard path="/auditoria">
            <Audit />
          </Guard>
        ),
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
