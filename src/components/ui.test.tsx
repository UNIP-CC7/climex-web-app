import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { Btn, Empty, ErrorMsg, RiskBadge, SeverityBadge, Skeleton } from './ui'
import { renderWithApp } from '@/test-utils'

describe('componentes de interface', () => {
  it('selo de severidade mostra o nome por extenso', () => {
    renderWithApp(<SeverityBadge severity="ALERTA_MAXIMO" />)
    expect(screen.getByText('Alerta Máximo')).toBeInTheDocument()
  })

  it('selo de risco mostra a pontuação, a faixa e o SOS', () => {
    renderWithApp(<RiskBadge risk={{ score: 92, band: 'CRITICO' }} sos />)
    expect(screen.getByLabelText('Nível de risco 92, Crítico')).toHaveTextContent('92')
    expect(screen.getByText('SOS')).toBeInTheDocument()
  })

  it('selo de risco sem SOS não mostra a etiqueta', () => {
    renderWithApp(<RiskBadge risk={{ score: 20, band: 'BAIXO' }} />)
    expect(screen.queryByText('SOS')).not.toBeInTheDocument()
  })

  it('estado vazio, carregando e erro', () => {
    renderWithApp(
      <>
        <Empty title="Fila vazia" hint="Nada por aqui" />
        <Skeleton rows={3} />
        <ErrorMsg error={new Error('Base fora do ar')} />
        <ErrorMsg error="texto solto" />
      </>,
    )
    expect(screen.getByText('Fila vazia')).toBeInTheDocument()
    expect(screen.getByLabelText('Carregando')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Base fora do ar')).toBeInTheDocument()
    expect(screen.getByText('Tente novamente em instantes.')).toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(2)
  })

  it('botão desabilitado não é clicável', () => {
    renderWithApp(<Btn disabled>Salvar</Btn>)
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
  })
})
