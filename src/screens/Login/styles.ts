import styled from 'styled-components'

export const Wrap = styled.div`
  min-height: 100dvh; display: grid; place-items: center; padding: 24px;
  background: radial-gradient(900px 500px at 15% 0%, ${({ theme }) => theme.colors.primary}, ${({ theme }) => theme.colors.app});
`
export const Card = styled.div`
  width: min(460px, 100%); display: grid; gap: 16px; padding: 28px;
  background: ${({ theme }) => theme.colors.panel}; border: 1px solid ${({ theme }) => theme.colors.line}; border-radius: ${({ theme }) => theme.radius.md};
  h1 { display: flex; align-items: center; gap: 10px; font-size: 24px; font-weight: 600; letter-spacing: -0.01em; svg { color: ${({ theme }) => theme.colors.primaryLighten}; } }
  p, small { color: ${({ theme }) => theme.colors.muted}; }
  > div { display: grid; gap: 10px; }
`
export const Choice = styled.button`
  display: grid; gap: 2px; text-align: left; padding: 14px 16px; border-radius: ${({ theme }) => theme.radius.sm};
  border: 1px solid ${({ theme }) => theme.colors.line}; transition: background 0.2s, transform 0.12s;
  b { font-weight: 600; } span { color: ${({ theme }) => theme.colors.muted}; font-size: 13px; }
  &:hover:not(:disabled) { background: rgba(202, 230, 255, 0.08); }
  &:active:not(:disabled) { transform: scale(0.99); }
  &:disabled { opacity: 0.6; cursor: wait; }
`
