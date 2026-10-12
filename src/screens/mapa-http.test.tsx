import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { Shelter } from '@/domain/types'
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

const api = { alerts: vi.fn(), shelters: vi.fn(), rescue: vi.fn(), osm: vi.fn() }
vi.mock('@/services', () => ({
  useMocks: false,
  capabilities: { listUsers: false },
  services: {
    alerts: { list: (...a: unknown[]) => api.alerts(...a) },
    shelters: { list: (...a: unknown[]) => api.shelters(...a) },
    rescue: { list: (...a: unknown[]) => api.rescue(...a) },
  },
}))
// o download do OpenStreetMap (3 MB) é controlado pelo teste; o resto do módulo é o de verdade
vi.mock('@/services/osm', async (original) => ({
  ...(await original<typeof import('@/services/osm')>()),
  loadOsmCandidates: (...a: unknown[]) => api.osm(...a),
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

const item = (osmId: string, lat: number, lng: number) => ({
  osmId,
  tipo: 'escola',
  papel: 'candidato_abrigo',
  nome: `Escola ${osmId}`,
  lat,
  lng,
  rua: null,
  bairro: null,
  cidade: null,
  telefone: null,
})

const renderMap = () => renderWithApp(<MapScreen />)
const camada = () => screen.getByLabelText('Candidatos do OpenStreetMap (não oficiais)')

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
  api.alerts.mockResolvedValue([])
  api.shelters.mockResolvedValue([cadastrado()])
  api.rescue.mockResolvedValue([])
  api.osm.mockResolvedValue([item('w1', -23.44, -46.91), item('w2', -23.5, -46.8), item('w3', -23.6, -46.7)])
  loginAs('GESTOR')
})

describe('Mapa em modo HTTP: candidatos do OpenStreetMap', () => {
  it('a camada existe, começa desligada e não baixa o arquivo enquanto ninguém liga', async () => {
    renderMap()
    expect(camada()).not.toBeChecked()
    await screen.findByTestId('abrigos-no-mapa')
    expect(api.osm).not.toHaveBeenCalled()
    expect(screen.queryByTestId('candidatos-no-mapa')).not.toBeInTheDocument()
  })

  it('ao ligar, baixa uma vez, mostra o carregamento, depois os candidatos e o crédito do OpenStreetMap', async () => {
    let soltar: (v: unknown[]) => void = () => undefined
    api.osm.mockReturnValue(new Promise((resolve) => (soltar = resolve)))
    renderMap()
    await screen.findByTestId('abrigos-no-mapa')
    fireEvent.click(camada())
    expect(await screen.findByText('Carregando candidatos do OpenStreetMap...')).toBeInTheDocument()
    expect(screen.queryByText(/© colaboradores do OpenStreetMap/)).not.toBeInTheDocument()
    soltar([item('w1', -23.44, -46.91), item('w2', -23.5, -46.8)])
    expect(await screen.findByTestId('candidatos-no-mapa')).toBeInTheDocument()
    const credito = screen.getByRole('link', { name: /© colaboradores do OpenStreetMap/ })
    expect(credito).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright')
    expect(credito).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(screen.getByText(/licença ODbL/)).toBeInTheDocument()
    expect(screen.queryByText('Carregando candidatos do OpenStreetMap...')).not.toBeInTheDocument()
    expect(api.osm).toHaveBeenCalledTimes(1)
  })

  it('o candidato no mesmo ponto de um abrigo cadastrado não aparece duas vezes', async () => {
    renderMap()
    await screen.findByTestId('abrigos-no-mapa')
    fireEvent.click(camada())
    expect(await screen.findByTestId('candidatos-no-mapa')).toHaveTextContent('2') // w1 é o abrigo cadastrado
    expect(screen.getByTestId('abrigos-no-mapa')).toHaveTextContent('1')
  })

  it('desligar esconde a camada e ligar de novo não baixa outra vez', async () => {
    renderMap()
    await screen.findByTestId('abrigos-no-mapa')
    fireEvent.click(camada())
    await screen.findByTestId('candidatos-no-mapa')
    fireEvent.click(camada())
    expect(screen.queryByTestId('candidatos-no-mapa')).not.toBeInTheDocument()
    expect(screen.queryByText(/© colaboradores do OpenStreetMap/)).not.toBeInTheDocument()
    fireEvent.click(camada())
    expect(await screen.findByTestId('candidatos-no-mapa')).toHaveTextContent('2')
    expect(api.osm).toHaveBeenCalledTimes(1)
  })

  it('se o download falha avisa no mapa, sem derrubar o resto, e ligar de novo tenta outra vez', async () => {
    api.osm.mockRejectedValueOnce(new Error('Base de abrigos indisponível (503)')).mockResolvedValue([item('w2', -23.5, -46.8)])
    renderMap()
    await screen.findByTestId('abrigos-no-mapa')
    fireEvent.click(camada())
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os candidatos: Base de abrigos indisponível (503)')
    expect(screen.getByTestId('abrigos-no-mapa')).toHaveTextContent('1')
    expect(screen.queryByText(/© colaboradores do OpenStreetMap/)).not.toBeInTheDocument()
    fireEvent.click(camada()) // desliga
    fireEvent.click(camada()) // liga de novo
    await waitFor(() => expect(screen.getByTestId('candidatos-no-mapa')).toHaveTextContent('1'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(api.osm).toHaveBeenCalledTimes(2)
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
