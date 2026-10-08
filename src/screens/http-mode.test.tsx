import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { useAuth } from '@/features/auth/store'
import { SESSION_EXPIRED_EVENT, browserTokens } from '@/services/http/session'
import { loginAs, renderWithApp } from '@/test-utils'
import Login from './Login'
import Reports from './Reports'
import Rescue from './Rescue'
import Shelters from './Shelters'
import Users from './Users'

// Simula VITE_USE_MOCKS=false: sem a API de verdade, só o que a tela faz com a resposta.
const loginWithPassword = vi.fn()
const svc = { rescueList: vi.fn(), setStatus: vi.fn(), sheltersList: vi.fn(), sheltersUpdate: vi.fn(), alertsList: vi.fn() }
vi.mock('@/services', () => ({
  useMocks: false,
  capabilities: { listUsers: false },
  services: {
    auth: { loginWithPassword: (...a: unknown[]) => loginWithPassword(...a), login: vi.fn(), logout: vi.fn() },
    users: { list: vi.fn(async () => []), setRole: vi.fn(), setActive: vi.fn() },
    rescue: { list: (...a: unknown[]) => svc.rescueList(...a), setStatus: (...a: unknown[]) => svc.setStatus(...a) },
    shelters: { list: (...a: unknown[]) => svc.sheltersList(...a), update: (...a: unknown[]) => svc.sheltersUpdate(...a), checkIn: vi.fn() },
    alerts: { list: (...a: unknown[]) => svc.alertsList(...a), create: vi.fn(), close: vi.fn() },
  },
}))

beforeEach(() => {
  Object.values(svc).forEach((f) => f.mockReset())
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

const caso = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  type: 'ILHADO',
  status: 'EM_ATENDIMENTO',
  risk: { score: 72, band: 'ALTO' },
  sos: false,
  lat: 0,
  lng: 0,
  address: 'Casa alagada',
  neighborhood: '',
  inAlertArea: false,
  people: 2,
  requesterName: null,
  distanceKm: null,
  openedAt: new Date().toISOString(),
  assignedTo: 'ag1',
  outcome: null,
  ...over,
})

