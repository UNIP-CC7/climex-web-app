import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from './store'

const user = { id: 's1', name: 'Marcos Cavalcante', role: 'GESTOR' as const }

afterEach(() => {
  vi.restoreAllMocks()
  useAuth.setState({ user: null })
  localStorage.clear()
})

describe('sessão', () => {
  it('entrar guarda a sessão e sair apaga', () => {
    useAuth.getState().signIn(user)
    expect(useAuth.getState().user?.role).toBe('GESTOR')
    expect(JSON.parse(localStorage.getItem('climex.session') ?? 'null')).toEqual(user)
    useAuth.getState().signOut()
    expect(useAuth.getState().user).toBeNull()
    expect(localStorage.getItem('climex.session')).toBeNull()
  })

  it('entrar e sair apagam o cache salvo, para um perfil não herdar dados do outro', () => {
    localStorage.setItem('climex.cache', '{"dados":"do perfil anterior"}')
    useAuth.getState().signIn(user)
    expect(localStorage.getItem('climex.cache')).toBeNull()

    localStorage.setItem('climex.cache', '{"dados":"desta sessão"}')
    useAuth.getState().signOut()
    expect(localStorage.getItem('climex.cache')).toBeNull()
  })

  it('segue em memória quando o armazenamento do navegador está bloqueado', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(() => useAuth.getState().signIn(user)).not.toThrow()
    expect(useAuth.getState().user?.name).toBe('Marcos Cavalcante')
  })
})
