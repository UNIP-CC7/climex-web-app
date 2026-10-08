import { describe, expect, it } from 'vitest'
import type { Alert, RescueRequest, Shelter } from '@/domain/types'
import type { ApiAlert, ApiRescue, ApiShelter } from './dto'
import {
  alertDescription,
  alertFromApi,
  auditFromApi,
  buildSummary,
  polygonsFromGeoJson,
  rescueFromApi,
  rescueStatusToApi,
  roleFromApi,
  roleToApi,
  shelterFromApi,
  shelterKindFromName,
  shelterPatchToApi,
  toE164,
  toSessionUser,
} from './mappers'

const apiAlert = (over: Partial<ApiAlert> = {}): ApiAlert => ({
  id: 'a1',
  title: 'Chuva forte',
  description: `Chuva forte. Bairro afetado: Fazendinha.`,
  level: 'ALERTA',
  status: 'ACTIVE',
  latitude: -23.41,
  longitude: -46.88,
  radiusMeters: 1500,
  city: 'Santana de Parnaíba',
  state: 'SP',
  source: 'MANUAL',
  polygon: {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [-46.9, -23.4],
          [-46.8, -23.4],
          [-46.8, -23.5],
          [-46.9, -23.4],
        ],
      ],
    ],
  },
  expiresAt: '2026-10-08T10:00:00.000Z',
  createdAt: '2026-10-07T10:00:00.000Z',
  ...over,
})
const apiShelter = (over: Partial<ApiShelter> = {}): ApiShelter => ({
  id: 's1',
  name: 'EMEF Maria Silva',
  address: 'Rua A, 10',
  latitude: -23.4,
  longitude: -46.9,
  capacity: 100,
  currentOccupancy: 40,
  isActive: true,
  isAccessible: true,
  isPetFriendly: false,
  hasWater: true,
  hasFood: false,
  hasMedical: true,
  hasPowerBackup: false,
  contactPhone: '+5511999990000',
  ...over,
})
const apiRescue = (over: Partial<ApiRescue> = {}): ApiRescue => ({
  id: 'r1',
  type: 'ILHADO',
  status: 'PENDING',
  riskLevel: 'ALTO',
  nrScore: 61,
  isSos: false,
  description: '  Casa alagada ',
  latitude: -23.4,
  longitude: -46.9,
  victimCount: 3,
  outcomeNote: null,
  alertId: null,
  assignedAgentId: null,
  createdAt: '2026-10-07T10:00:00.000Z',
  ...over,
})

describe('perfis e telefone', () => {
  it('ADMINISTRADOR vira ADMIN e o cidadão não tem perfil no painel', () => {
    expect(roleFromApi('ADMINISTRADOR')).toBe('ADMIN')
    expect(roleFromApi('GESTOR')).toBe('GESTOR')
    expect(roleFromApi('CIDADAO')).toBeNull()
    expect(roleFromApi(null)).toBeNull()
    expect(roleFromApi('OUTRO')).toBeNull()
    expect(roleToApi('ADMIN')).toBe('ADMINISTRADOR')
    expect(roleToApi('AGENTE')).toBe('AGENTE')
  })
  it('toSessionUser recusa o cidadão', () => {
    const base = { id: 'u', name: 'Ana', phone: '+5511990000001', createdAt: '2026-01-01T00:00:00Z' }
    expect(toSessionUser({ ...base, role: 'CIDADAO' })).toBeNull()
    expect(toSessionUser({ ...base, role: 'ADMINISTRADOR' })).toEqual({ id: 'u', name: 'Ana', role: 'ADMIN' })
  })
  it.each([
    ['(11) 99000-0001', '+5511990000001'],
    ['11990000001', '+5511990000001'],
    ['5511990000001', '+5511990000001'],
    ['+5511990000001', '+5511990000001'],
    ['+1 (305) 555-0100', '+13055550100'],
  ])('toE164(%s)', (input, out) => {
    expect(toE164(input)).toBe(out)
  })
})

