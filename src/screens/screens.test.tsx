import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useAuth } from '@/features/auth/store'
import { loginAs, renderWithApp } from '@/test-utils'
import Alerts from './Alerts'
import Audit from './Audit'
import Dashboard from './Dashboard'
import Login from './Login'
import MapScreen from './MapScreen'
import Reports from './Reports'
import Rescue from './Rescue'
import Shelters from './Shelters'
import Users from './Users'

// O Leaflet precisa de um navegador de verdade (medidas de tela). Aqui ele vira um espaço reservado
// e o mapa real é validado com o Playwright.
vi.mock('@/components/map', async () => {
  const { createElement } = await import('react')
  return {
    BaseMap: ({ children }: { children?: unknown }) => createElement('div', { 'data-testid': 'mapa' }, children as never),
    AlertLayer: () => null,
    HeatLayer: () => null,
    RescueLayer: () => null,
    ShelterLayer: ({ shelters }: { shelters: unknown[] }) => createElement('span', { 'data-testid': 'abrigos-no-mapa' }, String(shelters.length)),
    SEVERITY_COLOR: { OBSERVACAO: '#1', ATENCAO: '#2', ALERTA: '#3', ALERTA_MAXIMO: '#4' },
  }
})
vi.mock('react-leaflet', () => ({ Circle: () => null, useMapEvents: () => null }))

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  useAuth.setState({ user: null })
})

describe('Login', () => {
  it('entrar como gestor grava a sessão', async () => {
    renderWithApp(<Login />, { route: '/entrar' })
    expect(screen.getAllByRole('button')).toHaveLength(3)
    fireEvent.click(screen.getByText('Entrar como gestor municipal'))
    await waitFor(() => expect(useAuth.getState().user?.role).toBe('GESTOR'))
  })

  it('quem já entrou não vê a tela de login', () => {
    loginAs('AGENTE')
    renderWithApp(<Login />, { route: '/entrar' })
    expect(screen.queryByText('Entrar como gestor municipal')).not.toBeInTheDocument()
  })
})

describe('Painel', () => {
  it('mostra contadores, alertas, ocupação e a fila', async () => {
    loginAs('GESTOR')
    renderWithApp(<Dashboard />)
    expect(await screen.findByText('Maior: Alerta Máximo, Fazendinha')).toBeInTheDocument()
    expect(screen.getAllByText('Aceitar')).toHaveLength(3)
    expect(screen.getByText(/Crítico · /)).toBeInTheDocument()
    expect(await screen.findByText(/vagas livres de/)).toBeInTheDocument()
    expect(screen.getByText('Chuva intensa e risco de enchente, Fazendinha')).toBeInTheDocument()
  })

  it('aceitar uma solicitação tira o contador de abertas', async () => {
    loginAs('AGENTE')
    renderWithApp(<Dashboard />)
    const card = (await screen.findByText('Solicitações abertas')).parentElement!
    const valor = () => card.querySelector('.v')?.textContent ?? ''
    await waitFor(() => expect(valor()).toMatch(/^\d+$/))
    const before = Number(valor())
    fireEvent.click((await screen.findAllByText('Aceitar'))[0])
    await waitFor(() => expect(Number(valor())).toBe(before - 1))
  })
})

describe('Mapa', () => {
  it('liga e desliga as camadas', async () => {
    renderWithApp(<MapScreen />)
    const heat = screen.getByLabelText('Concentração de ocorrências')
    expect(heat).not.toBeChecked()
    fireEvent.click(heat)
    expect(heat).toBeChecked()
    fireEvent.click(screen.getByLabelText('Abrigos'))
    await waitFor(() => expect(screen.queryByTestId('abrigos-no-mapa')).not.toBeInTheDocument())
    expect(screen.getByText('Alerta Máximo')).toBeInTheDocument() // legenda
  })
})

describe('Socorro', () => {
  // vem primeiro: o teste seguinte conclui uma solicitação e o estado simulado fica em memória
  it('filtro sem resultado mostra estado vazio', async () => {
    loginAs('AGENTE')
    renderWithApp(<Rescue />)
    await screen.findByText(/Abertas · /)
    fireEvent.click(screen.getByText(/^Concluídas/))
    expect(await screen.findByText('Nada por aqui')).toBeInTheDocument()
  })

  it('lista as abertas, filtra por SOS e aceita uma solicitação', async () => {
    loginAs('AGENTE')
    renderWithApp(<Rescue />)
    expect((await screen.findAllByRole('button', { name: 'Aceitar' })).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText(/Somente SOS/))
    expect(screen.getAllByText('SOS').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText(/^Abertas/))
    const before = screen.getAllByRole('button', { name: 'Aceitar' }).length
    fireEvent.click(screen.getAllByRole('button', { name: 'Aceitar' })[0])
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Aceitar' })).toHaveLength(before - 1))
    fireEvent.click(screen.getByText(/^Em atendimento/))
    const concluir = (await screen.findAllByRole('button', { name: 'Concluir' }))[0]
    fireEvent.click(concluir)
    await waitFor(() => expect(screen.getByText(/Concluídas · 1/)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/^Concluídas/))
    expect(await screen.findByText('Atendida em campo')).toBeInTheDocument()
  })
})

