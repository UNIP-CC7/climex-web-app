import styled from 'styled-components'

export const SearchForm = styled.form`
  display: flex;
  gap: 8px;
  align-items: center;
  margin-left: auto;
  input {
    min-width: 220px;
    background: ${({ theme }) => theme.colors.app};
    border: 1px solid ${({ theme }) => theme.colors.line};
    border-radius: ${({ theme }) => theme.radius.sm};
    padding: 8px 10px;
    color: ${({ theme }) => theme.colors.textOnDark};
  }
`

export const Meta = styled.span`
  display: block;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 12px;
  margin-top: 2px;
`

export const RowActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

export const DecisionCell = styled.td`
  background: ${({ theme }) => theme.colors.app};
`

export const Decision = styled.form`
  display: grid;
  gap: 12px;
  max-width: 560px;
  padding: 6px 2px 10px;
  label {
    display: grid;
    gap: 4px;
    font-size: 13px;
    color: ${({ theme }) => theme.colors.textOnDark};
  }
  input[type='text'],
  input[type='tel'],
  input:not([type]),
  input[inputmode='numeric'],
  textarea {
    background: ${({ theme }) => theme.colors.panel};
    border: 1px solid ${({ theme }) => theme.colors.line};
    border-radius: ${({ theme }) => theme.radius.sm};
    padding: 8px 10px;
    color: ${({ theme }) => theme.colors.textOnDark};
  }
  .checks {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
  }
  .checks label {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .err {
    color: ${({ theme }) => theme.colors.danger};
    font-size: 12px;
  }
`

export const Pager = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 13px;
`

export const ImportBox = styled.div`
  display: grid;
  gap: 10px;
  padding: 14px 18px;
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .result {
    font-size: 13px;
    color: ${({ theme }) => theme.colors.textOnDark};
  }
`
