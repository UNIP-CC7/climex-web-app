import type { Alert, AppUser, AuditEntry, LatLng, RescueRequest } from '@/domain/types'
import { riskLevel } from '@/lib/risk'

/** Centro de referência: Santana de Parnaíba, SP */
export const CENTER: LatLng = [-23.4439, -46.9178]

const minutes = (m: number) => new Date(Date.now() - m * 60000).toISOString()
const later = (m: number) => new Date(Date.now() + m * 60000).toISOString()

/** Polígono irregular em volta de um centro, só para o protótipo. */
export function area([lat, lng]: LatLng, r = 0.012): LatLng[] {
  return [
    [lat + r, lng - r * 1.1],
    [lat + r * 0.9, lng + r * 1.2],
    [lat - r * 0.8, lng + r],
    [lat - r, lng - r * 0.9],
  ]
}

export const ALERTS: Alert[] = [
  {
    id: 'al-1',
    title: 'Chuva intensa e risco de enchente',
    severity: 'ALERTA_MAXIMO',
    city: 'Santana de Parnaíba',
    neighborhood: 'Fazendinha',
    polygons: [area([-23.4109, -46.8835])],
    issuedAt: minutes(95),
    expiresAt: later(210),
    active: true,
    source: 'INMET',
  },
  {
    id: 'al-2',
    title: 'Risco de alagamento',
    severity: 'ALERTA',
    city: 'Santana de Parnaíba',
    neighborhood: 'Cidade São Pedro',
    polygons: [area([-23.4213, -46.8634], 0.009)],
    issuedAt: minutes(140),
    expiresAt: later(150),
    active: true,
    source: 'DEFESA_CIVIL',
  },
  {
    id: 'al-3',
    title: 'Rajadas de vento',
    severity: 'ATENCAO',
    city: 'Santana de Parnaíba',
    neighborhood: 'Jardim Frediani',
    polygons: [area([-23.4421, -46.9255], 0.008)],
    issuedAt: minutes(210),
    expiresAt: later(60),
    active: true,
    source: 'INMET',
  },
  {
    id: 'al-4',
    title: 'Baixa umidade do ar',
    severity: 'OBSERVACAO',
    city: 'Santana de Parnaíba',
    neighborhood: 'Parque Santana',
    polygons: [area([-23.435, -46.899], 0.007)],
    issuedAt: minutes(900),
    expiresAt: minutes(120),
    active: false,
    source: 'INMET',
  },
]

interface RescueSeed {
  t: RescueRequest['type']
  sos?: boolean
  lat: number
  lng: number
  addr: string
  nb: string
  alertId?: string
  people: number
  who: string
  km: number
  open: number
  status?: RescueRequest['status']
  agent?: string
}

