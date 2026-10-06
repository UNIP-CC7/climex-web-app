// Normaliza o resultado bruto da Overpass API para public/data/osm-sp-estado.json.
//
// Uso:
//   1. Rodar docs/tcc/fontes/overpass-query.txt na Overpass API (veja o README desta pasta)
//      e salvar a resposta em bruto.json
//   2. node docs/tcc/fontes/normalizar-osm.mjs bruto.json public/data/osm-sp-estado.json 2026-10-02
//
// O terceiro argumento é a data da consulta (AAAA-MM-DD), gravada no arquivo.
import { readFileSync, writeFileSync } from 'node:fs'

const [entrada, saida, dataConsulta] = process.argv.slice(2)
if (!entrada || !saida || !dataConsulta) {
  console.error('Uso: node normalizar-osm.mjs <bruto.json> <saida.json> <AAAA-MM-DD>')
  process.exit(1)
}

const bruto = JSON.parse(readFileSync(entrada, 'utf8'))

const tipo = (t) =>
  t.amenity === 'school'
    ? 'escola'
    : t.leisure === 'sports_centre' || t.building === 'sports_hall'
      ? 'ginasio_esportivo'
      : t.amenity === 'community_centre'
        ? 'centro_comunitario'
        : t.amenity === 'social_facility'
          ? 'assistencia_social'
          : t.amenity === 'hospital'
            ? 'saude'
            : t.amenity === 'fire_station'
              ? 'bombeiros'
              : 'outro'

// Escolas, ginásios, centros comunitários e assistência social são candidatos a abrigo.
// Hospitais e bombeiros entram só como pontos de apoio.
const papel = (k) => (['escola', 'ginasio_esportivo', 'centro_comunitario', 'assistencia_social'].includes(k) ? 'candidato_abrigo' : 'apoio')

const itens = []
for (const e of bruto.elements) {
  const t = e.tags ?? {}
  if (!t.name) continue // sem nome, o local não ajuda quem lê o mapa
  const lat = e.lat ?? e.center?.lat
  const lng = e.lon ?? e.center?.lon
  if (lat == null) continue
  const k = tipo(t)
  itens.push({
    osmId: e.type[0] + e.id,
    tipo: k,
    papel: papel(k),
    nome: t.name,
    lat: +lat.toFixed(6),
    lng: +lng.toFixed(6),
    rua: t['addr:street'] || null,
    numero: t['addr:housenumber'] || null,
    bairro: t['addr:suburb'] || null,
    cidade: t['addr:city'] || null,
    operador: t.operator || null,
    telefone: t.phone || t['contact:phone'] || null,
    capacidade: t.capacity ? +t.capacity || null : null,
  })
}

const meta = {
  fonte: 'OpenStreetMap via Overpass API',
  licenca: 'ODbL 1.0, © colaboradores do OpenStreetMap',
  consulta: dataConsulta,
  abrangencia: 'Estado de São Paulo (ISO3166-2 BR-SP)',
  observacao: 'Locais candidatos a abrigo, nao abrigos oficiais. Capacidade quase nunca existe no OSM. Somente itens com nome.',
  total: itens.length,
  itens,
}
writeFileSync(saida, JSON.stringify(meta))

const porTipo = {}
for (const i of itens) porTipo[i.tipo] = (porTipo[i.tipo] ?? 0) + 1
console.log(`${bruto.elements.length} elementos brutos, ${itens.length} com nome`, porTipo)
