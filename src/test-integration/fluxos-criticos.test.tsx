/**
 * Testes de integração dos fluxos críticos do painel (TCC 3.3.3: 100% dos fluxos críticos em integração).
 * O painel roda inteiro, com o roteador, a sessão, as consultas, os serviços HTTP e o cliente com renovação de token.
 * Só a rede é simulada (src/test-integration/fakeApi.ts) e o mapa do Leaflet, que precisa de um navegador de verdade.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// precisa valer antes de qualquer import do painel: é aqui que ele escolhe falar com a API de verdade
vi.hoisted(() => {
  import.meta.env.VITE_USE_MOCKS = 'false'
})

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'
import { useAuth } from '@/features/auth/store'
import { router } from '@/routes'
import { browserTokens } from '@/services/http/session'
import { theme } from '@/theme'
import { newClient } from '@/test-utils'
import { alert, baseUser, installFakeApi, rescueRow, shelterRow, type FakeApi } from './fakeApi'

vi.mock('@/components/map', async () => {
  const { createElement } = await import('react')
  return {
    BaseMap: ({ children }: { children?: unknown }) => createElement('div', { 'data-testid': 'mapa' }, children as never),
    AlertLayer: () => null,
    HeatLayer: () => null,
    AlertHeatLayer: () => null,
    FitCircle: () => null,
    RescueLayer: () => null,
    ShelterLayer: () => null,
    SEVERITY_COLOR: { OBSERVACAO: '#1', ATENCAO: '#2', ALERTA: '#3', ALERTA_MAXIMO: '#4' },
  }
})
vi.mock('react-leaflet', () => ({ Circle: () => null, useMapEvents: () => null }))

let api: FakeApi

const agente = baseUser({ id: 'u-agente', name: 'Renata Lopes', phone: '+5511990000001', role: 'AGENTE' })
const gestor = baseUser({ id: 'u-gestor', name: 'Marcos Cavalcante', phone: '+5511990000002', role: 'GESTOR' })
const cidada = baseUser({ id: 'u-cid', name: 'Ana Souza', phone: '+5511990000003', role: 'CIDADAO' })

function app(client = newClient()) {
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>,
  )
}
const go = (to: string) => act(() => router.navigate(to))
const path = () => router.state.location.pathname

async function entrar(telefone: string, senha = 'senha-forte-1') {
  fireEvent.change(await screen.findByLabelText('Telefone'), { target: { value: telefone } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: senha } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

beforeEach(async () => {
  localStorage.clear()
  browserTokens.clear()
  useAuth.setState({ user: null })
  api = installFakeApi()
  api.users = {
    agente: { password: 'senha-forte-1', user: agente },
    gestor: { password: 'senha-forte-1', user: gestor },
    cidada: { password: 'senha-forte-1', user: cidada },
  }
  api.alerts = [alert()]
  api.shelters = [shelterRow()]
  api.rescue = [rescueRow()]
  await act(() => router.navigate('/entrar'))
})

afterEach(() => {
  useAuth.setState({ user: null })
  localStorage.clear()
  browserTokens.clear()
})

describe('Login com a API', () => {
  it('agente entra, vai para o painel e as chamadas seguintes levam o token', async () => {
    app()
    await entrar('(11) 99000-0001')

    await waitFor(() => expect(path()).toBe('/'))
    expect(api.calls('POST', '/auth/login')[0]?.body).toEqual({ phone: '+5511990000001', password: 'senha-forte-1' })
    expect(browserTokens.read()).toMatchObject({ accessToken: expect.stringMatching(/^acesso-/), refreshToken: expect.stringMatching(/^refresh-/) })
    expect(useAuth.getState().user).toMatchObject({ name: 'Renata Lopes', role: 'AGENTE' })

    await waitFor(() => expect(api.calls('GET', '/rescue').length).toBeGreaterThan(0))
    const chamada = api.calls('GET', '/rescue')[0]
    expect(chamada?.headers.authorization).toBe(`Bearer ${browserTokens.read()?.accessToken}`)
    expect(chamada?.headers['x-request-id']).toBeTruthy()
  })

  it('senha errada: mostra o motivo e não guarda sessão', async () => {
    app()
    await entrar('(11) 99000-0001', 'errada')

    expect(await screen.findByRole('alert')).toHaveTextContent('Telefone ou senha incorretos')
    expect(path()).toBe('/entrar')
    expect(browserTokens.read()).toBeNull()
    expect(useAuth.getState().user).toBeNull()
  })

  it('cidadã não usa o painel: é recusada e a sessão aberta é encerrada no servidor', async () => {
    app()
    await entrar('(11) 99000-0003')

    expect(await screen.findByRole('alert')).toHaveTextContent('Cidadãos acessam pelo aplicativo')
    expect(browserTokens.read()).toBeNull()
    expect(api.calls('POST', '/auth/logout')).toHaveLength(1)
    expect(api.calls('POST', '/auth/logout')[0]?.headers.authorization).toMatch(/^Bearer acesso-/)
    expect(api.validRefresh.size).toBe(0) // o refresh token que a API tinha emitido foi revogado
    expect(path()).toBe('/entrar')
  })

  it('sem rede: avisa que não há conexão', async () => {
    api.online = false
    app()
    await entrar('(11) 99000-0001')
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão com a API')
  })

  it('sem sessão, uma página protegida manda para o login', async () => {
    app()
    await go('/socorro')
    await waitFor(() => expect(path()).toBe('/entrar'))
  })
})

describe('Renovação de token', () => {
  async function logado() {
    const client = newClient()
    app(client)
    await entrar('(11) 99000-0001')
    await waitFor(() => expect(path()).toBe('/'))
    await waitFor(() => expect(api.calls('GET', '/rescue').length).toBeGreaterThan(0))
    await waitFor(() => expect(api.calls('GET', '/alerts').length).toBeGreaterThan(0))
    await waitFor(() => expect(api.calls('GET', '/shelters').length).toBeGreaterThan(0))
    return client
  }

  it('token de acesso vencido: várias consultas falham ao mesmo tempo, renova uma vez só e repete todas', async () => {
    const client = await logado()
    const refreshAntes = api.calls('POST', '/auth/refresh').length
    const antigo = browserTokens.read()?.accessToken
    const getsAntes = api.requests.filter((r) => r.method === 'GET').length

    api.validAccess.clear() // o servidor passa a recusar o token que o painel tem
    await act(() => client.invalidateQueries()) // as três listas do painel recarregam juntas

    await waitFor(() => expect(browserTokens.read()?.accessToken).not.toBe(antigo))
    expect(api.calls('POST', '/auth/refresh').length - refreshAntes).toBe(1)
    // cada lista foi pedida de novo com o token novo depois do 401
    const depois = api.requests.filter((r) => r.method === 'GET').slice(getsAntes)
    const novo = `Bearer ${browserTokens.read()?.accessToken}`
    expect(depois.filter((r) => r.headers.authorization === novo).length).toBeGreaterThanOrEqual(3)
    expect(useAuth.getState().user).not.toBeNull()
  })

  it('a renovação mantém quem está logado (gestor continua gestor)', async () => {
    const client = newClient()
    app(client)
    await entrar('(11) 99000-0002')
    await waitFor(() => expect(path()).toBe('/'))
    await waitFor(() => expect(api.calls('GET', '/alerts').length).toBeGreaterThan(0))
    api.validAccess.clear()
    await act(() => client.invalidateQueries())
    await waitFor(() => expect(api.calls('POST', '/auth/refresh')).toHaveLength(1))
    const novo = browserTokens.read()?.refreshToken
    expect(novo).toBeTruthy()
    expect(api.refreshOwner.get(novo as string)?.role).toBe('GESTOR')
    expect(useAuth.getState().user?.role).toBe('GESTOR')
    await go('/alertas') // a tela de gestor continua liberada
    expect(await screen.findByLabelText('Descrição')).toBeInTheDocument()
  })

  it('refresh token recusado: a sessão acaba e volta para o login', async () => {
    const client = await logado()
    api.validAccess.clear()
    api.validRefresh.clear()
    await act(() => client.invalidateQueries())

    await waitFor(() => expect(path()).toBe('/entrar'))
    expect(browserTokens.read()).toBeNull()
    expect(useAuth.getState().user).toBeNull()
  })
})

describe('Fila de socorro (agente)', () => {
  it('lista as solicitações e aceitar avisa a API com o status certo', async () => {
    app()
    await entrar('(11) 99000-0001')
    await waitFor(() => expect(path()).toBe('/'))
    await go('/socorro')

    expect(await screen.findByText('Pessoa ferida')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Aceitar' })[0] as HTMLElement)

    await waitFor(() => expect(api.calls('PATCH', '/rescue/r1/status')).toHaveLength(1))
    expect(api.calls('PATCH', '/rescue/r1/status')[0]?.body).toEqual({ status: 'ASSIGNED' })
    expect(api.rescue[0]?.status).toBe('ASSIGNED')
  })

  it('outro agente já pegou o caso (409): mostra o motivo e a solicitação continua como estava', async () => {
    app()
    await entrar('(11) 99000-0001')
    await waitFor(() => expect(path()).toBe('/'))
    await go('/socorro')
    await screen.findByText('Pessoa ferida')
    api.failNext.push({
      method: 'PATCH',
      path: '/rescue/r1/status',
      status: 409,
      detail: 'Solicitação já foi aceita por outro agente',
      code: 'CONFLICT',
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Aceitar' })[0] as HTMLElement)
    expect(await screen.findByRole('alert')).toHaveTextContent('já foi aceita por outro agente')
    expect(screen.getByText('Pessoa ferida')).toBeInTheDocument() // a linha não sumiu
    expect(api.rescue[0]?.status).toBe('PENDING')
    expect(screen.getAllByRole('button', { name: 'Aceitar' })[0]).toBeEnabled() // dá para tentar de novo
  })
})

describe('Emitir alerta (gestor)', () => {
  it('preenche o formulário, emite com o raio escolhido e o alerta aparece na lista', async () => {
    app()
    await entrar('(11) 99000-0002')
    await waitFor(() => expect(path()).toBe('/'))
    await go('/alertas')

    await screen.findByLabelText('Descrição')
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Chuva forte com risco de enchente' } })
    fireEvent.change(screen.getByLabelText('Bairro'), { target: { value: 'Fazendinha' } })
    fireEvent.change(screen.getByLabelText('Severidade'), { target: { value: 'ALERTA_MAXIMO' } })
    fireEvent.change(screen.getByLabelText('Raio exato em quilômetros'), { target: { value: '12,5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Emitir alerta' }))

    await waitFor(() => expect(api.calls('POST', '/alerts')).toHaveLength(1))
    expect(api.calls('POST', '/alerts')[0]?.body).toMatchObject({
      title: 'Chuva forte com risco de enchente',
      level: 'ALERTA_MAXIMO',
      radiusMeters: 12500,
      city: 'Santana de Parnaíba',
      state: 'SP',
    })
    expect(api.calls('POST', '/alerts')[0]?.headers.authorization).toMatch(/^Bearer acesso-/)
    const lista = screen.getByRole('region', { name: 'Alertas' })
    expect(await within(lista).findByText('Chuva forte com risco de enchente')).toBeInTheDocument()
  })

  it('raio fora do limite é corrigido antes de enviar; texto inválido bloqueia o envio', async () => {
    app()
    await entrar('(11) 99000-0002')
    await waitFor(() => expect(path()).toBe('/'))
    await go('/alertas')
    await screen.findByLabelText('Descrição')

    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Vento forte no bairro' } })
    fireEvent.change(screen.getByLabelText('Bairro'), { target: { value: 'Centro' } })
    fireEvent.change(screen.getByLabelText('Raio exato em quilômetros'), { target: { value: '900' } })
    fireEvent.click(screen.getByRole('button', { name: 'Emitir alerta' }))
    await waitFor(() => expect(api.calls('POST', '/alerts')).toHaveLength(1))
    expect((api.calls('POST', '/alerts')[0]?.body as { radiusMeters: number }).radiusMeters).toBe(50000)

    fireEvent.change(screen.getByLabelText('Raio exato em quilômetros'), { target: { value: 'abc' } })
    expect(screen.getByRole('button', { name: 'Emitir alerta' })).toBeDisabled()
  })

  it('agente não acessa a tela de alertas', async () => {
    app()
    await entrar('(11) 99000-0001')
    await waitFor(() => expect(path()).toBe('/'))
    await go('/alertas')
    await waitFor(() => expect(path()).toBe('/'))
    expect(screen.queryByLabelText('Descrição')).not.toBeInTheDocument()
    expect(api.calls('POST', '/alerts')).toHaveLength(0)
  })
})

describe('Abrigos (agente)', () => {
  async function abrirEdicao() {
    app()
    await entrar('(11) 99000-0001')
    await waitFor(() => expect(path()).toBe('/'))
    await go('/abrigos')
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    return screen.findByLabelText('Capacidade (pessoas)')
  }

  it('aumentar a capacidade salva na API e a lista mostra o novo valor', async () => {
    const campo = await abrirEdicao()
    fireEvent.change(campo, { target: { value: '150' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(api.calls('PATCH', '/shelters/s1')).toHaveLength(1))
    expect(api.calls('PATCH', '/shelters/s1')[0]?.body).toMatchObject({ capacity: 150 })
    expect(api.shelters[0]?.capacity).toBe(150)
    // e a tela mostra o valor novo (a lista foi recarregada pela API, não só alterada em memória)
    await waitFor(() => expect(screen.getByRole('table')).toHaveTextContent(/150/))
    await waitFor(() => expect(api.calls('GET', '/shelters').length).toBeGreaterThan(1))
  })

  it('capacidade abaixo da ocupação: a API recusa (409) e a tela mostra o motivo', async () => {
    const campo = await abrirEdicao()
    fireEvent.change(campo, { target: { value: '10' } }) // há 30 pessoas no abrigo
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(api.calls('PATCH', '/shelters/s1')).toHaveLength(1))
    expect(await screen.findByRole('alert')).toHaveTextContent('capacidade não pode ficar abaixo da ocupação')
    expect(api.shelters[0]?.capacity).toBe(100)
  })
})
