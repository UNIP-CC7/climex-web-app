import styled from 'styled-components'

export const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;
  @media (max-width: 1180px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (max-width: 560px) {
    gap: 10px;
  }
`
export const Stat = styled.div`
  background: ${({ theme }) => theme.colors.panel};
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 16px 18px;
  .l {
    display: flex;
    align-items: center;
    gap: 8px;
    color: ${({ theme }) => theme.colors.muted};
    font-size: 13px;
  }
  .v {
    font-size: 36px;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin: 6px 0 2px;
    small {
      font-size: 20px;
      color: ${({ theme }) => theme.colors.muted};
      font-weight: 400;
    }
  }
  .d {
    font-size: 12.5px;
    color: ${({ theme }) => theme.colors.muted};
  }
  @media (max-width: 560px) {
    padding: 14px;
    .v {
      font-size: 30px;
    }
  }
`
export const Alerted = styled(Stat)`
  background: linear-gradient(160deg, rgba(226, 75, 74, 0.28), ${({ theme }) => theme.colors.panel} 70%);
  border-color: rgba(226, 75, 74, 0.45);
  .l {
    color: #ffc9c8;
  }
`
export const RiskRow = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 8px;
  span {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 6px;
  }
  .critico {
    background: ${({ theme }) => theme.colors.danger};
    color: #fff;
  }
  .alto {
    background: rgba(238, 138, 63, 0.25);
    color: #ffc08c;
  }
  .medio {
    background: rgba(232, 176, 74, 0.2);
    color: #f3cf86;
  }
`
export const Item = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 13px 18px;
  border-top: 1px solid ${({ theme }) => theme.colors.line};
  &:first-child {
    border-top: 0;
  }
  b {
    font-weight: 500;
    display: block;
  }
  span {
    color: ${({ theme }) => theme.colors.muted};
    font-size: 12.5px;
  }
  .ico {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: grid;
    place-items: center;
  }
  .ico[data-sev='ALERTA_MAXIMO'] {
    background: rgba(226, 75, 74, 0.22);
    color: #ff9b9a;
  }
  .ico[data-sev='ALERTA'] {
    background: rgba(238, 138, 63, 0.18);
    color: #ee8a3f;
  }
  .ico[data-sev='ATENCAO'] {
    background: rgba(232, 176, 74, 0.16);
    color: #e8b04a;
  }
  .ico[data-sev='OBSERVACAO'] {
    background: rgba(127, 182, 255, 0.16);
    color: #7fb6ff;
  }
`
export const Occ = styled.div`
  padding: 6px 18px 10px;
  .row {
    padding: 10px 0;
  }
  .t {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6px;
    span:last-child {
      white-space: nowrap;
    }
  }
  .bar {
    height: 6px;
    border-radius: 99px;
    background: rgba(202, 230, 255, 0.12);
    overflow: hidden;
  }
  .bar i {
    display: block;
    height: 100%;
    border-radius: 99px;
    background: ${({ theme }) => theme.colors.primaryLighten};
    transform-origin: left;
    animation: grow 0.8s ${({ theme }) => theme.ease};
  }
  @keyframes grow {
    from {
      transform: scaleX(0);
    }
  }
`
