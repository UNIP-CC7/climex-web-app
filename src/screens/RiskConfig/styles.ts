import styled from 'styled-components'

export const Groups = styled.div`
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  margin-bottom: 16px;
`

export const GroupBody = styled.div`
  display: grid;
  gap: 12px;
  padding: 16px 18px 18px;
`

export const Hint = styled.p`
  color: ${({ theme }) => theme.colors.muted};
  font-size: 12.5px;
  line-height: 1.45;
`

export const NumberField = styled.label<{ $changed?: boolean }>`
  display: grid;
  grid-template-columns: 1fr 84px;
  align-items: center;
  gap: 10px;
  font-size: 13.5px;
  color: ${({ theme }) => theme.colors.textOnDark};
  input {
    text-align: right;
    font-family: ${({ theme }) => theme.font.mono};
    background: ${({ theme }) => theme.colors.app};
    border: 1px solid ${({ $changed, theme }) => ($changed ? theme.colors.primaryLighten : theme.colors.line)};
    border-radius: ${({ theme }) => theme.radius.sm};
    padding: 8px 10px;
    color: ${({ theme }) => theme.colors.textOnDark};
  }
  input[aria-invalid='true'] {
    border-color: ${({ theme }) => theme.colors.danger};
  }
  input:focus {
    outline: 2px solid ${({ theme }) => theme.colors.primaryLighten};
    outline-offset: 0;
  }
  .err {
    grid-column: 1 / -1;
    color: #ff9b9a;
    font-size: 12px;
    text-align: right;
  }
`

export const GroupError = styled.p`
  color: #ff9b9a;
  font-size: 12.5px;
`

export const Publish = styled.div`
  display: grid;
  gap: 14px;
  padding: 16px 18px 18px;
  textarea {
    min-height: 72px;
    resize: vertical;
  }
`

export const Changes = styled.ul`
  list-style: none;
  display: grid;
  gap: 4px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textOnDark};
  li span {
    color: ${({ theme }) => theme.colors.muted};
  }
  li .arrow {
    font-family: ${({ theme }) => theme.font.mono};
  }
`

export const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  .sp {
    flex: 1;
  }
`
