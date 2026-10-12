import { describe, expect, it } from 'vitest'
import { DEFAULT_RISK_CONFIG, RISK_GROUPS, changedFields, checkDraft, labelOf, toDraft } from './riskConfig'

describe('pesos do NR: rascunho e validação', () => {
  it('o padrão vira rascunho de texto e volta idêntico', () => {
    const draft = toDraft(DEFAULT_RISK_CONFIG)
    expect(draft['type.FERIDO']).toBe('40')
    expect(draft['thresholds.CRITICO']).toBe('80')
    const check = checkDraft(draft)
    expect(check.config).toEqual(DEFAULT_RISK_CONFIG)
    expect(check.fields).toEqual({})
  })

  it('todos os campos de todos os grupos existem na configuração padrão', () => {
    for (const g of RISK_GROUPS) for (const f of g.fields) expect(Object.keys(DEFAULT_RISK_CONFIG[g.id])).toContain(f.key)
  })

  it('recusa vazio, texto, decimal e negativo em vez de virar zero', () => {
    for (const bad of ['', '  ', 'abc', '12a', '1,5', '-3', '2.5']) {
      const check = checkDraft({ ...toDraft(DEFAULT_RISK_CONFIG), 'type.FERIDO': bad })
      expect(check.fields['type.FERIDO']).toBe('Digite um número inteiro.')
      expect(check.config).toBeNull()
    }
  })

  it('respeita os intervalos: 0 a 50, 0 a 30 nos bônus e 1 a 100 nos limiares', () => {
    const base = toDraft(DEFAULT_RISK_CONFIG)
    expect(checkDraft({ ...base, 'type.FERIDO': '51' }).fields['type.FERIDO']).toBe('De 0 a 50.')
    expect(checkDraft({ ...base, 'type.FERIDO': '50' }).config).not.toBeNull()
    expect(checkDraft({ ...base, 'vulnerability.elderly': '31' }).fields['vulnerability.elderly']).toBe('De 0 a 30.')
    expect(checkDraft({ ...base, 'thresholds.MEDIO': '0' }).fields['thresholds.MEDIO']).toBe('De 1 a 100.')
    expect(checkDraft({ ...base, 'thresholds.CRITICO': '101' }).fields['thresholds.CRITICO']).toBe('De 1 a 100.')
  })

  it('exige limiares estritamente crescentes e bônus de 5+ vítimas não menor que o de 2+', () => {
    const base = toDraft(DEFAULT_RISK_CONFIG)
    expect(checkDraft({ ...base, 'thresholds.ALTO': '30' }).groups.thresholds).toMatch(/crescentes/)
    expect(checkDraft({ ...base, 'thresholds.ALTO': '31' }).groups.thresholds).toBeUndefined()
    expect(checkDraft({ ...base, 'victims.fromFive': '4' }).groups.victims).toMatch(/não pode ser menor/)
    expect(checkDraft({ ...base, 'victims.fromFive': '5' }).groups.victims).toBeUndefined()
  })

  it('não empilha o erro do grupo quando um campo dele já está inválido', () => {
    const check = checkDraft({ ...toDraft(DEFAULT_RISK_CONFIG), 'thresholds.MEDIO': 'x', 'thresholds.ALTO': '10' })
    expect(check.fields['thresholds.MEDIO']).toBeDefined()
    expect(check.groups.thresholds).toBeUndefined()
  })

  it('aceita espaços ao redor e converte para número', () => {
    const check = checkDraft({ ...toDraft(DEFAULT_RISK_CONFIG), 'type.FERIDO': ' 45 ' })
    expect(check.config?.type.FERIDO).toBe(45)
  })

  it('lista só o que mudou em relação à versão em vigor e nomeia os campos', () => {
    const draft = { ...toDraft(DEFAULT_RISK_CONFIG), 'vulnerability.elderly': '15', 'type.OUTROS': ' 10 ' }
    expect(changedFields(draft, DEFAULT_RISK_CONFIG)).toEqual(['vulnerability.elderly'])
    expect(labelOf('vulnerability.elderly')).toBe('Vulnerabilidade · Idosos')
    expect(labelOf('xyz.abc')).toBe('xyz · abc')
  })
})
