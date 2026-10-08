import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { Alert } from '@/domain/types'
import { ALERTS } from '@/mocks/seed'
import { loginAs, renderWithApp } from '@/test-utils'
import Alerts from './Alerts'

// O Leaflet precisa de um navegador de verdade; aqui o mapa vira um espaço reservado.
vi.mock('@/components/map', async () => {
  const { createElement } = await import('react')
  return {
    BaseMap: ({ children }: { children?: unknown }) => createElement('div', { 'data-testid': 'mapa' }, children as never),
    AlertLayer: () => null,
    SEVERITY_COLOR: { OBSERVACAO: '#1', ATENCAO: '#2', ALERTA: '#3', ALERTA_MAXIMO: '#4' },
  }
})
vi.mock('react-leaflet', () => ({ Circle: () => null, useMapEvents: () => null }))

// Simula VITE_USE_MOCKS=false, com a API respondendo por funções que cada teste controla.
const api = { list: vi.fn(), create: vi.fn(), close: vi.fn() }
vi.mock('@/services', () => ({
  useMocks: false,
  capabilities: { listUsers: false },
  services: {
    alerts: { list: (...a: unknown[]) => api.list(...a), create: (...a: unknown[]) => api.create(...a), close: (...a: unknown[]) => api.close(...a) },
  },
}))

// Parte de um alerta do seed (a geometria não importa aqui) e sobrescreve o que o teste precisa.
const alerta = (over: Partial<Alert> = {}): Alert => ({
  ...ALERTS[0],
  id: 'a1',
  title: 'Chuva intensa no centro',
  severity: 'ALERTA',
  neighborhood: 'Centro',
  expiresAt: null,
  active: true,
  source: 'MANUAL',
  ...over,
})
const encerrado = (a: Alert): Alert => ({ ...a, active: false })

/** Uma promessa que o teste resolve ou rejeita na hora que quiser, para olhar a tela com a chamada em andamento. */
function pendente<T>() {
  let ok: (v: T) => void = () => undefined
  let falha: (e: Error) => void = () => undefined
  const promessa = new Promise<T>((resolve, reject) => {
    ok = resolve
    falha = reject
  })
  return { promessa, ok, falha }
}

const formulario = () => screen.getByRole('region', { name: 'Novo alerta' })
const lista = () => screen.getByRole('region', { name: 'Alertas' })

function preencher(titulo = 'Chuva forte no bairro', bairro = 'Fazendinha') {
  fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: titulo } })
  fireEvent.change(screen.getByLabelText('Bairro'), { target: { value: bairro } })
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
  api.list.mockResolvedValue([alerta()])
  loginAs('GESTOR')
})

