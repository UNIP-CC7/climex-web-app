import { describe, expect, it } from 'vitest'
import { ago, minutesAgo, toCsv } from './format'
import { riskLevel } from './risk'
import { ROUTE_ROLES } from '@/features/auth/store'

describe('riskLevel', () => {
  it('SOS sempre é nível 5', () => {
    expect(riskLevel('EVACUACAO', false, null, true)).toBe(5)
  })
  it('área de alerta e severidade elevam o nível', () => {
    expect(riskLevel('EVACUACAO', false, null, false)).toBe(2)
    expect(riskLevel('EVACUACAO', true, 'ALERTA_MAXIMO', false)).toBe(4)
  })
  it('nunca passa de 5', () => {
    expect(riskLevel('FERIDO', true, 'ALERTA_MAXIMO', false)).toBe(5)
  })
})

describe('format', () => {
  const now = Date.parse('2026-10-02T12:00:00Z')
  it('calcula minutos e formata tempo', () => {
    expect(minutesAgo('2026-10-02T11:55:00Z', now)).toBe(5)
    expect(ago('2026-10-02T11:55:00Z', now)).toBe('05 min')
    expect(ago('2026-10-02T10:30:00Z', now)).toBe('1 h 30 min')
  })
  it('gera CSV com escape de aspas', () => {
    expect(toCsv([{ a: 'x"y', b: 2 }])).toBe('a;b\n"x""y";"2"')
  })
})

describe('permissões por rota', () => {
  it('usuários e auditoria são só do administrador', () => {
    expect(ROUTE_ROLES['/usuarios']).toEqual(['ADMIN'])
    expect(ROUTE_ROLES['/auditoria']).toEqual(['ADMIN'])
  })
  it('agente não acessa abrigos nem alertas', () => {
    expect(ROUTE_ROLES['/abrigos']).not.toContain('AGENTE')
    expect(ROUTE_ROLES['/alertas']).not.toContain('AGENTE')
  })
})