describe('alertas', () => {
  it('converte o polígono [lng, lat] para [lat, lng]', () => {
    expect(
      polygonsFromGeoJson({
        type: 'Polygon',
        coordinates: [
          [
            [-46.9, -23.4],
            [-46.8, -23.4],
            [-46.8, -23.5],
            [-46.9, -23.4],
          ],
        ],
      }),
    ).toEqual([
      [
        [-23.4, -46.9],
        [-23.4, -46.8],
        [-23.5, -46.8],
        [-23.4, -46.9],
      ],
    ])
    expect(polygonsFromGeoJson(apiAlert().polygon)?.[0][0]).toEqual([-23.4, -46.9])
  })
  it('anel degenerado (1 ou 2 pontos, aberto demais, todos iguais) não vale e cai no círculo de reserva', () => {
    const ring = (...pts: number[][]) => ({ type: 'Polygon', coordinates: [pts] })
    expect(polygonsFromGeoJson(ring([-46.9, -23.4]))).toBeNull()
    expect(polygonsFromGeoJson(ring([-46.9, -23.4], [-46.8, -23.5]))).toBeNull()
    expect(polygonsFromGeoJson(ring([-46.9, -23.4], [-46.8, -23.5], [-46.9, -23.4]))).toBeNull() // só 2 vértices diferentes
    expect(polygonsFromGeoJson(ring([-46.9, -23.4], [-46.9, -23.4], [-46.9, -23.4], [-46.9, -23.4]))).toBeNull()
    const a = alertFromApi(apiAlert({ polygon: ring([-46.9, -23.4]) }))
    expect(a.polygons[0]).toHaveLength(24)
  })
  it('MultiPolygon: um anel por área, ignora buracos e descarta só o anel malformado', () => {
    const quadrado = (x: number) => [
      [x, -23.4],
      [x + 0.1, -23.4],
      [x + 0.1, -23.5],
      [x, -23.4],
    ]
    const buraco = [
      [-46.85, -23.42],
      [-46.84, -23.42],
      [-46.84, -23.43],
      [-46.85, -23.42],
    ]
    const r = polygonsFromGeoJson({ type: 'MultiPolygon', coordinates: [[quadrado(-46.9), buraco], [quadrado(-46.5)]] })
    expect(r).toHaveLength(2)
    expect(r?.[0]).toHaveLength(4) // o buraco não vira anel
    expect(r?.[1][0]).toEqual([-23.4, -46.5])
    const meio = polygonsFromGeoJson({ type: 'MultiPolygon', coordinates: [[[['x', 1]]], [quadrado(-46.5)]] })
    expect(meio).toHaveLength(1)
    expect(polygonsFromGeoJson({ type: 'MultiPolygon', coordinates: [] })).toBeNull()
  })
  it('rejeita tipo de geometria inesperado e coordenadas malformadas', () => {
    expect(polygonsFromGeoJson({ type: 'Point', coordinates: [-46.9, -23.4] })).toBeNull()
    expect(polygonsFromGeoJson({ coordinates: [[[-46.9, -23.4]]] })).toBeNull()
    expect(polygonsFromGeoJson({ type: 'Polygon', coordinates: [[[-46.9]]] })).toBeNull()
    expect(polygonsFromGeoJson({ type: 'Polygon', coordinates: [[['x', -23.4]]] })).toBeNull()
    expect(polygonsFromGeoJson({ type: 'Polygon', coordinates: [[null]] })).toBeNull()
    expect(polygonsFromGeoJson({ type: 'Polygon', coordinates: ['x'] })).toBeNull()
  })
  it('devolve null quando não há polígono utilizável', () => {
    expect(polygonsFromGeoJson(null)).toBeNull()
    expect(polygonsFromGeoJson({ type: 'Polygon' })).toBeNull()
    expect(polygonsFromGeoJson({ type: 'Polygon', coordinates: [[]] })).toBeNull()
  })
  it('mapeia campos, bairro da descrição e situação ativa', () => {
    const a = alertFromApi(apiAlert())
    expect(a).toMatchObject({
      id: 'a1',
      severity: 'ALERTA',
      neighborhood: 'Fazendinha',
      active: true,
      source: 'MANUAL',
      expiresAt: '2026-10-08T10:00:00.000Z',
    })
    expect(alertFromApi(apiAlert({ status: 'RESOLVED' })).active).toBe(false)
    expect(alertFromApi(apiAlert({ status: 'MONITORING' })).active).toBe(false)
  })
  it('usa a cidade quando a descrição não traz o bairro e aceita expiração ausente', () => {
    const a = alertFromApi(apiAlert({ description: 'Sem bairro aqui', expiresAt: null }))
    expect(a.neighborhood).toBe('Santana de Parnaíba')
    expect(a.expiresAt).toBeNull()
  })
  it('fonte desconhecida vira MANUAL, conhecida é normalizada', () => {
    expect(alertFromApi(apiAlert({ source: 'inmet' })).source).toBe('INMET')
    expect(alertFromApi(apiAlert({ source: 'OUTRA' })).source).toBe('MANUAL')
  })
  it('sem polígono desenha um círculo ao redor do centro', () => {
    const a = alertFromApi(apiAlert({ polygon: null }))
    expect(a.polygons).toHaveLength(1)
    expect(a.polygons[0]).toHaveLength(24)
    const sem = alertFromApi(apiAlert({ polygon: null, radiusMeters: null }))
    expect(sem.polygons[0]).toHaveLength(24)
  })
  it('o bairro volta inteiro com ou sem ponto final e com espaços depois', () => {
    const n = (description: string) => alertFromApi(apiAlert({ description })).neighborhood
    expect(n('X. Bairro afetado: Centro')).toBe('Centro')
    expect(n('X. Bairro afetado: Centro.')).toBe('Centro')
    expect(n('X. Bairro afetado: Centro. ')).toBe('Centro')
    expect(n('X. Bairro afetado: ')).toBe('Santana de Parnaíba')
  })
  it('a descrição enviada à API carrega o bairro e volta igual', () => {
    const d = alertDescription('Chuva forte', 'Fazendinha')
    expect(d.length).toBeGreaterThanOrEqual(10)
    expect(alertFromApi(apiAlert({ description: d })).neighborhood).toBe('Fazendinha')
  })
})

