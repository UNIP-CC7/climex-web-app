/** Tokens herdados do climex-mobile-app (src/theme/index.ts), estendidos para o tema escuro do painel. */
export const theme = {
  colors: {
    primary: '#05224d',
    primaryLighten: '#CAE6FF',
    background: '#263645',
    secondary: '#E8E6DF',
    text: '#1E1E1E',
    white: '#FFFFFF',
    danger: '#E24B4A',
    dangerLighten: '#FCEBEB',
    dangerContrast: '#791F1F',
    // derivados do painel
    app: '#031a3c',
    panel: '#0a2a5c',
    panelAlt: '#0e3270',
    line: 'rgba(202,230,255,.14)',
    textOnDark: '#E8E6DF',
    muted: '#9db3cf',
    ok: '#5fc59a',
    severity: { obs: '#7fb6ff', atn: '#e8b04a', alr: '#ee8a3f', max: '#E24B4A' },
  },
  radius: { md: '12px', sm: '8px', pill: '99px' },
  font: { sans: "'Geist', system-ui, sans-serif", mono: "'Geist Mono', ui-monospace, monospace" },
  ease: 'cubic-bezier(.16,1,.3,1)',
} as const

export type AppTheme = typeof theme
