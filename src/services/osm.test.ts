import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OSM_FIXTURE } from '@/test-fixtures/osm'
import { candidateToShelter, distanceKm, withoutRegistered, type OsmItem } from './osm'

const resposta = (ok: boolean, status = 200) => ({ ok, status, json: async () => OSM_FIXTURE })

// o carregador guarda a promessa no módulo: cada teste pega uma cópia nova
async function carregador() {
  vi.resetModules()
  return (await import('./osm')).loadOsmCandidates
}

describe('loadOsmCandidates', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => resposta(true)),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('fica só com candidatos a abrigo e tira ginásio de clube', async () => {
    const itens = await (await carregador())()
    const nomes = itens.map((i) => i.nome)
    expect(itens).toHaveLength(9) // 8 públicos e o salão paroquial
    expect(nomes).not.toContain('Clube Esportivo Particular')
    expect(nomes).not.toContain('UPA Fazendinha') // papel de apoio, não de abrigo
    expect(nomes).toContain('Salão Paroquial')
  })

  it('baixa o arquivo uma vez só, mesmo com várias chamadas', async () => {
    const load = await carregador()
    await Promise.all([load(), load()])
    await load()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('data/osm-sp-estado.json')
  })

  it('uma falha não fica guardada: a próxima chamada tenta de novo', async () => {
    const load = await carregador()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(resposta(false, 503)).mockResolvedValue(resposta(true)))
    await expect(load()).rejects.toThrow('Base de abrigos indisponível (503)')
    await expect(load()).resolves.toHaveLength(9)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('erro de rede também não fica guardado', async () => {
    const load = await carregador()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValue(resposta(true)))
    await expect(load()).rejects.toThrow('offline')
    await expect(load()).resolves.toHaveLength(9)
  })
})

describe('candidateToShelter', () => {
  const item: OsmItem = {
    osmId: 'w1',
    tipo: 'escola',
    papel: 'candidato_abrigo',
    nome: 'Escola X',
    lat: -23.4,
    lng: -46.9,
    rua: 'Rua A',
    bairro: 'Centro',
    cidade: 'Santana de Parnaíba',
    telefone: '1130000000',
  }
  it('vira um abrigo candidato, sem capacidade nem ocupação inventadas', () => {
    expect(candidateToShelter(item)).toMatchObject({
      id: 'w1',
      name: 'Escola X',
      kind: 'escola',
      lat: -23.4,
      lng: -46.9,
      street: 'Rua A',
      neighborhood: 'Centro',
      city: 'Santana de Parnaíba',
      phone: '1130000000',
      capacity: 0,
      occupancy: 0,
      status: 'CANDIDATO',
      simulated: true,
      resources: { water: false, food: false, medical: false, accessible: false, pets: false },
    })
  })
})

describe('tipo desconhecido', () => {
  it('um tipo novo no arquivo vira centro comunitário, para o popup nunca ficar sem rótulo', () => {
    const base = { osmId: 'x', papel: 'candidato_abrigo', nome: 'Local', lat: 0, lng: 0, rua: null, bairro: null, cidade: null, telefone: null }
    expect(candidateToShelter({ ...base, tipo: 'igreja' }).kind).toBe('centro_comunitario')
    for (const tipo of ['escola', 'ginasio_esportivo', 'centro_comunitario', 'assistencia_social']) {
      expect(candidateToShelter({ ...base, tipo }).kind).toBe(tipo)
    }
  })
})

describe('distanceKm e withoutRegistered', () => {
  it('mede distâncias curtas', () => {
    expect(distanceKm(-23.4, -46.9, -23.4, -46.9)).toBe(0)
    expect(distanceKm(-23.4, -46.9, -22.4, -46.9)).toBeCloseTo(111.2, 0) // um grau de latitude
    expect(distanceKm(-23.4, -46.9, -23.4, -46.89)).toBeGreaterThan(0.9) // 0,01 grau de longitude
  })

  const cand = (id: string, lat: number, lng: number) =>
    candidateToShelter({
      osmId: id,
      tipo: 'escola',
      papel: 'candidato_abrigo',
      nome: id,
      lat,
      lng,
      rua: null,
      bairro: null,
      cidade: null,
      telefone: null,
    })

  it('tira o candidato que é o mesmo ponto de um abrigo cadastrado e mantém os outros', () => {
    const lista = [cand('igual', -23.44, -46.91), cand('quase', -23.44, -46.9102), cand('longe', -23.5, -46.8)]
    const resto = withoutRegistered(lista, [{ lat: -23.44, lng: -46.91 }])
    expect(resto.map((c) => c.id)).toEqual(['longe'])
  })

  it('um candidato a 40 m do abrigo cadastrado continua na lista (são lugares diferentes)', () => {
    const lista = [cand('vizinho', -23.44036, -46.91)] // ~40 m ao sul
    expect(withoutRegistered(lista, [{ lat: -23.44, lng: -46.91 }])).toHaveLength(1)
  })

  it('o filtro rápido por latitude não deixa passar nem barra a mais: confere com a distância de verdade', () => {
    const abrigo = { lat: -23.44, lng: -46.91 }
    // 0,0002 grau de latitude são ~22 m: dentro do raio de 30 m
    expect(withoutRegistered([cand('dentro', -23.4402, -46.91)], [abrigo])).toHaveLength(0)
    // 0,0004 grau são ~44 m: fora
    expect(withoutRegistered([cand('fora', -23.4404, -46.91)], [abrigo])).toHaveLength(1)
    // só a longitude difere, ~10 m: dentro, mesmo com a latitude igual
    expect(withoutRegistered([cand('lado', -23.44, -46.9099)], [abrigo])).toHaveLength(0)
    // 0,000269 grau são ~29,9 m, colado no limite de 30 m: ainda dentro (pega um divisor errado no filtro rápido)
    expect(withoutRegistered([cand('colado', -23.440269, -46.91)], [abrigo])).toHaveLength(0)
    // a distância exatamente igual ao raio não conta como dentro (o limite é aberto)
    const exato = distanceKm(-23.44, -46.91, -23.4403, -46.91)
    expect(withoutRegistered([cand('exato', -23.4403, -46.91)], [abrigo], exato)).toHaveLength(1)
    // raio maior aceita mais coisa
    expect(withoutRegistered([cand('fora', -23.4404, -46.91)], [abrigo], 0.06)).toHaveLength(0)
  })

  it('aguenta 10 mil candidatos contra 200 abrigos com o resultado certo', () => {
    const candidatos = Array.from({ length: 10_000 }, (_, i) => cand('c' + i, -23 - (i % 100) * 0.01, -46 - Math.floor(i / 100) * 0.01))
    const abrigos = Array.from({ length: 200 }, (_, i) => ({ lat: -23 - (i % 100) * 0.01, lng: -46 - Math.floor(i / 100) * 0.01 })) // 200 coincidem com candidatos
    const resto = withoutRegistered(candidatos, abrigos)
    expect(resto).toHaveLength(9_800)
    expect(resto.some((c) => c.id === 'c0')).toBe(false)
  })

  it('sem abrigos cadastrados devolve a lista inteira', () => {
    const lista = [cand('a', 0, 0), cand('b', 1, 1)]
    expect(withoutRegistered(lista, [])).toBe(lista)
  })
})