describe('abrigos', () => {
  it('descobre o tipo pelo nome', () => {
    expect(shelterKindFromName('Ginásio Municipal')).toBe('ginasio_esportivo')
    expect(shelterKindFromName('Escola Estadual X')).toBe('escola')
    expect(shelterKindFromName('CRAS Centro')).toBe('assistencia_social')
    expect(shelterKindFromName('Salão Paroquial')).toBe('centro_comunitario')
  })
  it('mapeia ocupação, recursos e situação', () => {
    const s = shelterFromApi(apiShelter())
    expect(s).toMatchObject({
      kind: 'escola',
      street: 'Rua A, 10',
      capacity: 100,
      occupancy: 40,
      status: 'ATIVO',
      simulated: false,
      phone: '+5511999990000',
      resources: { water: true, food: false, medical: true, accessible: true, pets: false },
    })
    expect(shelterFromApi(apiShelter({ isActive: false, address: '' }))).toMatchObject({ status: 'INATIVO', street: null })
  })
  it('converte a edição do painel para o PATCH da API', () => {
    expect(shelterPatchToApi({ capacity: 80 })).toEqual({ capacity: 80 })
    expect(shelterPatchToApi({ status: 'ATIVO' })).toEqual({ isActive: true })
    expect(shelterPatchToApi({ status: 'CANDIDATO' })).toEqual({ isActive: false })
    expect(shelterPatchToApi({ resources: { water: true, food: false, medical: true, accessible: false, pets: true } })).toEqual({
      hasWater: true,
      hasFood: false,
      hasMedical: true,
      isAccessible: false,
      isPetFriendly: true,
    })
  })
})

describe('socorro', () => {
  it('mapeia cada situação da API', () => {
    const st = (status: ApiRescue['status']) => rescueFromApi(apiRescue({ status })).status
    expect(st('PENDING')).toBe('ABERTA')
    expect(st('ASSIGNED')).toBe('EM_ATENDIMENTO')
    expect(st('IN_PROGRESS')).toBe('EM_ATENDIMENTO')
    expect(st('RESOLVED')).toBe('CONCLUIDA')
    expect(st('CANCELLED')).toBe('CANCELADA')
  })
  it('usa a pontuação e a faixa da API e preenche o que ela não informa', () => {
    const r = rescueFromApi(apiRescue({ alertId: 'x', assignedAgentId: 'ag', outcomeNote: 'ok', isSos: true }))
    expect(r).toMatchObject({
      risk: { score: 61, band: 'ALTO' },
      sos: true,
      address: 'Casa alagada',
      neighborhood: '',
      inAlertArea: true,
      people: 3,
      requesterName: null,
      distanceKm: null,
      assignedTo: 'ag',
      outcome: 'ok',
    })
    expect(rescueFromApi(apiRescue({ description: null })).address).toBe('Sem descrição')
    expect(rescueFromApi(apiRescue()).inAlertArea).toBe(false)
  })
  it('faixa desconhecida ou pontuação fora de 0 a 100 não contamina o painel', () => {
    expect(rescueFromApi(apiRescue({ riskLevel: 'XPTO' as never, nrScore: 85 })).risk).toEqual({ score: 85, band: 'CRITICO' })
    expect(rescueFromApi(apiRescue({ nrScore: 250 })).risk.score).toBe(100)
    expect(rescueFromApi(apiRescue({ nrScore: Number.NaN, riskLevel: undefined as never })).risk).toEqual({ score: 0, band: 'BAIXO' })
  })
  it('converte a troca de situação para o PATCH', () => {
    expect(rescueStatusToApi('EM_ATENDIMENTO')).toEqual({ status: 'ASSIGNED' })
    expect(rescueStatusToApi('CONCLUIDA', ' feito ')).toEqual({ status: 'RESOLVED', outcomeNote: 'feito' })
    expect(rescueStatusToApi('CANCELADA', 'duplicada')).toEqual({ status: 'CANCELLED', outcomeNote: 'duplicada' })
    expect(() => rescueStatusToApi('ABERTA')).toThrow(/reabrir/)
    expect(() => rescueStatusToApi('CONCLUIDA')).toThrow(/desfecho/)
    expect(() => rescueStatusToApi('CONCLUIDA', '  ')).toThrow(/desfecho/)
  })
})

