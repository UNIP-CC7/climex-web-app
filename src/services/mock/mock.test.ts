import { describe, expect, it } from 'vitest'
import { mockServices as s } from '.'

// O estado é em memória e compartilhado neste arquivo: as leituras vêm antes das escritas.
describe('serviços simulados: leitura inicial', () => {
  it('login devolve o nome de cada perfil', async () => {
    expect((await s.auth.login('GESTOR')).name).toBe('Marcos Cavalcante')
    expect((await s.auth.login('AGENTE')).role).toBe('AGENTE')
    expect((await s.auth.login('ADMIN')).name).toBe('Diego Arruda')
  })

  it('resumo do painel soma alertas, solicitações e abrigos', async () => {
    const r = await s.dashboard.summary()
    expect(r.activeAlerts).toBe(3)
    expect(r.maxAlert?.severity).toBe('ALERTA_MAXIMO')
    expect(r.openRescue).toBe(12)
    expect(Object.values(r.openByRisk).reduce((a, b) => a + b, 0)).toBe(12)
    expect(r.shelterTotal).toBe(7)
    expect(r.spotsTotal).toBeGreaterThan(r.spotsFree)
  })

  it('alertas vêm ordenados da maior para a menor severidade', async () => {
    const list = await s.alerts.list()
    expect(list[0].severity).toBe('ALERTA_MAXIMO')
    expect(list.at(-1)?.severity).toBe('OBSERVACAO')
  })

  it('abrigos: 7 ativos escolhidos entre os públicos, sem clube particular', async () => {
    const list = await s.shelters.list()
    expect(list.filter((x) => x.status === 'ATIVO')).toHaveLength(7)
    expect(list.some((x) => x.name.includes('Clube'))).toBe(false)
    expect(list.some((x) => x.name === 'UPA Fazendinha')).toBe(false)
  })

  it('auditoria forma uma cadeia: cada registro guarda o hash do anterior', async () => {
    const asc = [...(await s.audit.list())].sort((a, b) => a.seq - b.seq)
    expect(asc[0].prevHash).toBe('0'.repeat(16))
    asc.slice(1).forEach((e, i) => expect(e.prevHash).toBe(asc[i].hash))
  })
})

describe('serviços simulados: escrita', () => {
  it('cria e encerra alertas', async () => {
    const a = await s.alerts.create({ title: 'Teste', severity: 'ATENCAO', neighborhood: 'Centro', center: [-23.44, -46.91], radiusKm: 1, hours: 2 })
    expect(a.source).toBe('MANUAL')
    expect(a.polygons[0]).toHaveLength(4)
    expect((await s.alerts.list()).find((x) => x.id === a.id)?.active).toBe(true)
    await s.alerts.close(a.id)
    expect((await s.alerts.list()).find((x) => x.id === a.id)?.active).toBe(false)
  })

  it('solicitação: aceitar atribui o agente e voltar para aberta libera', async () => {
    const [first] = await s.rescue.list()
    const aceita = await s.rescue.setStatus(first.id, 'EM_ATENDIMENTO', 'Renata Lopes')
    expect(aceita.assignedTo).toBe('Renata Lopes')
    const concluida = await s.rescue.setStatus(first.id, 'CONCLUIDA', 'Renata Lopes', 'Atendida em campo')
    expect(concluida.outcome).toBe('Atendida em campo')
    const reaberta = await s.rescue.setStatus(first.id, 'ABERTA', 'Renata Lopes')
    expect(reaberta.assignedTo).toBeNull()
  })

  it('abrigos: entrada, saída, limite de capacidade e id desconhecido', async () => {
    const ativo = (await s.shelters.list()).find((x) => x.status === 'ATIVO')!
    const antes = ativo.occupancy
    expect((await s.shelters.checkIn(ativo.id, 1)).occupancy).toBe(antes + 1)
    expect((await s.shelters.checkIn(ativo.id, -1000)).occupancy).toBe(0)
    await expect(s.shelters.checkIn(ativo.id, ativo.capacity + 1)).rejects.toThrow('Abrigo lotado')
    await expect(s.shelters.checkIn('nao-existe', 1)).rejects.toThrow('não encontrado')
    await expect(s.shelters.update('nao-existe', { capacity: 10 })).rejects.toThrow('não encontrado')
  })

  it('abrigos: ativar um candidato dá ocupação inicial', async () => {
    const cand = (await s.shelters.list()).find((x) => x.status === 'CANDIDATO')!
    const up = await s.shelters.update(cand.id, { status: 'ATIVO', capacity: 200 })
    expect(up.capacity).toBe(200)
    expect(up.occupancy).toBe(20)
  })

  it('usuários: trocar perfil e desativar geram registros na auditoria', async () => {
    const antes = (await s.audit.list()).length
    expect((await s.users.setRole('u-2', 'GESTOR')).role).toBe('GESTOR')
    expect((await s.users.setActive('u-2', false)).active).toBe(false)
    expect((await s.users.setActive('u-2', true)).active).toBe(true)
    const depois = await s.audit.list()
    expect(depois.length).toBeGreaterThanOrEqual(antes + 3)
    expect(depois[0].seq).toBeGreaterThan(depois[1].seq) // mais recente primeiro
  })
})
