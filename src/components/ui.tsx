import styled, { keyframes } from 'styled-components'

import { RISK_BAND_LABEL, SEVERITY_LABEL, type Risk, type RiskBand, type Severity } from '@/domain/types'

const rise = keyframes`from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none }`
const shimmer = keyframes`from { background-position: 200% 0 } to { background-position: -200% 0 }`

export const Page = styled.section`
  padding: 24px 28px 40px;
  animation: ${rise} 0.35s ${({ theme }) => theme.ease};
  @media (max-width: 900px) {
    padding: 16px 16px 96px;
  }
`

export const Panel = styled.div`
  background: ${({ theme }) => theme.colors.panel};
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
`
export const PanelHead = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.line};
  h2 {
    font-size: 15px;
    font-weight: 600;
  }
  .sp {
    flex: 1;
  }
`
export const Grid = styled.div<{ $cols?: string }>`
  display: grid;
  gap: 16px;
  grid-template-columns: ${({ $cols }) => $cols ?? '1fr'};
  @media (max-width: 1180px) {
    grid-template-columns: 1fr;
  }
`
export const Note = styled.p`
  margin-top: 14px;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 12.5px;
`
export const LinkBtn = styled.button`
  color: ${({ theme }) => theme.colors.primaryLighten};
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  &:hover {
    text-decoration: underline;
  }
`

export const Btn = styled.button<{ $ghost?: boolean; $danger?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-radius: ${({ theme }) => theme.radius.sm};
  font-weight: 600;
  white-space: nowrap;
  transition:
    transform 0.12s,
    filter 0.2s;
  background: ${({ $ghost, $danger, theme }) => ($danger ? theme.colors.danger : $ghost ? 'transparent' : theme.colors.primaryLighten)};
  color: ${({ $ghost, $danger, theme }) => ($danger ? '#fff' : $ghost ? theme.colors.primaryLighten : theme.colors.primary)};
  border: ${({ $ghost, theme }) => ($ghost ? `1px solid ${theme.colors.line}` : '0')};
  &:hover:not(:disabled) {
    filter: brightness(1.07);
  }
  &:active:not(:disabled) {
    transform: scale(0.97);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`
export const Chip = styled.button<{ $on?: boolean }>`
  padding: 8px 14px;
  border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primaryLighten : theme.colors.line)};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ $on, theme }) => ($on ? theme.colors.primaryLighten : 'transparent')};
  color: ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.muted)};
  font-weight: ${({ $on }) => ($on ? 500 : 400)};
  transition: 0.2s ${({ theme }) => theme.ease};
  &:hover {
    color: ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.textOnDark)};
  }
`
export const Toolbar = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  align-items: center;
`

export const TableWrap = styled.div`
  overflow-x: auto;
`
export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  th {
    font-weight: 500;
    color: ${({ theme }) => theme.colors.muted};
    font-size: 12.5px;
    text-align: left;
    padding: 12px 18px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.line};
    white-space: nowrap;
  }
  td {
    padding: 13px 18px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.line};
    vertical-align: middle;
  }
  tbody tr {
    transition: background 0.2s;
  }
  tbody tr:hover {
    background: rgba(202, 230, 255, 0.04);
  }
  tbody tr:last-child td {
    border-bottom: 0;
  }
  small {
    display: block;
    color: ${({ theme }) => theme.colors.muted};
    font-size: 12.5px;
  }
`

/* ---------- selos ---------- */
const SEV_STYLE = {
  OBSERVACAO: ['rgba(127,182,255,.16)', '#7fb6ff'],
  ATENCAO: ['rgba(232,176,74,.16)', '#e8b04a'],
  ALERTA: ['rgba(238,138,63,.18)', '#ee8a3f'],
  ALERTA_MAXIMO: ['rgba(226,75,74,.22)', '#ff9b9a'],
} as const

const SevTag = styled.span<{ $s: Severity }>`
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  padding: 3px 9px;
  border-radius: 6px;
  white-space: nowrap;
  background: ${({ $s }) => SEV_STYLE[$s][0]};
  color: ${({ $s }) => SEV_STYLE[$s][1]};
`
export const SeverityBadge = ({ severity }: { severity: Severity }) => <SevTag $s={severity}>{SEVERITY_LABEL[severity]}</SevTag>