describe('auditoria', () => {
  it('mapeia os campos e tolera nulos', () => {
    const e = auditFromApi({
      id: 'e1',
      sequence: 7,
      userId: '12345678-aaaa',
      userRole: 'GESTOR',
      action: 'POST /alerts',
      entityType: 'Alert',
      entityId: 'abcdef12-0000',
      statusCode: 201,
      ipAddress: '10.0.0.1',
      hash: 'h2',
      previousHash: 'h1',
      createdAt: '2026-10-07T10:00:00.000Z',
    })
    expect(e).toMatchObject({
      seq: 7,
      author: 'Usuário 12345678',
      role: 'GESTOR',
      entity: 'Alert abcdef12',
      status: 201,
      ip: '10.0.0.1',
      hash: 'h2',
      prevHash: 'h1',
    })
    const n = auditFromApi({
      ...{ id: 'e', sequence: 1, action: 'x', entityType: 'T', hash: 'h', createdAt: '2026-10-07T10:00:00.000Z' },
      userId: null,
      userRole: null,
      entityId: null,
      statusCode: null,
      ipAddress: null,
      previousHash: null,
    })
    expect(n).toMatchObject({ author: 'Sistema', role: null, entity: 'T', status: 0, ip: '-', prevHash: '' })
  })
})

describe('resumo do painel', () => {
  const alerts: Alert[] = [
    { ...alertFromApi(apiAlert({ id: 'a1', level: 'ATENCAO' })) },
    { ...alertFromApi(apiAlert({ id: 'a2', level: 'ALERTA_MAXIMO' })) },
    { ...alertFromApi(apiAlert({ id: 'a3', status: 'RESOLVED' })) },
  ]
  const shelters: Shelter[] = [
    shelterFromApi(apiShelter({ id: 's1', capacity: 100, currentOccupancy: 40 })),
    shelterFromApi(apiShelter({ id: 's2', capacity: 50, currentOccupancy: 50 })),
    shelterFromApi(apiShelter({ id: 's3', isActive: false })),
  ]
  const rescue: RescueRequest[] = [
    rescueFromApi(apiRescue({ id: 'r1', riskLevel: 'CRITICO', nrScore: 90 })),
    rescueFromApi(apiRescue({ id: 'r2', riskLevel: 'BAIXO', nrScore: 10 })),
    rescueFromApi(apiRescue({ id: 'r3', status: 'ASSIGNED', assignedAgentId: 'ag1' })),
    rescueFromApi(apiRescue({ id: 'r4', status: 'IN_PROGRESS', assignedAgentId: 'ag1' })),
    rescueFromApi(apiRescue({ id: 'r5', status: 'RESOLVED' })),
  ]
  it('conta alertas, solicitações por faixa, vagas e agentes', () => {
    const s = buildSummary(alerts, shelters, rescue, new Date('2026-10-07T12:00:00Z'))
    expect(s.activeAlerts).toBe(2)
    expect(s.maxAlert?.severity).toBe('ALERTA_MAXIMO')
    expect(s.openRescue).toBe(2)
    expect(s.openByRisk).toEqual({ CRITICO: 1, ALTO: 0, MEDIO: 0, BAIXO: 1 })
    expect(s).toMatchObject({
      shelterTotal: 2,
      sheltersWithSpots: 1,
      spotsFree: 60,
      spotsTotal: 150,
      agentsInField: null,
      agentsAttending: 1,
      simulated: false,
    })
    expect(s.updatedAt).toBe('2026-10-07T12:00:00.000Z')
  })
  it('não quebra sem dados', () => {
    const s = buildSummary([], [], [])
    expect(s).toMatchObject({ activeAlerts: 0, maxAlert: null, openRescue: 0, spotsFree: 0, spotsTotal: 0 })
  })
})
