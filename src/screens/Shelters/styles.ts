import styled from 'styled-components'

export const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 13px;
  input,
  select {
    background: ${({ theme }) => theme.colors.panel};
    border: 1px solid ${({ theme }) => theme.colors.line};
    border-radius: ${({ theme }) => theme.radius.sm};
    padding: 8px 12px;
    color: ${({ theme }) => theme.colors.textOnDark};
    min-width: 190px;
  }
`
export const Meter = styled.div`
  height: 6px;
  margin-top: 6px;
  border-radius: 99px;
  background: rgba(202, 230, 255, 0.12);
  overflow: hidden;
  i {
    display: block;
    height: 100%;
    background: ${({ theme }) => theme.colors.primaryLighten};
    border-radius: 99px;
  }
`
