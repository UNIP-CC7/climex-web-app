/** Amostra mínima no formato de public/data/osm-sp-estado.json, para os testes não baixarem os 3,4 MB. */
const base = { rua: 'Rua das Acácias', numero: null, bairro: 'Fazendinha', cidade: 'Santana de Parnaíba', telefone: null }

const publicas = [
  'Colégio Municipal Paulo Freire',
  'Colégio Municipal Zilda Arns',
  'Escola Estadual Monteiro Lobato',
  'EMEF Aparecida Souza',
  'Ginásio Municipal Tramassi',
  'Centro Poliesportivo Cento e Vinte',
  'Colégio Municipal Cora Coralina',
  'Colégio Municipal Alba Bonilha',
]

export const OSM_FIXTURE = {
  itens: [
    ...publicas.map((nome, i) => ({
      ...base,
      osmId: `w${100 + i}`,
      tipo: nome.startsWith('Ginásio') || nome.startsWith('Centro') ? 'ginasio_esportivo' : 'escola',
      papel: 'candidato_abrigo',
      nome,
      lat: -23.44 + i * 0.002,
      lng: -46.91 + i * 0.002,
    })),
    { ...base, osmId: 'w200', tipo: 'ginasio_esportivo', papel: 'candidato_abrigo', nome: 'Clube Esportivo Particular', lat: -23.44, lng: -46.91 },
    { ...base, osmId: 'w201', tipo: 'centro_comunitario', papel: 'candidato_abrigo', nome: 'Salão Paroquial', lat: -23.45, lng: -46.92 },
    { ...base, osmId: 'w300', tipo: 'saude', papel: 'apoio', nome: 'UPA Fazendinha', lat: -23.41, lng: -46.88 },
  ],
}
