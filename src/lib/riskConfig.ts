import type { RiskConfig } from '@/domain/types'

/** Pesos de fábrica, iguais ao padrão da API (versão 1 do seed). */
export const DEFAULT_RISK_CONFIG: RiskConfig = {
  type: { FERIDO: 40, ILHADO: 35, DESABAMENTO: 30, EVACUACAO: 20, OUTROS: 10 },
  alert: { ALERTA_MAXIMO: 30, ALERTA: 20, ATENCAO: 10, OBSERVACAO: 5 },
  water: { SUBMERSO: 20, PESCOCO: 15, CINTURA: 8, JOELHOS: 3 },
  structural: { DESABAMENTO_IMINENTE: 20, RACHADURAS: 8, NENHUM: 0 },
  vulnerability: { children: 10, elderly: 10, disabled: 10, medicalNeeds: 15 },
  victims: { fromTwo: 5, fromFive: 10 },
  thresholds: { MEDIO: 30, ALTO: 55, CRITICO: 80 },
}

export interface RiskField {
  key: string
  label: string
}
export interface RiskGroup {
  id: keyof RiskConfig
  title: string
  hint: string
  min: number
  max: number
  fields: RiskField[]
}

/** Estrutura da tela: o que cada bloco significa e o intervalo aceito (o mesmo que a API valida). */
export const RISK_GROUPS: RiskGroup[] = [
  {
    id: 'type',
    title: 'Tipo da ocorrência',
    hint: 'Pontos de base, conforme o que a pessoa relata.',
    min: 0,
    max: 50,
    fields: [
      { key: 'FERIDO', label: 'Pessoa ferida' },
      { key: 'ILHADO', label: 'Pessoa ilhada' },
      { key: 'DESABAMENTO', label: 'Desabamento' },
      { key: 'EVACUACAO', label: 'Evacuação' },
      { key: 'OUTROS', label: 'Outros' },
    ],
  },
  {
    id: 'alert',
    title: 'Nível do alerta na área',
    hint: 'Somado quando o pedido está dentro de um alerta ativo.',
    min: 0,
    max: 50,
    fields: [
      { key: 'ALERTA_MAXIMO', label: 'Alerta máximo' },
      { key: 'ALERTA', label: 'Alerta' },
      { key: 'ATENCAO', label: 'Atenção' },
      { key: 'OBSERVACAO', label: 'Observação' },
    ],
  },
  {
    id: 'water',
    title: 'Nível da água',
    hint: 'Informado no pedido de socorro.',
    min: 0,
    max: 50,
    fields: [
      { key: 'SUBMERSO', label: 'Submerso' },
      { key: 'PESCOCO', label: 'Água no pescoço' },
      { key: 'CINTURA', label: 'Água na cintura' },
      { key: 'JOELHOS', label: 'Água nos joelhos' },
    ],
  },
  {
    id: 'structural',
    title: 'Risco estrutural',
    hint: 'Estado da edificação.',
    min: 0,
    max: 50,
    fields: [
      { key: 'DESABAMENTO_IMINENTE', label: 'Desabamento iminente' },
      { key: 'RACHADURAS', label: 'Rachaduras' },
      { key: 'NENHUM', label: 'Nenhum' },
    ],
  },
  {
    id: 'vulnerability',
    title: 'Vulnerabilidade',
    hint: 'Bônus por perfil de quem está em risco.',
    min: 0,
    max: 30,
    fields: [
      { key: 'children', label: 'Crianças' },
      { key: 'elderly', label: 'Idosos' },
      { key: 'disabled', label: 'Pessoas com deficiência' },
      { key: 'medicalNeeds', label: 'Necessidades médicas' },
    ],
  },
  {
    id: 'victims',
    title: 'Número de vítimas',
    hint: 'Bônus por grupo. O de 5 ou mais não pode ser menor que o de 2 ou mais.',
    min: 0,
    max: 30,
    fields: [
      { key: 'fromTwo', label: '2 ou mais vítimas' },
      { key: 'fromFive', label: '5 ou mais vítimas' },
    ],
  },
  {
    id: 'thresholds',
    title: 'Limiares das faixas',
    hint: 'Pontuação mínima (de 1 a 100) de cada faixa. Abaixo do limiar Médio o risco é Baixo. Precisam ser crescentes.',
    min: 1,
    max: 100,
    fields: [
      { key: 'MEDIO', label: 'Médio a partir de' },
      { key: 'ALTO', label: 'Alto a partir de' },
      { key: 'CRITICO', label: 'Crítico a partir de' },
    ],
  },
]

/** O formulário trabalha com texto: campo vazio ou "12a" não pode virar 0 em silêncio. */
export type RiskDraft = Record<string, string>

const cell = (group: string, key: string) => `${group}.${key}`

export function toDraft(config: RiskConfig): RiskDraft {
  const draft: RiskDraft = {}
  for (const g of RISK_GROUPS) {
    const values = config[g.id] as Record<string, number>
    for (const f of g.fields) draft[cell(g.id, f.key)] = String(values[f.key])
  }
  return draft
}

export interface DraftCheck {
  /** Erro por campo ("grupo.CHAVE"). */
  fields: Record<string, string>
  /** Erros que dependem de mais de um campo, por grupo. */
  groups: Partial<Record<keyof RiskConfig, string>>
  /** Só existe quando não há erro nenhum. */
  config: RiskConfig | null
}

export function checkDraft(draft: RiskDraft): DraftCheck {
  const fields: Record<string, string> = {}
  const parsed: Record<string, Record<string, number>> = {}

  for (const g of RISK_GROUPS) {
    const values: Record<string, number> = {}
    parsed[g.id] = values
    for (const f of g.fields) {
      const id = cell(g.id, f.key)
      const raw = (draft[id] ?? '').trim()
      const n = Number(raw)
      if (!/^\d+$/.test(raw)) fields[id] = 'Digite um número inteiro.'
      else if (n < g.min || n > g.max) fields[id] = `De ${String(g.min)} a ${String(g.max)}.`
      else values[f.key] = n
    }
  }

  const groups: DraftCheck['groups'] = {}
  const clean = (group: string) => !Object.keys(fields).some((k) => k.startsWith(`${group}.`))
  const t = parsed.thresholds ?? {}
  if (clean('thresholds') && !((t.MEDIO ?? 0) < (t.ALTO ?? 0) && (t.ALTO ?? 0) < (t.CRITICO ?? 0)))
    groups.thresholds = 'Os limiares precisam ser crescentes: Médio < Alto < Crítico.'
  const v = parsed.victims ?? {}
  if (clean('victims') && (v.fromFive ?? 0) < (v.fromTwo ?? 0)) groups.victims = 'O bônus de 5 ou mais vítimas não pode ser menor que o de 2 ou mais.'

  const ok = Object.keys(fields).length === 0 && Object.keys(groups).length === 0
  return { fields, groups, config: ok ? (parsed as unknown as RiskConfig) : null }
}

/** Quais campos mudaram em relação à versão ativa (para destacar e para o resumo antes de publicar). */
export function changedFields(draft: RiskDraft, base: RiskConfig): string[] {
  const original = toDraft(base)
  return Object.keys(original).filter((k) => (draft[k] ?? '').trim() !== original[k])
}

export function labelOf(id: string): string {
  const [groupId, key] = id.split('.')
  const group = RISK_GROUPS.find((g) => g.id === groupId)
  return `${group?.title ?? String(groupId)} · ${group?.fields.find((f) => f.key === key)?.label ?? String(key)}`
}
