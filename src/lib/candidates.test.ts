import { describe, expect, it, vi } from 'vitest'
import type { ShelterCandidate, ShelterReviewQuery } from '@/domain/types'
import { CANDIDATE_PAGE, MAP_CANDIDATE_CAP, candidateToMapShelter, loadMapCandidates } from './candidates'

const candidato = (n: number, over: Partial<ShelterCandidate> = {}): ShelterCandidate => ({
  id: `c${String(n)}`,
  name: `Escola Municipal ${String(n)}`,
  address: 'Rua A, 1',
  lat: -23.4,
  lng: -46.9,
  category: 'amenity=school',
  source: 'OSM',
  removedFromSource: false,
  status: 'CANDIDATE',
  capacity: 0,
  occupancy: 0,
  phone: '1140000000',
  resources: { water: true, food: false, medical: false, accessible: true, pets: false },
  reviewedAt: null,
  reviewNote: null,
  ...over,
})

const comTotal = (total: number) =>
  vi.fn(async (q: ShelterReviewQuery) => ({
    items: Array.from({ length: Math.max(0, Math.min(q.limit, total - q.offset)) }, (_, i) => candidato(q.offset + i)),
    total,
  }))

describe('candidateToMapShelter', () => {
  it('vira um local sem capacidade, marcado como candidato, com o tipo tirado do nome', () => {
    expect(candidateToMapShelter(candidato(1))).toMatchObject({
      id: 'c1',
      kind: 'escola',
      street: 'Rua A, 1',
      phone: '1140000000',
      capacity: 0,
      occupancy: 0,
      status: 'CANDIDATO',
      simulated: false,
    })
  })

  it('endereço vazio vira nulo', () => {
    expect(candidateToMapShelter(candidato(1, { address: '' })).street).toBeNull()
  })
})

describe('loadMapCandidates', () => {
  it('uma página só quando cabe tudo, pedindo apenas candidatos', async () => {
    const list = comTotal(3)
    const r = await loadMapCandidates(list, null)
    expect(r.items).toHaveLength(3)
    expect(r.total).toBe(3)
    expect(list).toHaveBeenCalledTimes(1)
    expect(list).toHaveBeenCalledWith({ status: 'CANDIDATE', limit: CANDIDATE_PAGE, offset: 0 })
  })

  it('não pede página a mais quando o total fecha na página cheia', async () => {
    const list = comTotal(400)
    const r = await loadMapCandidates(list, null)
    expect(r.items).toHaveLength(400)
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('sem nenhum candidato devolve vazio com uma consulta', async () => {
    const list = comTotal(0)
    expect(await loadMapCandidates(list, null)).toEqual({ items: [], total: 0 })
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('respeita o teto e informa o total real', async () => {
    const list = comTotal(5000)
    const r = await loadMapCandidates(list, null)
    expect(r.items).toHaveLength(MAP_CANDIDATE_CAP)
    expect(r.total).toBe(5000)
    expect(list).toHaveBeenCalledTimes(MAP_CANDIDATE_CAP / CANDIDATE_PAGE)
  })

  it('o último pedido não passa do teto quando ele não é múltiplo da página', async () => {
    const list = comTotal(1000)
    const r = await loadMapCandidates(list, null, 250)
    expect(r.items).toHaveLength(250)
    expect(list).toHaveBeenLastCalledWith({ status: 'CANDIDATE', limit: 50, offset: 200 })
  })

  it('para se a API devolver menos do que o total prometido, sem ficar em laço', async () => {
    const list = vi.fn(async () => ({ items: [candidato(1)], total: 900 }))
    const r = await loadMapCandidates(list, null)
    expect(r.items).toHaveLength(1)
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('manda a área visível em todas as páginas, quando ela é informada', async () => {
    const area = { minLng: -47, minLat: -23.5, maxLng: -46.8, maxLat: -23.3 }
    const list = comTotal(450)
    await loadMapCandidates(list, area)
    expect(list).toHaveBeenCalledTimes(3)
    for (const [q] of list.mock.calls) expect(q.bbox).toEqual(area)
  })

  it('sem área não manda bbox', async () => {
    const list = comTotal(3)
    await loadMapCandidates(list, null)
    expect(list.mock.calls[0]?.[0]).not.toHaveProperty('bbox')
  })

  it('para de paginar quando a leitura é cancelada', async () => {
    const ctrl = new AbortController()
    const list = vi.fn(async (q: ShelterReviewQuery) => {
      ctrl.abort() // a área mudou enquanto a primeira página vinha
      return { items: Array.from({ length: q.limit }, (_, i) => candidato(q.offset + i)), total: 5000 }
    })
    await expect(loadMapCandidates(list, null, undefined, ctrl.signal)).rejects.toThrow()
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('propaga o erro da API', async () => {
    await expect(loadMapCandidates(() => Promise.reject(new Error('503')), null)).rejects.toThrow('503')
  })
})
