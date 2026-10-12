import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { Shelter, ShelterCandidate, ShelterReviewQuery } from '@/domain/types'
import { loginAs, renderWithApp } from '@/test-utils'
import MapScreen from './MapScreen'

// O Leaflet precisa de um navegador de verdade; aqui as camadas viram contadores.
vi.mock('@/components/map', async () => {
  const { createElement } = await import('react')
  return {
    BaseMap: ({ children }: { children?: unknown }) => createElement('div', { 'data-testid': 'mapa' }, children as never),
    AlertLayer: () => null,
    HeatLayer: () => null,
    AlertHeatLayer: () => null,
    FitCircle: () => null,
    RescueLayer: () => null,
    ShelterLayer: ({ shelters, candidate }: { shelters: unknown[]; candidate?: boolean }) =>
      createElement('span', { 'data-testid': candidate ? 'candidatos-no-mapa' : 'abrigos-no-mapa' }, String(shelters.length)),
    SEVERITY_COLOR: { OBSERVACAO: '#1', ATENCAO: '#2', ALERTA: '#3', ALERTA_MAXIMO: '#4' },
  }
})

const api = { alerts: vi.fn(), shelters: vi.fn(), rescue: vi.fn(), review: vi.fn() }
vi.mock('@/services', () => ({
  useMocks: false,
  capabilities: { listUsers: false },
  services: {
    alerts: { list: (...a: unknown[]) => api.alerts(...a) },
    shelters: { list: (...a: unknown[]) => api.shelters(...a) },
    rescue: { list: (...a: unknown[]) => api.rescue(...a) },
    shelterReview: { list: (...a: unknown[]) => api.review(...a) },
  },
}))

const cadastrado = (over: Partial<Shelter> = {}): Shelter => ({
  id: 's1',
  name: 'Escola cadastrada',
  kind: 'escola',
  lat: -23.44,
  lng: -46.91,
  street: null,
  neighborhood: null,
  city: null,
  phone: null,
  capacity: 100,
  occupancy: 10,
  status: 'ATIVO',
  simulated: false,
  resources: { water: true, food: true, medical: false, accessible: false, pets: false },
  ...over,
})

const candidato = (n: number): ShelterCandidate => ({
  id: `c${String(n)}`,
  name: `Escola ${String(n)}`,
  address: 'Rua A, 1',
  lat: -23.44 - n / 1000,
  lng: -46.91,
  category: 'amenity=school',
  source: 'OSM',
  removedFromSource: false,
  status: 'CANDIDATE',
  capacity: 0,
  occupancy: 0,
  phone: null,
  resources: { water: false, food: false, medical: false, accessible: false, pets: false },
  reviewedAt: null,
  reviewNote: null,
})

/** Simula a API: `total` candidatos no banco, entregues na paginação que o painel pedir. */
const apiCom = (total: number) => async (q: ShelterReviewQuery) => ({
  items: Array.from({ length: Math.max(0, Math.min(q.limit, total - q.offset)) }, (_, i) => candidato(q.offset + i)),
  total,
})

const renderMap = () => renderWithApp(<MapScreen />)
const camada = () => screen.getByLabelText('Candidatos do OpenStreetMap (não oficiais)')

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
  api.alerts.mockResolvedValue([])
  api.shelters.mockResolvedValue([cadastrado()])
  api.rescue.mockResolvedValue([])
  api.review.mockImplementation(apiCom(3))
  loginAs('GESTOR')
})

