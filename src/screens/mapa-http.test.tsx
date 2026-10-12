import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import type { Bbox, Shelter, ShelterCandidate, ShelterReviewQuery } from '@/domain/types'
import { snapBbox, toBboxParam } from '@/lib/bbox'
import { loginAs, renderWithApp } from '@/test-utils'
import MapScreen from './MapScreen'

// A área que o mapa "enxerga": o teste a move chamando `view.emit`, como o Leaflet faria ao terminar de arrastar.
const view = vi.hoisted(() => ({
  emit: null as ((b: Bbox) => void) | null,
  initial: { minLng: -46.993, minLat: -23.547, maxLng: -46.803, maxLat: -23.353 } as Bbox,
}))

// O Leaflet precisa de um navegador de verdade; aqui as camadas viram contadores.
vi.mock('@/components/map', async () => {
  const { createElement, useEffect } = await import('react')
  function BaseMap({ children, onBounds }: { children?: unknown; onBounds?: (b: Bbox) => void }) {
    view.emit = onBounds ?? null
    useEffect(() => onBounds?.(view.initial), []) // eslint-disable-line react-hooks/exhaustive-deps
    return createElement('div', { 'data-testid': 'mapa' }, children as never)
  }
  return {
    BaseMap,
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
    expect(api.review).toHaveBeenCalledWith({ status: 'CANDIDATE', limit: 200, offset: 0, bbox: snapBbox(view.initial) })
  })

  it('pede só a área visível, alargada, no formato da API', async () => {
    renderMap()
    await screen.findByTestId('abrigos-no-mapa')
    fireEvent.click(camada())
    await screen.findByTestId('candidatos-no-mapa')
    const bbox = (api.review.mock.calls[0]?.[0] as ShelterReviewQuery).bbox as Bbox
    expect(bbox.minLng).toBeLessThan(view.initial.minLng)
    expect(bbox.maxLat).toBeGreaterThan(view.initial.maxLat)
    expect(toBboxParam(bbox)).toMatch(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/)
  })

  it('mexer pouco no mapa não consulta de novo, mas ir para outra região consulta', async () => {
    renderMap()
    await screen.findByTestId('abrigos-no-mapa')
    fireEvent.click(camada())
    await screen.findByTestId('candidatos-no-mapa')
    expect(api.review).toHaveBeenCalledTimes(1)

    act(() => view.emit?.({ minLng: -46.995, minLat: -23.549, maxLng: -46.805, maxLat: -23.355 })) // arrasto de ~200 m
    await screen.findByTestId('candidatos-no-mapa')
    expect(api.review).toHaveBeenCalledTimes(1)

    act(() => view.emit?.({ minLng: -46.5, minLat: -23.547, maxLng: -46.31, maxLat: -23.353 })) // outra região
    await waitFor(() => expect(api.review).toHaveBeenCalledTimes(2))
    const second = (api.review.mock.calls[1]?.[0] as ShelterReviewQuery).bbox as Bbox
    expect(second.minLng).toBeGreaterThan(-46.7)
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
    expect(screen.getByText(/Mostrando 2\.000 de 5\.000 candidatos nesta área\. Aproxime o mapa/)).toBeInTheDocument()
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