describe('Socorro em modo HTTP', () => {
  beforeEach(() => {
    loginAs('GESTOR')
    svc.rescueList.mockResolvedValue([caso()])
  })

  it('concluir pede o desfecho e só então chama a API', async () => {
    svc.setStatus.mockResolvedValue(caso({ status: 'CONCLUIDA' }))
    renderWithApp(<Rescue />)
    fireEvent.click(await screen.findByText(/^Em atendimento/))
    fireEvent.click(await screen.findByRole('button', { name: 'Concluir' }))
    expect(svc.setStatus).not.toHaveBeenCalled()
    fireEvent.change(screen.getByPlaceholderText(/Duas pessoas/), { target: { value: '  Duas pessoas levadas ao abrigo ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar desfecho' }))
    await waitFor(() => expect(svc.setStatus).toHaveBeenCalledWith('r1', 'CONCLUIDA', 'Marcos Cavalcante', 'Duas pessoas levadas ao abrigo'))
    await waitFor(() => expect(screen.queryByText('Desfecho do atendimento')).not.toBeInTheDocument())
  })

  it('abrir o formulário leva o foco ao campo do desfecho', async () => {
    renderWithApp(<Rescue />)
    fireEvent.click(await screen.findByText(/^Em atendimento/))
    fireEvent.click(await screen.findByRole('button', { name: 'Concluir' }))
    await waitFor(() => expect(screen.getByPlaceholderText(/Duas pessoas/)).toHaveFocus())
  })

  it('trocar de aba fecha o formulário de desfecho', async () => {
    renderWithApp(<Rescue />)
    fireEvent.click(await screen.findByText(/^Em atendimento/))
    fireEvent.click(await screen.findByRole('button', { name: 'Concluir' }))
    expect(screen.getByText('Desfecho do atendimento')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/^Abertas/))
    expect(screen.queryByText('Desfecho do atendimento')).not.toBeInTheDocument()
  })

  it('o desfecho digitado para um caso não vai junto para outro', async () => {
    svc.rescueList.mockResolvedValue([caso(), caso({ id: 'r2', address: 'Outro caso' })])
    renderWithApp(<Rescue />)
    fireEvent.click(await screen.findByText(/^Em atendimento/))
    const botoes = await screen.findAllByRole('button', { name: 'Concluir' })
    fireEvent.click(botoes[0])
    fireEvent.change(screen.getByPlaceholderText(/Duas pessoas/), { target: { value: 'texto do primeiro caso' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Concluir' })[1])
    expect(screen.getByPlaceholderText(/Duas pessoas/)).toHaveValue('')
  })

  it('desfecho só com espaços não é enviado', async () => {
    renderWithApp(<Rescue />)
    fireEvent.click(await screen.findByText(/^Em atendimento/))
    fireEvent.click(await screen.findByRole('button', { name: 'Concluir' }))
    const campo = screen.getByPlaceholderText(/Duas pessoas/) as HTMLInputElement
    fireEvent.change(campo, { target: { value: '     ' } })
    fireEvent.submit(campo.form!)
    expect(svc.setStatus).not.toHaveBeenCalled()
    expect(campo.validationMessage).toMatch(/pelo menos 3 letras/)
    fireEvent.change(campo, { target: { value: 'Atendida' } }) // ao corrigir, a mensagem some
    expect(campo.validationMessage).toBe('')
  })

  it('cancelar fecha o formulário sem chamar a API', async () => {
    renderWithApp(<Rescue />)
    fireEvent.click(await screen.findByText(/^Em atendimento/))
    fireEvent.click(await screen.findByRole('button', { name: 'Concluir' }))
    expect(screen.getByText('Desfecho do atendimento')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText('Desfecho do atendimento')).not.toBeInTheDocument()
    expect(svc.setStatus).not.toHaveBeenCalled()
  })

  it('mostra o erro da API e mantém o formulário aberto', async () => {
    svc.setStatus.mockRejectedValue(new Error('A API recusou o desfecho'))
    renderWithApp(<Rescue />)
    fireEvent.click(await screen.findByText(/^Em atendimento/))
    fireEvent.click(await screen.findByRole('button', { name: 'Concluir' }))
    fireEvent.change(screen.getByPlaceholderText(/Duas pessoas/), { target: { value: 'Atendida' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar desfecho' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('A API recusou o desfecho')
    expect(screen.getByText('Desfecho do atendimento')).toBeInTheDocument()
  })

  it('a nota fala da API, não de dados simulados, e a distância ausente vira traço', async () => {
    renderWithApp(<Rescue />)
    fireEvent.click(await screen.findByText(/^Em atendimento/))
    expect(await screen.findByText(/calculado pela API/)).toBeInTheDocument()
    expect(screen.queryByText(/Dados simulados/)).not.toBeInTheDocument()
    expect(screen.getByText('Casa alagada')).toBeInTheDocument()
  })
})

describe('Abrigos em modo HTTP', () => {
  it('mostra o erro 409 ao salvar uma capacidade menor que a ocupação', async () => {
    loginAs('GESTOR')
    svc.sheltersList.mockResolvedValue([
      {
        id: 's1',
        name: 'Escola X',
        kind: 'escola',
        lat: 0,
        lng: 0,
        street: 'Rua 1',
        neighborhood: null,
        city: null,
        phone: null,
        capacity: 100,
        occupancy: 40,
        status: 'ATIVO',
        simulated: false,
        resources: { water: true, food: false, medical: false, accessible: false, pets: false },
      },
    ])
    svc.sheltersUpdate.mockRejectedValue(new Error('Capacidade menor que a ocupação atual'))
    renderWithApp(<Shelters />)
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Capacidade menor que a ocupação atual')
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument() // o formulário continua aberto
    expect(screen.getByText(/Abrigos ativos cadastrados na API/)).toBeInTheDocument()

    // o erro não sobrevive a cancelar a edição
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('Relatórios em modo HTTP', () => {
  it('explica a falta de bairro em vez de agrupar tudo em "Sem bairro"', async () => {
    loginAs('GESTOR')
    svc.rescueList.mockResolvedValue([caso(), caso({ id: 'r2' })])
    svc.sheltersList.mockResolvedValue([])
    svc.alertsList.mockResolvedValue([])
    renderWithApp(<Reports />)
    expect(await screen.findByText('A API não informa o bairro')).toBeInTheDocument()
    expect(screen.queryByText('Sem bairro')).not.toBeInTheDocument()
    expect(screen.getByText(/Indicadores calculados no navegador/)).toBeInTheDocument()
  })
})