describe('Mapa em modo HTTP: candidatos vindos da API', () => {
  it('a camada existe, começa desligada e não consulta a API enquanto ninguém liga', async () => {
    renderMap()
    expect(camada()).not.toBeChecked()
    await screen.findByTestId('abrigos-no-mapa')
    expect(api.review).not.toHaveBeenCalled()
    expect(screen.queryByTestId('candidatos-no-mapa')).not.toBeInTheDocument()
  })

  it('ao ligar, pede só os candidatos, mostra o carregamento, depois a camada e o crédito do OpenStreetMap', async () => {
    let soltar: (v: unknown) => void = () => undefined
    api.review.mockReturnValue(new Promise((resolve) => (soltar = resolve)))
    renderMap()
    await screen.findByTestId('abrigos-no-mapa')
    fireEvent.click(camada())
    expect(await screen.findByText('Carregando candidatos do OpenStreetMap...')).toBeInTheDocument()
    expect(screen.queryByText(/© colaboradores do OpenStreetMap/)).not.toBeInTheDocument()
    soltar({ items: [candidato(1), candidato(2)], total: 2 })
    expect(await screen.findByTestId('candidatos-no-mapa')).toHaveTextContent('2')
    const credito = screen.getByRole('link', { name: /© colaboradores do OpenStreetMap/ })
    expect(credito).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright')
    expect(credito).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(screen.getByText(/licença ODbL/)).toBeInTheDocument()
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument()
    expect(api.review).toHaveBeenCalledTimes(1)
    expect(api.review).toHaveBeenCalledWith({ status: 'CANDIDATE', limit: 200, offset: 0 })
  })

  it('busca em páginas de 200 até acabarem os candidatos', async () => {
    api.review.mockImplementation(apiCom(450))
    renderMap()
    await screen.findByTestId('abrigos-no-mapa')
    fireEvent.click(camada())
    expect(await screen.findByTestId('candidatos-no-mapa')).toHaveTextContent('450')
    expect(api.review.mock.calls.map(([q]) => (q as ShelterReviewQuery).offset)).toEqual([0, 200, 400])
  })

  it('para no teto de 2.000 e avisa quantos existem', async () => {
    api.review.mockImplementation(apiCom(5000))
    renderMap()
    await screen.findByTestId('abrigos-no-mapa')
    fireEvent.click(camada())
    expect(await screen.findByTestId('candidatos-no-mapa')).toHaveTextContent('2000')
    expect(api.review).toHaveBeenCalledTimes(10)
    expect(screen.getByText(/Mostrando 2\.000 de 5\.000 candidatos\./)).toBeInTheDocument()
  })

  it('desligar esconde a camada e ligar de novo não consulta outra vez', async () => {
    renderMap()
    await screen.findByTestId('abrigos-no-mapa')
    fireEvent.click(camada())
    await screen.findByTestId('candidatos-no-mapa')
    fireEvent.click(camada())
    expect(screen.queryByTestId('candidatos-no-mapa')).not.toBeInTheDocument()
    expect(screen.queryByText(/© colaboradores do OpenStreetMap/)).not.toBeInTheDocument()
    fireEvent.click(camada())
    expect(await screen.findByTestId('candidatos-no-mapa')).toHaveTextContent('3')
    expect(api.review).toHaveBeenCalledTimes(1)
  })

  it('se a consulta falha avisa no mapa, sem derrubar o resto, e ligar de novo tenta outra vez', async () => {
    api.review.mockRejectedValueOnce(new Error('A API não respondeu (503)')).mockImplementation(apiCom(1))
    renderMap()
    await screen.findByTestId('abrigos-no-mapa')
    fireEvent.click(camada())
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os candidatos: A API não respondeu (503)')
    expect(screen.getByTestId('abrigos-no-mapa')).toHaveTextContent('1')
    expect(screen.queryByText(/© colaboradores do OpenStreetMap/)).not.toBeInTheDocument()
    fireEvent.click(camada()) // desliga
    fireEvent.click(camada()) // liga de novo
    await waitFor(() => expect(screen.getByTestId('candidatos-no-mapa')).toHaveTextContent('1'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(api.review).toHaveBeenCalledTimes(2)
  })

  it('as outras camadas continuam funcionando e a dos candidatos não mexe nelas', async () => {
    renderMap()
    await screen.findByTestId('abrigos-no-mapa')
    fireEvent.click(screen.getByLabelText('Abrigos'))
    await waitFor(() => expect(screen.queryByTestId('abrigos-no-mapa')).not.toBeInTheDocument())
    fireEvent.click(camada())
    expect(await screen.findByTestId('candidatos-no-mapa')).toBeInTheDocument()
  })
})