const R: RescueSeed[] = [
  {
    t: 'ILHADO',
    sos: true,
    lat: -23.4112,
    lng: -46.8851,
    addr: 'Rua Gabriel Jorge Salomão, 214',
    nb: 'Fazendinha',
    alertId: 'al-1',
    people: 3,
    who: 'Cidadã',
    km: 1.2,
    open: 4,
  },
  {
    t: 'FERIDO',
    lat: -23.4098,
    lng: -46.8812,
    addr: 'Estrada Tenente Marques, km 3',
    nb: 'Fazendinha',
    alertId: 'al-1',
    people: 1,
    who: 'Cidadão',
    km: 2.8,
    open: 9,
  },
  {
    t: 'EVACUACAO',
    lat: -23.422,
    lng: -46.865,
    addr: 'Rua Conselheiro Ramalho, 88',
    nb: 'Cidade São Pedro',
    alertId: 'al-2',
    people: 5,
    who: 'Cidadã',
    km: 3.4,
    open: 17,
  },
  {
    t: 'DESABAMENTO',
    lat: -23.4205,
    lng: -46.8615,
    addr: 'Travessa das Palmeiras, 12',
    nb: 'Cidade São Pedro',
    alertId: 'al-2',
    people: 2,
    who: 'Cidadão',
    km: 4.1,
    open: 22,
  },
  {
    t: 'EVACUACAO',
    lat: -23.4118,
    lng: -46.8845,
    addr: 'Rua Alagoas, 301',
    nb: 'Recanto das Flores',
    alertId: 'al-1',
    people: 2,
    who: 'Cidadã',
    km: 5.0,
    open: 31,
  },
  {
    t: 'ILHADO',
    lat: -23.444,
    lng: -46.924,
    addr: 'Rua Nelson Piccinini Miguel, 150',
    nb: 'Jardim Frediani',
    alertId: 'al-3',
    people: 1,
    who: 'Cidadão',
    km: 9.6,
    open: 48,
  },
  {
    t: 'FERIDO',
    lat: -23.412,
    lng: -46.887,
    addr: 'Rua Gabriel Jorge Salomão, 77',
    nb: 'Fazendinha',
    alertId: 'al-1',
    people: 1,
    who: 'Cidadão',
    km: 1.9,
    open: 55,
  },
  { t: 'EVACUACAO', lat: -23.43, lng: -46.902, addr: 'Rua dos Caquizeiros, 45', nb: 'Parque Santana', people: 4, who: 'Cidadã', km: 6.2, open: 63 },
  {
    t: 'ILHADO',
    lat: -23.409,
    lng: -46.886,
    addr: "Rua Estrela D'Alva, 19",
    nb: 'Cento e Vinte',
    alertId: 'al-1',
    people: 2,
    who: 'Cidadã',
    km: 2.2,
    open: 70,
  },
  {
    t: 'DESABAMENTO',
    lat: -23.423,
    lng: -46.86,
    addr: 'Rua Espírito Santo, 220',
    nb: 'Cidade São Pedro',
    alertId: 'al-2',
    people: 3,
    who: 'Cidadão',
    km: 4.8,
    open: 78,
  },
  {
    t: 'EVACUACAO',
    lat: -23.44,
    lng: -46.921,
    addr: 'Rua Conde de Monsanto, 9',
    nb: 'Centro',
    alertId: 'al-3',
    people: 2,
    who: 'Cidadã',
    km: 8.9,
    open: 85,
  },
  {
    t: 'FERIDO',
    lat: -23.4102,
    lng: -46.883,
    addr: 'Rua Rio de Janeiro, 410',
    nb: 'Bico dos Sócios',
    alertId: 'al-1',
    people: 1,
    who: 'Cidadão',
    km: 1.5,
    open: 92,
  },
  {
    t: 'EVACUACAO',
    status: 'EM_ATENDIMENTO',
    agent: 'Renata Lopes',
    lat: -23.4115,
    lng: -46.884,
    addr: 'Rua Piauí, 66',
    nb: 'Fazendinha',
    alertId: 'al-1',
    people: 4,
    who: 'Cidadã',
    km: 1.1,
    open: 40,
  },
  {
    t: 'ILHADO',
    status: 'EM_ATENDIMENTO',
    agent: 'Carlos Menezes',
    lat: -23.4208,
    lng: -46.8628,
    addr: 'Rua da Fartura, 301',
    nb: 'Cidade São Pedro',
    alertId: 'al-2',
    people: 2,
    who: 'Cidadão',
    km: 0.8,
    open: 52,
  },
  {
    t: 'FERIDO',
    status: 'EM_ATENDIMENTO',
    agent: 'Renata Lopes',
    lat: -23.4125,
    lng: -46.8818,
    addr: 'Avenida Joaquim Teixeira, 1200',
    nb: 'Fazendinha',
    alertId: 'al-1',
    people: 1,
    who: 'Cidadão',
    km: 0.6,
    open: 61,
  },
  {
    t: 'ILHADO',
    status: 'EM_ATENDIMENTO',
    agent: 'Paulo Duarte',
    lat: -23.4215,
    lng: -46.864,
    addr: 'Rua Via Láctea, 8',
    nb: 'Cidade São Pedro',
    alertId: 'al-2',
    people: 3,
    who: 'Cidadã',
    km: 1.0,
    open: 66,
  },
]

