import { describe, expect, it } from 'vitest'
import { ago, minutesAgo, toCsv } from './format'
import { makeRisk, riskBand, riskLevel } from './risk'
import { ROUTE_ROLES } from '@/features/auth/store'

describe('riskLevel', () => {
  it('SOS sempre cai na faixa crítica', () => {
    expect(riskLevel('EVACUACAO', false, null, true).band).toBe('CRITICO')
  })
  it('área de alerta e severidade elevam a pontuação', () => {
    expect(riskLevel('EVACUACAO', false, null, false)).toEqual({ score: 25, band: 'BAIXO' })
    expect(riskLevel('EVACUACAO', true, 'ALERTA_MAXIMO', false)).toEqual({ score: 60, band: 'ALTO' })
  })
  it('nunca passa de 100', () => {
    expect(riskLevel('DESABAMENTO', true, 'ALERTA_MAXIMO', false).score).toBeLessThanOrEqual(100)
  })
})

describe('riskBand', () => {
  it('usa os mesmos cortes da API', () => {
    expect(riskBand(0)).toBe('BAIXO')
    expect(riskBand(29)).toBe('BAIXO')
    expect(riskBand(30)).toBe('MEDIO')
    expect(riskBand(54)).toBe('MEDIO')
    expect(riskBand(55)).toBe('ALTO')
    expect(riskBand(79)).toBe('ALTO')
    expect(riskBand(80)).toBe('CRITICO')
    expect(riskBand(100)).toBe('CRITICO')
  })
  it('makeRisk limita a pontuação entre 0 e 100', () => {
    expect(makeRisk(140)).toEqual({ score: 100, band: 'CRITICO' })
    expect(makeRisk(-3)).toEqual({ score: 0, band: 'BAIXO' })
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
  it('agente edita abrigos (como a API permite), mas não emite alertas', () => {
    expect(ROUTE_ROLES['/abrigos']).toContain('AGENTE')
    expect(ROUTE_ROLES['/alertas']).not.toContain('AGENTE')
    expect(ROUTE_ROLES['/relatorios']).not.toContain('AGENTE')
  })
})
