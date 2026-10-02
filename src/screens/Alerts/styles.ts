import styled from 'styled-components'

export const Split = styled.div`
  display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); align-items: start;
  @media (max-width: 1180px) { grid-template-columns: 1fr; }
`
