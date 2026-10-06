import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'
import type { Role } from '@/domain/types'
import { useAuth } from '@/features/auth/store'
import { theme } from '@/theme'

const NAMES: Record<Role, string> = { AGENTE: 'Renata Lopes', GESTOR: 'Marcos Cavalcante', ADMIN: 'Diego Arruda' }

export function loginAs(role: Role) {
  useAuth.setState({ user: { id: `sess-${role}`, name: NAMES[role], role } })
}

export function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
}

export function renderWithApp(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={newClient()}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}
