import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useAuth } from '@/features/auth/store'
import { loginAs, renderWithApp } from '@/test-utils'
import { InmetImport } from './Alerts/InmetImport'
import ShelterReview from './ShelterReview'

beforeEach(() => {
  localStorage.clear()
  loginAs('GESTOR')
})
afterEach(() => {
  useAuth.setState({ user: null })
})

const tab = (name: RegExp) => screen.getByRole('button', { name })

// Os testes seguem uma ordem: o serviço simulado guarda o estado entre eles, como a API guardaria.
describe('Revisão de abrigos', () => {
  it('lista os candidatos, com o total na aba, e filtra pela busca', async () => {
    renderWithApp(<ShelterReview />)
    expect(await screen.findByText('Escola Municipal Exemplo A')).toBeInTheDocument()
    expect(screen.getByText('Ginásio Poliesportivo Exemplo B')).toBeInTheDocument()
    expect(tab(/^Candidatos · 3$/)).toHaveAttribute('aria-pressed', 'true')

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar por nome ou endereço' }), { target: { value: 'ginásio' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(screen.queryByText('Escola Municipal Exemplo A')).not.toBeInTheDocument())
    expect(screen.getByText('Ginásio Poliesportivo Exemplo B')).toBeInTheDocument()
  })

  it('confirma um candidato: exige capacidade, grava os recursos e ele passa para os confirmados', async () => {
    renderWithApp(<ShelterReview />)
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar Escola Municipal Exemplo A' }))

    const form = screen.getByRole('form', { name: 'Confirmar Escola Municipal Exemplo A como abrigo' })
    const submit = within(form).getByRole('button', { name: 'Confirmar como abrigo' })
    expect(submit).toBeDisabled()
    expect(within(form).getByRole('alert')).toHaveTextContent('Informe um número inteiro de 1 a 100.000')

    const capacity = within(form).getByLabelText(/Capacidade/)
    fireEvent.change(capacity, { target: { value: '0' } })
    expect(submit).toBeDisabled()
    fireEvent.change(capacity, { target: { value: '150' } })
    fireEvent.click(within(form).getByLabelText('Água'))
    fireEvent.change(within(form).getByLabelText(/Nota da revisão/), { target: { value: 'ab' } })
    expect(submit).toBeDisabled()
    fireEvent.change(within(form).getByLabelText(/Nota da revisão/), { target: { value: 'Vistoriada em 12/10' } })
    expect(submit).toBeEnabled()
    fireEvent.click(submit)

    await waitFor(() => expect(screen.queryByText('Escola Municipal Exemplo A')).not.toBeInTheDocument())
    fireEvent.click(tab(/^Confirmados/))
    const row = (await screen.findByText('Escola Municipal Exemplo A')).closest('tr') as HTMLElement
    expect(within(row).getByText('150')).toBeInTheDocument()
    expect(within(row).getByText('Vistoriada em 12/10')).toBeInTheDocument()
  })

  it('rejeita só com o motivo, e o local vai para os rejeitados', async () => {
    renderWithApp(<ShelterReview />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rejeitar Ginásio Poliesportivo Exemplo B' }))

    const form = screen.getByRole('form', { name: 'Rejeitar Ginásio Poliesportivo Exemplo B' })
    const submit = within(form).getByRole('button', { name: 'Rejeitar local' })
    expect(submit).toBeDisabled()
    fireEvent.change(within(form).getByLabelText(/Motivo da rejeição/), { target: { value: 'Particular' } })
    expect(submit).toBeEnabled()
    fireEvent.click(submit)

    await waitFor(() => expect(screen.queryByText('Ginásio Poliesportivo Exemplo B')).not.toBeInTheDocument())
    fireEvent.click(tab(/^Rejeitados/))
    const row = (await screen.findByText('Ginásio Poliesportivo Exemplo B')).closest('tr') as HTMLElement
    expect(within(row).getByText('Particular')).toBeInTheDocument()
  })

  it('devolve um rejeitado para a lista de candidatos', async () => {
    renderWithApp(<ShelterReview />)
    fireEvent.click(tab(/^Rejeitados/))
    fireEvent.click(await screen.findByRole('button', { name: 'Devolver Salão Paroquial Exemplo D a candidato' }))
    await waitFor(() => expect(screen.queryByText('Salão Paroquial Exemplo D')).not.toBeInTheDocument())
    fireEvent.click(tab(/^Candidatos/))
    expect(await screen.findByText('Salão Paroquial Exemplo D')).toBeInTheDocument()
  })

  it('esconde a importação de abrigos do gestor', async () => {
    renderWithApp(<ShelterReview />)
    await screen.findByText('Centro Comunitário Exemplo C')
    expect(screen.queryByRole('region', { name: 'Importar candidatos' })).not.toBeInTheDocument()
  })

  it('mostra a importação ao administrador, com confirmação antes de importar', async () => {
    loginAs('ADMIN')
    renderWithApp(<ShelterReview />)
    const region = await screen.findByRole('region', { name: 'Importar candidatos' })
    fireEvent.click(within(region).getByRole('button', { name: 'Importar abrigos do OpenStreetMap' }))
    expect(within(region).queryByRole('status')).not.toBeInTheDocument()
    fireEvent.click(within(region).getByRole('button', { name: 'Sim, importar' }))
    expect(await within(region).findByRole('status')).toHaveTextContent('4 novos')
  })
})

describe('Importação do INMET', () => {
  it('pede confirmação, avisa das notificações e mostra o resumo', async () => {
    loginAs('ADMIN')
    renderWithApp(<InmetImport />)
    fireEvent.click(screen.getByRole('button', { name: 'Importar avisos do INMET' }))
    expect(screen.getByText('Isso pode enviar notificações. Importar agora?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Importar avisos do INMET' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sim, importar' }))
    expect(await screen.findByRole('status')).toHaveTextContent('1 novos, 1 atualizados')
  })
})
