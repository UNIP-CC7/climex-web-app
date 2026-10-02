import styled from 'styled-components'

export const Kpis = styled.div`
  display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 16px; margin-bottom: 16px;
  @media (max-width: 1180px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
`
export const Kpi = styled.div`
  background: ${({ theme }) => theme.colors.panel}; border: 1px solid ${({ theme }) => theme.colors.line}; border-radius: ${({ theme }) => theme.radius.md}; padding: 16px 18px;
  span { display: block; color: ${({ theme }) => theme.colors.muted}; font-size: 13px; }
  b { display: block; font-size: 30px; font-weight: 600; margin-top: 6px; letter-spacing: -0.02em; }
`
