import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { useAuth } from '@/features/auth/store'
import { SESSION_EXPIRED_EVENT, browserTokens } from '@/services/http/session'
import { renderWithApp } from '@/test-utils'
import Login from './Login'
import Users from './Users'

// Simula VITE_USE_MOCKS=false: sem a API de verdade, só o que a tela faz com a resposta.
const loginWithPassword = vi.fn()
vi.mock('@/services', () => ({
  useMocks: false,
  capabilities: { listUsers: false },
  services: {
    auth: { loginWithPassword: (...a: unknown[]) => loginWithPassword(...a), login: vi.fn(), logout: vi.fn() },
    users: { list: vi.fn(async () => []), setRole: vi.fn(), setActive: vi.fn() },
  },
}))

beforeEach(() => {
  loginWithPassword.mockReset()
  useAuth.setState({ user: null })
  browserTokens.clear()
  localStorage.clear()
})

function fillAndSubmit(phone: string, password: string) {
  fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: phone } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('Login em modo HTTP', () => {
  it('mostra telefone e senha em vez do seletor de perfil', () => {
    renderWithApp(<Login />)
    expect(screen.getByLabelText('Telefone')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password')
    expect(screen.queryByText(/Entrar como/)).not.toBeInTheDocument()
  })

  it('entra com as credenciais e vai para o painel', async () => {
    loginWithPassword.mockResolvedValue({ id: 'u1', name: 'Carla', role: 'GESTOR' })
    renderWithApp(
      <Routes>
        <Route path="/" element={<p>painel</p>} />
        <Route path="/entrar" element={<Login />} />
      </Routes>,
      { route: '/entrar' },
    )
    fillAndSubmit('(11) 99000-0003', 'segredo')
    await screen.findByText('painel')
    expect(loginWithPassword).toHaveBeenCalledWith('(11) 99000-0003', 'segredo')
    expect(useAuth.getState().user).toEqual({ id: 'u1', name: 'Carla', role: 'GESTOR' })
  })

  it('mostra o erro da API e deixa tentar de novo', async () => {
    loginWithPassword.mockRejectedValue(new Error('Credenciais inválidas'))
    renderWithApp(<Login />)
    fillAndSubmit('11990000003', 'errada')
    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciais inválidas')
    expect(useAuth.getState().user).toBeNull()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  })
})

describe('Usuários em modo HTTP', () => {
  it('explica que a API não lista usuários em vez de mostrar tabela vazia', () => {
    renderWithApp(<Users />)
    expect(screen.getByText('A API ainda não lista usuários')).toBeInTheDocument()
    expect(screen.getByText(/GET \/admin\/users/)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('sessão', () => {
  it('sair apaga os tokens da API', () => {
    browserTokens.save({ accessToken: 'a', refreshToken: 'r' })
    useAuth.setState({ user: { id: 'u', name: 'Carla', role: 'GESTOR' } })
    useAuth.getState().signOut()
    expect(browserTokens.read()).toBeNull()
    expect(useAuth.getState().user).toBeNull()
  })

  it('quando a renovação falha o painel sai da conta sozinho', async () => {
    browserTokens.save({ accessToken: 'a', refreshToken: 'r' })
    useAuth.setState({ user: { id: 'u', name: 'Carla', role: 'GESTOR' } })
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    await waitFor(() => expect(useAuth.getState().user).toBeNull())
    expect(browserTokens.read()).toBeNull()
  })

  it('acompanha a sessão de outra aba pelo evento storage', async () => {
    useAuth.setState({ user: { id: 'u', name: 'Carla', role: 'GESTOR' } })
    localStorage.removeItem('climex.session') // a outra aba saiu
    window.dispatchEvent(new StorageEvent('storage', { key: 'climex.session' }))
    await waitFor(() => expect(useAuth.getState().user).toBeNull())

    localStorage.setItem('climex.session', JSON.stringify({ id: 'x', name: 'Bruno', role: 'AGENTE' })) // e a outra aba entrou
    window.dispatchEvent(new StorageEvent('storage', { key: 'climex.session' }))
    await waitFor(() => expect(useAuth.getState().user?.name).toBe('Bruno'))

    window.dispatchEvent(new StorageEvent('storage', { key: 'outra-coisa' })) // chave alheia não mexe
    expect(useAuth.getState().user?.name).toBe('Bruno')
  })
})
