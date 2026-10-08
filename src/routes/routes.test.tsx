import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'
import { useAuth } from '@/features/auth/store'
import { theme } from '@/theme'
import { loginAs, newClient } from '@/test-utils'
import { router } from '.'

vi.mock('@/components/map', async () => {
  const { createElement } = await import('react')
  return {
    BaseMap: () => createElement('div'),
    AlertLayer: () => null,
    HeatLayer: () => null,
    RescueLayer: () => null,
    ShelterLayer: () => null,
    SEVERITY_COLOR: { OBSERVACAO: '#1', ATENCAO: '#2', ALERTA: '#3', ALERTA_MAXIMO: '#4' },
  }
})
vi.mock('react-leaflet', () => ({ Circle: () => null, useMapEvents: () => null }))

function app() {
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={newClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>,
  )
}
const go = (to: string) => act(() => router.navigate(to))
const path = () => router.state.location.pathname

afterEach(() => {
  useAuth.setState({ user: null })
  localStorage.clear()
})

describe('rotas e perfis', () => {
  it('sem sessão, qualquer rota leva para a entrada', async () => {
    app()
    await go('/mapa')
    await waitFor(() => expect(path()).toBe('/entrar'))
  })

  it('gestor vê relatórios, mas não usuários nem auditoria', async () => {
    loginAs('GESTOR')
    app()
    await go('/')
    expect(await screen.findByRole('link', { name: /Relatórios/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Usuários/ })).not.toBeInTheDocument()
    await go('/usuarios')
    await waitFor(() => expect(path()).toBe('/'))
    await go('/auditoria')
    await waitFor(() => expect(path()).toBe('/'))
  })

  it('agente não acessa abrigos, alertas nem relatórios', async () => {
    loginAs('AGENTE')
    app()
    await go('/')
    await screen.findByRole('link', { name: /Socorro/ })
    expect(screen.queryByRole('link', { name: /Abrigos/ })).not.toBeInTheDocument()
    for (const p of ['/abrigos', '/alertas', '/relatorios']) {
      await go(p)
      await waitFor(() => expect(path()).toBe('/'))
    }
  })

  it('administrador vê todas as telas', async () => {
    loginAs('ADMIN')
    app()
    await go('/auditoria')
    expect(await screen.findByText('Trilha de auditoria')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Usuários/ })).toBeInTheDocument()
  })

  it('rota desconhecida volta ao painel e sair leva à entrada', async () => {
    loginAs('GESTOR')
    app()
    await go('/nao-existe')
    await waitFor(() => expect(path()).toBe('/'))
    fireEvent.click(await screen.findByRole('button', { name: 'Sair' }))
    await waitFor(() => expect(path()).toBe('/entrar'))
    expect(useAuth.getState().user).toBeNull()
  })

  it('avisa quando está sem conexão e some quando volta', async () => {
    loginAs('GESTOR')
    app()
    await go('/')
    await screen.findByRole('link', { name: /Socorro/ })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    act(() => onlineManager.setOnline(false))
    expect(await screen.findByRole('status')).toHaveTextContent('Sem conexão, dados salvos')
    act(() => onlineManager.setOnline(true))
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })
})
