import type { Shelter, ShelterCandidate, ShelterReviewPage, ShelterReviewQuery } from '@/domain/types'
import { shelterKindFromName } from '@/services/http/mappers'

/** Quantos candidatos a camada do mapa carrega no máximo. Acima disso o mapa avisa que está mostrando só parte. */
export const MAP_CANDIDATE_CAP = 2000
/** Tamanho da página: é o máximo que a API aceita por pedido. */
export const CANDIDATE_PAGE = 200

/** Candidato da revisão como `Shelter`, para o mapa: sem capacidade nem ocupação, porque ninguém validou o local. */
export function candidateToMapShelter(c: ShelterCandidate): Shelter {
  return {
    id: c.id,
    name: c.name,
    kind: shelterKindFromName(c.name),
    lat: c.lat,
    lng: c.lng,
    street: c.address || null,
    neighborhood: null,
    city: null,
    phone: c.phone,
    capacity: 0,
    occupancy: 0,
    status: 'CANDIDATO',
    simulated: false,
    resources: c.resources,
  }
}

export interface MapCandidates {
  items: Shelter[]
  /** quantos candidatos existem na API, mesmo os que ficaram de fora pelo teto */
  total: number
}

/** Lê os candidatos da API em páginas, até acabarem ou até o teto. Os confirmados e rejeitados não entram. */
export async function loadMapCandidates(
  list: (q: ShelterReviewQuery) => Promise<ShelterReviewPage>,
  cap: number = MAP_CANDIDATE_CAP,
): Promise<MapCandidates> {
  const items: ShelterCandidate[] = []
  let total = 0
  while (items.length < cap) {
    const limit = Math.min(CANDIDATE_PAGE, cap - items.length)
    const page = await list({ status: 'CANDIDATE', limit, offset: items.length })
    total = page.total
    items.push(...page.items)
    if (page.items.length < limit || items.length >= total) break
  }
  return { items: items.map(candidateToMapShelter), total }
}