describe('Alertas em modo HTTP: emitir', () => {
  it('envia os dados do formulário, mostra o alerta novo na lista e limpa os campos de texto', async () => {
    const novo = alerta({ id: 'novo', title: 'Chuva forte no bairro', neighborhood: 'Fazendinha', severity: 'ALERTA_MAXIMO' })
    api.create.mockResolvedValue(novo)
    renderWithApp(<Alerts />)
    await within(lista()).findByText('Chuva intensa no centro')
    preencher()
    fireEvent.change(screen.getByLabelText('Severidade'), { target: { value: 'ALERTA_MAXIMO' } })
    api.list.mockResolvedValue([novo, alerta()]) // o que a API devolve depois de criar
    fireEvent.click(screen.getByRole('button', { name: 'Emitir alerta' }))

    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1))
    expect(api.create.mock.calls[0][0]).toMatchObject({
      title: 'Chuva forte no bairro',
      neighborhood: 'Fazendinha',
      severity: 'ALERTA_MAXIMO',
      hours: 6,
      radiusKm: 1.2,
    })
    expect(await within(lista()).findByText('Chuva forte no bairro')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Descrição')).toHaveValue(''))
    expect(screen.getByLabelText('Bairro')).toHaveValue('')
    expect(screen.getByLabelText('Duração (horas)')).toHaveValue(6)
    expect(screen.getByLabelText('Severidade')).toHaveValue('ALERTA_MAXIMO') // a severidade escolhida fica para o próximo alerta
  })

  it('durante o envio o botão fica desabilitado e um segundo clique não emite de novo', async () => {
    const envio = pendente<Alert>()
    api.create.mockReturnValue(envio.promessa)
    renderWithApp(<Alerts />)
    await screen.findByText('Chuva intensa no centro')
    preencher()
    fireEvent.click(screen.getByRole('button', { name: 'Emitir alerta' }))
    const botao = await screen.findByRole('button', { name: 'Emitindo...' })
    expect(botao).toBeDisabled()
    fireEvent.click(botao)
    expect(api.create).toHaveBeenCalledTimes(1)
    envio.ok(alerta({ id: 'novo' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Emitir alerta' })).toBeEnabled())
  })

  it('erro ao emitir aparece só no painel do formulário, mantém o que foi digitado e o alerta não entra na lista', async () => {
    api.create.mockRejectedValue(new Error('Dados inválidos description: muito curta'))
    renderWithApp(<Alerts />)
    await within(lista()).findByText('Chuva intensa no centro')
    preencher()
    fireEvent.click(screen.getByRole('button', { name: 'Emitir alerta' }))

    expect(await within(formulario()).findByRole('alert')).toHaveTextContent('Dados inválidos description: muito curta')
    expect(within(lista()).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(lista()).queryByText('Chuva forte no bairro')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Descrição')).toHaveValue('Chuva forte no bairro')
    expect(screen.getByLabelText('Bairro')).toHaveValue('Fazendinha')
    expect(screen.getByRole('button', { name: 'Emitir alerta' })).toBeEnabled()
  })

  it('o erro de emitir some quando a nova tentativa dá certo e o alerta novo aparece na lista', async () => {
    const novo = alerta({ id: 'novo', title: 'Chuva forte no bairro' })
    api.create.mockRejectedValueOnce(new Error('A API caiu')).mockResolvedValue(novo)
    renderWithApp(<Alerts />)
    await screen.findByText('Chuva intensa no centro')
    preencher()
    fireEvent.click(screen.getByRole('button', { name: 'Emitir alerta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('A API caiu')
    api.list.mockResolvedValue([novo, alerta()])
    fireEvent.click(screen.getByRole('button', { name: 'Emitir alerta' }))
    expect(await within(lista()).findByText('Chuva forte no bairro')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(api.create).toHaveBeenCalledTimes(2)
  })
})

describe('Alertas em modo HTTP: encerrar', () => {
  it('chama a API com o id e o alerta passa a Encerrado, sem botão', async () => {
    api.close.mockResolvedValue(undefined)
    renderWithApp(<Alerts />)
    const botao = await within(lista()).findByRole('button', { name: 'Encerrar' })
    api.list.mockResolvedValue([encerrado(alerta())]) // o que a API devolve depois de encerrar
    fireEvent.click(botao)
    await waitFor(() => expect(api.close).toHaveBeenCalled())
    expect(api.close.mock.calls[0][0]).toBe('a1')
    expect(await within(lista()).findByText('Encerrado')).toBeInTheDocument()
    expect(within(lista()).queryByRole('button', { name: 'Encerrar' })).not.toBeInTheDocument()
  })

  it('durante o encerramento o botão fica desabilitado e um segundo clique não chama a API de novo', async () => {
    const fim = pendente<undefined>()
    api.close.mockReturnValue(fim.promessa)
    renderWithApp(<Alerts />)
    const botao = await within(lista()).findByRole('button', { name: 'Encerrar' })
    fireEvent.click(botao)
    await waitFor(() => expect(botao).toBeDisabled())
    fireEvent.click(botao)
    expect(api.close).toHaveBeenCalledTimes(1)
    api.list.mockResolvedValue([encerrado(alerta())])
    fim.ok(undefined)
    expect(await within(lista()).findByText('Encerrado')).toBeInTheDocument()
    expect(api.close).toHaveBeenCalledTimes(1)
  })

  it('erro ao encerrar aparece só no painel da lista, não mexe no formulário e o botão volta', async () => {
    api.close.mockRejectedValue(new Error('Alerta não encontrado'))
    renderWithApp(<Alerts />)
    preencher('Texto que fica', 'Bairro que fica')
    fireEvent.click(await within(lista()).findByRole('button', { name: 'Encerrar' }))

    expect(await within(lista()).findByRole('alert')).toHaveTextContent('Alerta não encontrado')
    expect(within(formulario()).queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Descrição')).toHaveValue('Texto que fica')
    expect(screen.getByLabelText('Bairro')).toHaveValue('Bairro que fica')
    await waitFor(() => expect(within(lista()).getByRole('button', { name: 'Encerrar' })).toBeEnabled())
  })

  it('os dois erros convivem, cada um no seu painel, sem um esconder o outro', async () => {
    api.create.mockRejectedValue(new Error('Falha ao emitir'))
    api.close.mockRejectedValue(new Error('Falha ao encerrar'))
    renderWithApp(<Alerts />)
    preencher()
    fireEvent.click(await within(lista()).findByRole('button', { name: 'Encerrar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Emitir alerta' }))
    expect(await within(formulario()).findByRole('alert')).toHaveTextContent('Falha ao emitir')
    expect(await within(lista()).findByRole('alert')).toHaveTextContent('Falha ao encerrar')
  })
})

describe('Alertas em modo HTTP: a lista', () => {
  it('cada alerta mostra os seus próprios estados: sem prazo e encerrado', async () => {
    api.list.mockResolvedValue([alerta(), encerrado(alerta({ id: 'a2', title: 'Alerta antigo' }))])
    renderWithApp(<Alerts />)
    const antigo = await within(lista()).findByRole('row', { name: /Alerta antigo/ })
    expect(within(antigo).getByText('Encerrado')).toBeInTheDocument()
    expect(within(antigo).getByText(/sem prazo/)).toBeInTheDocument()
    expect(within(antigo).queryByRole('button', { name: 'Encerrar' })).not.toBeInTheDocument()
    const ativo = within(lista()).getByRole('row', { name: /Chuva intensa no centro/ })
    expect(within(ativo).getByRole('button', { name: 'Encerrar' })).toBeInTheDocument()
  })

  it('lista vazia mostra o aviso', async () => {
    api.list.mockResolvedValue([])
    renderWithApp(<Alerts />)
    expect(await within(lista()).findByText('Nenhum alerta')).toBeInTheDocument()
  })

  it('falha ao carregar a lista mostra o erro da API no painel da lista', async () => {
    api.list.mockRejectedValue(new Error('A API está fora do ar'))
    renderWithApp(<Alerts />)
    expect(await within(lista()).findByRole('alert')).toHaveTextContent('A API está fora do ar')
  })

  it('enquanto a lista carrega mostra o esqueleto, sem aviso de vazio nem de erro', async () => {
    const carga = pendente<Alert[]>()
    api.list.mockReturnValue(carga.promessa)
    renderWithApp(<Alerts />)
    expect(await within(lista()).findByLabelText('Carregando')).toBeInTheDocument()
    expect(within(lista()).queryByText('Nenhum alerta')).not.toBeInTheDocument()
    expect(within(lista()).queryByRole('alert')).not.toBeInTheDocument()
    carga.ok([alerta()])
    expect(await within(lista()).findByText('Chuva intensa no centro')).toBeInTheDocument()
    expect(within(lista()).queryByLabelText('Carregando')).not.toBeInTheDocument()
  })
})