const RISK_STYLE: Record<RiskBand, [string, string]> = {
  CRITICO: ['#E24B4A', '#fff'],
  ALTO: ['rgba(238,138,63,.25)', '#ffc08c'],
  MEDIO: ['rgba(232,176,74,.2)', '#f3cf86'],
  BAIXO: ['rgba(127,182,255,.18)', '#7fb6ff'],
}
const RiskTag = styled.span<{ $r: RiskBand }>`
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
  min-width: 40px;
  padding: 4px 8px;
  border-radius: 8px;
  font-weight: 600;
  font-family: ${({ theme }) => theme.font.mono};
  background: ${({ $r }) => RISK_STYLE[$r][0]};
  color: ${({ $r }) => RISK_STYLE[$r][1]};
  small {
    font-family: ${({ theme }) => theme.font.sans};
    font-size: 11px;
  }
`
const SosTag = styled.span`
  margin-left: 6px;
  font-size: 11px;
  font-weight: 700;
  background: ${({ theme }) => theme.colors.dangerLighten};
  color: ${({ theme }) => theme.colors.dangerContrast};
  padding: 2px 6px;
  border-radius: 5px;
`
export const RiskBadge = ({ risk, sos }: { risk: Risk; sos?: boolean }) => (
  <span>
    <RiskTag $r={risk.band} aria-label={`Nível de risco ${risk.score}, ${RISK_BAND_LABEL[risk.band]}`}>
      {risk.score}
      <small>{RISK_BAND_LABEL[risk.band]}</small>
    </RiskTag>
    {sos && <SosTag>SOS</SosTag>}
  </span>
)

/* ---------- estados vazios, carregando e erro ---------- */
const Skel = styled.div<{ $h?: number }>`
  height: ${({ $h }) => $h ?? 16}px;
  border-radius: 8px;
  background: linear-gradient(90deg, rgba(202, 230, 255, 0.05) 25%, rgba(202, 230, 255, 0.12) 50%, rgba(202, 230, 255, 0.05) 75%);
  background-size: 200% 100%;
  animation: ${shimmer} 1.6s linear infinite;
`
export const Skeleton = ({ h, rows = 1 }: { h?: number; rows?: number }) => (
  <div style={{ display: 'grid', gap: 10, padding: 18 }} aria-busy="true" aria-label="Carregando">
    {Array.from({ length: rows }, (_, i) => (
      <Skel key={i} $h={h} />
    ))}
  </div>
)
const Msg = styled.div`
  padding: 28px 18px;
  text-align: center;
  color: ${({ theme }) => theme.colors.muted};
  strong {
    display: block;
    color: ${({ theme }) => theme.colors.textOnDark};
    font-weight: 500;
    margin-bottom: 4px;
  }
`
export const Empty = ({ title, hint }: { title: string; hint?: string }) => (
  <Msg>
    <strong>{title}</strong>
    {hint}
  </Msg>
)
export const ErrorMsg = ({ error }: { error: unknown }) => (
  <Msg role="alert">
    <strong>Não foi possível carregar</strong>
    {error instanceof Error ? error.message : 'Tente novamente em instantes.'}
  </Msg>
)

/** Erro de uma ação do usuário (salvar, encerrar, concluir). O react-query zera o erro quando a próxima tentativa começa. */
export const ActionError = ({ error }: { error: unknown }) =>
  error ? (
    <p role="alert" style={{ color: '#ff9b9a', margin: '0 0 10px' }}>
      {error instanceof Error ? error.message : 'Não foi possível concluir a ação. Tente de novo.'}
    </p>
  ) : null

/* ---------- formulários ---------- */
export const Field = styled.label`
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.muted};
  input,
  select,
  textarea {
    background: ${({ theme }) => theme.colors.app};
    border: 1px solid ${({ theme }) => theme.colors.line};
    border-radius: ${({ theme }) => theme.radius.sm};
    padding: 10px 12px;
    color: ${({ theme }) => theme.colors.textOnDark};
  }
  input:focus,
  select:focus,
  textarea:focus {
    outline: 2px solid ${({ theme }) => theme.colors.primaryLighten};
    outline-offset: 0;
  }
`
export const FormGrid = styled.form`
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 18px;
  @media (max-width: 700px) {
    grid-template-columns: 1fr;
  }
  .full {
    grid-column: 1 / -1;
  }
`