describe('Abrigos', () => {
  it('busca, troca de aba, registra entrada e edita', async () => {
    loginAs('GESTOR')
    renderWithApp(<Shelters />)
    expect(await screen.findByText('Abrigos ativos · 7')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'zzzz' } })
    expect(await screen.findByText('Nenhum local encontrado')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: '' } })

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'escola' } })
    expect((await screen.findAllByRole('row')).length).toBeGreaterThan(1)
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'todos' } })

    const row = (await screen.findAllByRole('row'))[1]
    const occ = () => within(screen.getAllByRole('row')[1]).getByText(/\d+ \/ \d+/).textContent
    const antes = occ()
    fireEvent.click(within(row).getByRole('button', { name: /Registrar entrada/ }))
    await waitFor(() => expect(occ()).not.toBe(antes))

    fireEvent.click(within(screen.getAllByRole('row')[1]).getByRole('button', { name: 'Editar' }))
    expect(screen.getByText(/^Editar:/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Capacidade/), { target: { value: '321' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(screen.queryByText(/^Editar:/)).not.toBeInTheDocument())
    expect(within(screen.getAllByRole('row')[1]).getByText(/\/ 321/)).toBeInTheDocument()

    fireEvent.click(screen.getByText(/^Candidatos/))
    expect(await screen.findByText('Salão Paroquial')).toBeInTheDocument()
    expect(screen.getAllByText('Capacidade ainda não informada').length).toBeGreaterThan(0)
  })

  it('mostra erro quando o abrigo está lotado', async () => {
    loginAs('GESTOR')
    renderWithApp(<Shelters />)
    await screen.findByText('Abrigos ativos · 7')
    fireEvent.click(within((await screen.findAllByRole('row'))[1]).getByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByLabelText(/Capacidade/), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(screen.queryByText(/^Editar:/)).not.toBeInTheDocument())
    fireEvent.click(within(screen.getAllByRole('row')[1]).getByRole('button', { name: /Registrar entrada/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Abrigo lotado')
  })
})

describe('Alertas', () => {
  it('emite um alerta, limpa o formulário e encerra', async () => {
    loginAs('GESTOR')
    renderWithApp(<Alerts />)
    expect(await screen.findByText('Rajadas de vento')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Chuva forte no bairro' } })
    fireEvent.change(screen.getByLabelText('Bairro'), { target: { value: 'Centro' } })
    fireEvent.change(screen.getByLabelText('Severidade'), { target: { value: 'ALERTA' } })
    fireEvent.click(screen.getByRole('button', { name: 'Emitir alerta' }))
    expect(await screen.findByText('Chuva forte no bairro')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Descrição')).toHaveValue(''))

    const antes = screen.getAllByRole('button', { name: 'Encerrar' }).length
    fireEvent.click(screen.getAllByRole('button', { name: 'Encerrar' })[0])
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Encerrar' })).toHaveLength(antes - 1))
  })
})

describe('Relatórios', () => {
  it('mostra indicadores e exporta CSV', async () => {
    const createObjectURL = vi.fn(() => 'blob:fake')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    loginAs('GESTOR')
    renderWithApp(<Reports />)
    expect(await screen.findByText('Solicitações no período')).toBeInTheDocument()
    expect(screen.getByText('Fazendinha')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }))
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Imprimir ou salvar em PDF/ }))
    expect(print).toHaveBeenCalled()
  })
})

describe('Usuários e auditoria', () => {
  it('desativa um usuário e troca o perfil', async () => {
    loginAs('ADMIN')
    renderWithApp(<Users />)
    expect(await screen.findByText('Beatriz Nogueira')).toBeInTheDocument()
    const rowDe = (nome: string) => screen.getByText(nome).closest('tr')!
    expect(within(rowDe('Diego Arruda')).queryByRole('button')).not.toBeInTheDocument() // o próprio admin não se desativa
    expect(screen.getByLabelText('Perfil de Diego Arruda')).toBeDisabled()
    fireEvent.click(screen.getAllByRole('button', { name: 'Desativar' })[0])
    await waitFor(() => expect(screen.getAllByText('Desativado').length).toBeGreaterThan(1))
    fireEvent.change(screen.getByLabelText('Perfil de Renata Lopes'), { target: { value: 'GESTOR' } })
    await waitFor(() => expect(screen.getByLabelText('Perfil de Renata Lopes')).toHaveValue('GESTOR'))
  })

  it('auditoria lista os registros com hash encurtado', async () => {
    loginAs('ADMIN')
    renderWithApp(<Audit />)
    expect((await screen.findAllByText('Criou alerta')).length).toBeGreaterThan(0)
    const hash = screen.getAllByRole('row')[1].querySelectorAll('td')[6]
    expect(hash.textContent).toHaveLength(10)
  })
})
