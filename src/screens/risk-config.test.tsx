import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useAuth } from '@/features/auth/store'
import { loginAs, renderWithApp } from '@/test-utils'
import RiskConfig from './RiskConfig'

beforeEach(() => {
  localStorage.clear()
  loginAs('GESTOR')
})
afterEach(() => {
  useAuth.setState({ user: null })
})

const field = (group: string, label: string) => screen.getByLabelText(`${group}: ${label}`) as HTMLInputElement
const publishButton = () => screen.getByRole('button', { name: 'Publicar nova versão' })

describe('Nível de risco (pesos do NR)', () => {
  it('mostra a versão em vigor, todos os blocos e o histórico', async () => {
    renderWithApp(<RiskConfig />)
    expect(await screen.findByText('Versão 1 em vigor')).toBeInTheDocument()
    for (const title of [
      'Tipo da ocorrência',
      'Nível do alerta na área',
      'Nível da água',
      'Risco estrutural',
      'Vulnerabilidade',
      'Número de vítimas',
      'Limiares das faixas',
    ])
      expect(screen.getByRole('group', { name: title })).toBeInTheDocument()
    expect(field('Tipo da ocorrência', 'Pessoa ferida').value).toBe('40')
    expect(field('Limiares das faixas', 'Crítico a partir de').value).toBe('80')
    expect(await screen.findByText('Pesos iniciais (padrão do sistema)')).toBeInTheDocument()
    expect(publishButton()).toBeDisabled()
    expect(screen.getByText('Altere algum peso para poder publicar.')).toBeInTheDocument()
  })

  it('valor inválido aparece no campo e trava a publicação, mesmo com justificativa', async () => {
    renderWithApp(<RiskConfig />)
    await screen.findByText('Versão 1 em vigor')
    fireEvent.change(field('Vulnerabilidade', 'Idosos'), { target: { value: '99' } })
    fireEvent.change(screen.getByLabelText(/Justificativa/), { target: { value: 'Teste de limite' } })
    expect(screen.getByText('De 0 a 30.')).toBeInTheDocument()
    expect(field('Vulnerabilidade', 'Idosos')).toHaveAttribute('aria-invalid', 'true')
    expect(publishButton()).toBeDisabled()

    fireEvent.change(field('Limiares das faixas', 'Alto a partir de'), { target: { value: '20' } })
    expect(screen.getByText(/Os limiares precisam ser crescentes/)).toBeInTheDocument()
  })

  it('resume o que mudou, exige justificativa e descarta as alterações', async () => {
    renderWithApp(<RiskConfig />)
    await screen.findByText('Versão 1 em vigor')
    fireEvent.change(field('Vulnerabilidade', 'Idosos'), { target: { value: '15' } })

    const changes = within(screen.getByRole('list', { name: 'Alterações' }))
    expect(changes.getByText('Vulnerabilidade · Idosos:')).toBeInTheDocument()
    expect(changes.getByText('10 → 15')).toBeInTheDocument()
    expect(publishButton()).toBeDisabled()
    expect(screen.getByText('Mínimo de 5 caracteres.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Descartar alterações' }))
    expect(field('Vulnerabilidade', 'Idosos').value).toBe('10')
    expect(screen.getByText('Altere algum peso para poder publicar.')).toBeInTheDocument()
  })

  it('publica uma nova versão: ela vira a ativa e a anterior fica no histórico', async () => {
    renderWithApp(<RiskConfig />)
    await screen.findByText('Versão 1 em vigor')
    fireEvent.change(field('Vulnerabilidade', 'Idosos'), { target: { value: '15' } })
    fireEvent.change(screen.getByLabelText(/Justificativa/), { target: { value: 'Mais peso para idosos' } })
    expect(publishButton()).toBeEnabled()
    fireEvent.click(publishButton())

    expect(await screen.findByText('Versão 2 em vigor')).toBeInTheDocument()
    await waitFor(() => expect(field('Vulnerabilidade', 'Idosos').value).toBe('15'))
    expect(screen.getByLabelText(/Justificativa/)).toHaveValue('')
    const rows = await screen.findAllByRole('row')
    expect(within(rows[1] as HTMLElement).getByText('Em vigor')).toBeInTheDocument()
    expect(within(rows[1] as HTMLElement).getByText('Mais peso para idosos')).toBeInTheDocument()
    expect(within(rows[2] as HTMLElement).getByText('Anterior')).toBeInTheDocument()
  })

  it('carrega uma versão antiga e restaura o padrão do sistema no formulário', async () => {
    renderWithApp(<RiskConfig />)
    await screen.findByText('Versão 2 em vigor')
    fireEvent.click(await screen.findByRole('button', { name: 'Carregar a versão 1 no formulário' }))
    expect(field('Vulnerabilidade', 'Idosos').value).toBe('10')
    expect(publishButton()).toBeDisabled()

    fireEvent.change(field('Tipo da ocorrência', 'Pessoa ferida'), { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar padrão do sistema' }))
    expect(field('Tipo da ocorrência', 'Pessoa ferida').value).toBe('40')
  })
})
