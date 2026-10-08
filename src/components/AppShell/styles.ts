import styled from 'styled-components'

export const Shell = styled.div`
  display: grid;
  grid-template-columns: 232px 1fr;
  min-height: 100dvh;
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`
export const Side = styled.aside`
  background: ${({ theme }) => theme.colors.primary};
  border-right: 1px solid ${({ theme }) => theme.colors.line};
  padding: 20px 14px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  position: sticky;
  top: 0;
  height: 100dvh;
  @media (max-width: 900px) {
    position: fixed;
    inset: auto 0 0 0;
    height: auto;
    z-index: 1000;
    flex-direction: row;
    padding: 6px 8px;
    border-right: 0;
    border-top: 1px solid ${({ theme }) => theme.colors.line};
    gap: 0;
  }
`
export const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 8px;
  font-weight: 600;
  font-size: 18px;
  letter-spacing: -0.01em;
  svg {
    color: ${({ theme }) => theme.colors.primaryLighten};
  }
  @media (max-width: 900px) {
    display: none;
  }
`
export const Nav = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 2px;
  a {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: ${({ theme }) => theme.radius.sm};
    color: ${({ theme }) => theme.colors.muted};
    text-decoration: none;
    transition:
      background 0.2s ${({ theme }) => theme.ease},
      color 0.2s ${({ theme }) => theme.ease},
      transform 0.12s;
  }
  a:hover {
    background: rgba(202, 230, 255, 0.07);
    color: ${({ theme }) => theme.colors.textOnDark};
  }
  a:active {
    transform: scale(0.98);
  }
  a.active {
    background: rgba(202, 230, 255, 0.12);
    color: ${({ theme }) => theme.colors.primaryLighten};
  }
  @media (max-width: 900px) {
    flex-direction: row;
    width: 100%;
    justify-content: space-around;
    a {
      flex-direction: column;
      gap: 2px;
      padding: 6px 8px;
      font-size: 11px;
    }
    .extra {
      display: none;
    }
  }
`
export const NavGroup = styled.small`
  margin: 14px 12px 4px;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`
export const Badge = styled.span`
  margin-left: auto;
  background: ${({ theme }) => theme.colors.danger};
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 99px;
  @media (max-width: 900px) {
    position: absolute;
    margin: 0;
    transform: translate(14px, -6px);
  }
`
export const Me = styled.div`
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: rgba(202, 230, 255, 0.06);
  b {
    display: block;
    font-weight: 500;
  }
  span {
    color: ${({ theme }) => theme.colors.muted};
    font-size: 12px;
  }
  > div:not(:first-child) {
    flex: 1;
    min-width: 0;
  }
  button {
    color: ${({ theme }) => theme.colors.muted};
    padding: 6px;
    border-radius: 8px;
    &:hover {
      color: ${({ theme }) => theme.colors.textOnDark};
      background: rgba(202, 230, 255, 0.1);
    }
  }
  @media (max-width: 900px) {
    display: none;
  }
`
export const Avatar = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primaryLighten};
  color: ${({ theme }) => theme.colors.primary};
  display: grid;
  place-items: center;
  font-weight: 600;
  flex-shrink: 0;
`
export const Main = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
`
export const Top = styled.header`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 28px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.line};
  position: sticky;
  top: 0;
  background: rgba(3, 26, 60, 0.88);
  backdrop-filter: blur(10px);
  z-index: 900;
  @media (max-width: 900px) {
    padding: 12px 16px;
    .hide {
      display: none;
    }
  }
`
export const TopTitle = styled.h1`
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
`
export const SubTitle = styled.div`
  color: ${({ theme }) => theme.colors.muted};
  font-size: 13px;
  @media (max-width: 900px) {
    display: none;
  }
`
export const Pill = styled.span<{ $live?: boolean }>`
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 99px;
  font-size: 13px;
  border: 1px solid ${({ $live }) => ($live ? 'rgba(95,197,154,.35)' : 'rgba(202,230,255,.14)')};
  color: ${({ $live, theme }) => ($live ? theme.colors.ok : theme.colors.muted)};
`
export const Content = styled.main`
  min-width: 0;
`
