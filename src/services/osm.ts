import type { Shelter, ShelterKind } from '@/domain/types'

/** Um item de public/data/osm-sp-estado.json (locais do OpenStreetMap, © colaboradores, licença ODbL). */
export interface OsmItem {
  osmId: string
  tipo: string
  papel: string
  nome: string
  lat: number
  lng: number
  rua: string | null
  bairro: string | null
  cidade: string | null
  telefone: string | null
}

/** Ginásios de clubes e academias não servem de abrigo. */
export const PRIVATE = /clube|academia|pilates|crossfit|kart|natação|society|arena|spa\b|studio|jiu|muay|dança/i
export const PUBLIC = /municipal|estadual|emef|emei|emeb|\bee\b|\bceu\b|etec|fatec|ginásio|poliesportivo|centro (esportivo|comunit|de atividades)/i

let cache: Promise<OsmItem[]> | null = null

/**
 * Candidatos a abrigo do arquivo estático (~3 MB). Baixa uma vez e guarda a promessa.
 * Se o download falhar, a falha não fica guardada: a próxima chamada tenta de novo.
 */
export function loadOsmCandidates(): Promise<OsmItem[]> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/osm-sp-estado.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`Base de abrigos indisponível (${r.status})`)
      return r.json() as Promise<{ itens: OsmItem[] }>
    })
    .then(({ itens }) => itens.filter((o) => o.papel === 'candidato_abrigo' && !(o.tipo === 'ginasio_esportivo' && PRIVATE.test(o.nome))))
    .catch((e: unknown) => {
      cache = null
      throw e
    })
  return cache
}

const KINDS: readonly ShelterKind[] = ['escola', 'ginasio_esportivo', 'centro_comunitario', 'assistencia_social']

/** Candidato como `Shelter`, para o mapa: sem capacidade nem ocupação, porque ninguém validou o local. */
export function candidateToShelter(o: OsmItem): Shelter {
  return {
    id: o.osmId,
    name: o.nome,
    kind: KINDS.includes(o.tipo as ShelterKind) ? (o.tipo as ShelterKind) : 'centro_comunitario', // tipo novo no arquivo não pode quebrar o popup
    lat: o.lat,
    lng: o.lng,
    street: o.rua,
    neighborhood: o.bairro,
    city: o.cidade,
    phone: o.telefone,
    capacity: 0,
    occupancy: 0,
    status: 'CANDIDATO',
    simulated: true,
    resources: { water: false, food: false, medical: false, accessible: false, pets: false },
  }
}

/** Distância aproximada em km entre dois pontos (suficiente para distâncias curtas). */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = Math.PI / 180
  const x = (bLat - aLat) * r
  const y = (bLng - aLng) * r * Math.cos(aLat * r)
  return 6371 * Math.sqrt(x * x + y * y)
}

/** Tira os candidatos que são o mesmo lugar de um abrigo já cadastrado (mesmo ponto, a menos de `raioKm` de distância). */
export function withoutRegistered(candidates: Shelter[], registered: Pick<Shelter, 'lat' | 'lng'>[], raioKm = 0.03): Shelter[] {
  if (!registered.length) return candidates
  const grausDeLatitude = raioKm / 111 // 1 grau de latitude tem mais de 111 km: diferença maior que isso já está além do raio
  return candidates.filter(
    (c) => !registered.some((s) => Math.abs(c.lat - s.lat) <= grausDeLatitude && distanceKm(c.lat, c.lng, s.lat, s.lng) < raioKm),
  )
}