export const RESCUE: RescueRequest[] = R.map((r, i) => {
  const alert = ALERTS.find((a) => a.id === r.alertId) ?? null
  return {
    id: `rs-${i + 1}`,
    type: r.t,
    status: r.status ?? 'ABERTA',
    risk: riskLevel(r.t, !!alert, alert?.severity ?? null, !!r.sos),
    sos: !!r.sos,
    lat: r.lat,
    lng: r.lng,
    address: r.addr,
    neighborhood: r.nb,
    inAlertArea: !!alert,
    people: r.people,
    requesterName: r.who,
    distanceKm: r.km,
    openedAt: minutes(r.open),
    assignedTo: r.agent ?? null,
    outcome: null,
  }
})

export const USERS: AppUser[] = [
  { id: 'u-1', name: 'Marcos Cavalcante', role: 'GESTOR', phone: '(11) 9 8812-4410', lastAccess: minutes(3), active: true },
  { id: 'u-2', name: 'Renata Lopes', role: 'AGENTE', phone: '(11) 9 9140-2287', lastAccess: minutes(11), active: true },
  { id: 'u-3', name: 'Carlos Menezes', role: 'AGENTE', phone: '(11) 9 7731-0953', lastAccess: minutes(26), active: true },
  { id: 'u-4', name: 'Paulo Duarte', role: 'AGENTE', phone: '(11) 9 9604-1178', lastAccess: minutes(40), active: true },
  { id: 'u-5', name: 'Beatriz Nogueira', role: 'AGENTE', phone: '(11) 9 8450-6612', lastAccess: minutes(1500), active: false },
  { id: 'u-6', name: 'Diego Arruda', role: 'ADMIN', phone: '(11) 9 9215-3040', lastAccess: minutes(2), active: true },
]

const ACTIONS: [string, string, string, number, AuditEntry['role']][] = [
  ['Marcos Cavalcante', 'Criou alerta', 'Alert al-1', 201, 'GESTOR'],
  ['Renata Lopes', 'Aceitou solicitação', 'RescueRequest rs-13', 200, 'AGENTE'],
  ['Diego Arruda', 'Promoveu perfil de usuário', 'User u-3', 200, 'ADMIN'],
  ['Carlos Menezes', 'Registrou desfecho', 'RescueRequest rs-14', 200, 'AGENTE'],
  ['Marcos Cavalcante', 'Atualizou capacidade do abrigo', 'Shelter sh-2', 200, 'GESTOR'],
  ['Paulo Duarte', 'Aceitou solicitação', 'RescueRequest rs-16', 200, 'AGENTE'],
  ['Diego Arruda', 'Desativou usuário', 'User u-5', 200, 'ADMIN'],
  ['Marcos Cavalcante', 'Encerrou alerta', 'Alert al-4', 200, 'GESTOR'],
]

/** Hash encadeado ilustrativo (não é criptográfico), só para mostrar a trilha de auditoria. */
export function fakeHash(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619) >>> 0
  return h.toString(16).padStart(8, '0').repeat(2)
}

export const AUDIT: AuditEntry[] = (() => {
  let prev = '0'.repeat(16)
  return ACTIONS.map(([author, action, entity, status, role], i) => {
    const at = minutes((ACTIONS.length - i) * 17)
    const hash = fakeHash(prev + author + action + entity + at)
    const e: AuditEntry = { seq: i + 1, at, author, role, action, entity, status, ip: `10.20.${i + 3}.${40 + i}`, hash, prevHash: prev }
    prev = hash
    return e
  })
})()
