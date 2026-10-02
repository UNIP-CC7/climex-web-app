import { createGlobalStyle } from 'styled-components'

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; margin: 0; }
  html, body, #root { min-height: 100%; }
  body {
    background: ${({ theme }) => theme.colors.app};
    color: ${({ theme }) => theme.colors.textOnDark};
    font-family: ${({ theme }) => theme.font.sans};
    font-size: 14px;
    line-height: 1.45;
    -webkit-font-smoothing: antialiased;
  }
  button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; }
  input, select, textarea { font: inherit; color: inherit; }
  :focus-visible { outline: 2px solid ${({ theme }) => theme.colors.primaryLighten}; outline-offset: 2px; }
  .mono { font-family: ${({ theme }) => theme.font.mono}; font-variant-numeric: tabular-nums; }

  /* mapa: tiles claros do OpenStreetMap invertidos para o tema escuro (sem chave de API) */
  .leaflet-container { font-family: ${({ theme }) => theme.font.sans}; background: #0b2447; }
  .leaflet-tile-pane { filter: invert(1) hue-rotate(195deg) brightness(.85) contrast(.95) saturate(.55); }
  .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: ${({ theme }) => theme.colors.panel}; color: ${({ theme }) => theme.colors.textOnDark}; border-radius: 10px; }
  .leaflet-control-attribution { background: rgba(3,26,60,.7) !important; color: ${({ theme }) => theme.colors.muted} !important; }
  .leaflet-control-attribution a { color: ${({ theme }) => theme.colors.primaryLighten} !important; }
  .leaflet-div-icon { background: none; border: 0; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
  }
`
