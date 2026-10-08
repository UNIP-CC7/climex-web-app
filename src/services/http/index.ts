import type { Alert, AppUser } from '@/domain/types'
import type { Services } from '../types'
import { createHttpClient, type HttpClient } from './client'
import type { ApiAlert, ApiAuditEntry, ApiChangeRoleResult, ApiCheckInResult, ApiCreateAlert, ApiRescue, ApiShelter, ApiTokenPair } from './dto'
import {
  alertDescription,
  alertFromApi,
  auditFromApi,
  buildSummary,
  rescueFromApi,
  rescueStatusToApi,
  roleToApi,
  severityToApi,
  shelterFromApi,
  shelterPatchToApi,
  toE164,
  toSessionUser,
} from './mappers'
import { browserTokens, type TokenStore } from './session'

const seg = encodeURIComponent // ids vão no meio do caminho: um '/' ou '?' não pode mudar a rota
const CITY = 'Santana de Parnaíba'
const STATE = 'SP'

export function createHttpServices(client: HttpClient = createHttpClient(), tokens: TokenStore = browserTokens): Services {
  const listAlerts = async (): Promise<Alert[]> => (await client.all<ApiAlert>('/alerts')).map(alertFromApi)
  const listShelters = async () => (await client.get<{ data: ApiShelter[] }>('/shelters')).data.map(shelterFromApi)
  const listRescue = async () => (await client.all<ApiRescue>('/rescue')).map(rescueFromApi)

  return {
    auth: {
      login: () => Promise.reject(new Error('O modo simulado não está ativo. Entre com telefone e senha.')),
      async loginWithPassword(phone, password) {
        const pair = await client.post<ApiTokenPair>('/auth/login', { phone: toE164(phone), password }, { auth: false })
        const user = toSessionUser(pair.user)
        if (!user) {
          // a API aceita o cidadão no login, mas ele não usa o painel: encerra a sessão que acabou de abrir sem guardar os tokens
          await client.logout({ accessToken: pair.accessToken, refreshToken: pair.refreshToken }).catch(() => undefined)
          throw new Error('Este painel é para agentes, gestores e administradores. Cidadãos acessam pelo aplicativo no celular.')
        }
        tokens.save({ accessToken: pair.accessToken, refreshToken: pair.refreshToken })
        return user
      },
      // só revoga no servidor com os tokens de agora. Apagar o armazenamento é do signOut, para um logout lento
      // não derrubar os tokens de um login feito logo depois.
      async logout() {
        const current = tokens.read() // capturado agora: o signOut apaga o armazenamento logo em seguida
        if (current) await client.logout(current).catch(() => undefined)
      },
    },
    alerts: {
      list: listAlerts,
      async create({ title, severity, neighborhood, center, radiusKm, hours }) {
        const body: ApiCreateAlert = {
          title,
          description: alertDescription(title, neighborhood),
          level: severityToApi(severity),
          latitude: center[0],
          longitude: center[1],
          radiusMeters: Math.round(radiusKm * 1000),
          city: CITY,
          state: STATE,
          expiresAt: new Date(Date.now() + hours * 3_600_000).toISOString(),
        }
        return alertFromApi(await client.post<ApiAlert>('/alerts', body))
      },
      async close(id) {
        await client.patch(`/alerts/${seg(id)}/status`, { status: 'RESOLVED' })
      },
    },
    shelters: {
      list: listShelters,
      async update(id, patch) {
        return shelterFromApi(await client.patch<ApiShelter>(`/shelters/${seg(id)}`, shelterPatchToApi(patch)))
      },
      async checkIn(id, delta) {
        if (delta < 0) throw new Error('A API ainda não tem rota para registrar a saída de pessoas do abrigo.')
        if (delta === 0) throw new Error('Informe quantas pessoas entraram.')
        const r = await client.post<ApiCheckInResult>(`/shelters/${seg(id)}/check-in`, { guestCount: delta })
        return shelterFromApi(r.shelter)
      },
    },
    rescue: {
      list: listRescue,
      // o parâmetro `agent` do contrato é um nome; na API quem muda o status vira o agente do caso, então ele não é enviado
      async setStatus(id, status, _agent, outcome) {
        return rescueFromApi(await client.patch<ApiRescue>(`/rescue/${seg(id)}/status`, rescueStatusToApi(status, outcome)))
      },
    },
    dashboard: {
      async summary() {
        const [alerts, shelters, rescue] = await Promise.all([listAlerts(), listShelters(), listRescue()])
        return buildSummary(alerts, shelters, rescue)
      },
    },
    users: {
      // a API não tem GET /admin/users nem ativar/desativar. A tela Usuários explica a lacuna em vez de listar.
      list: async (): Promise<AppUser[]> => [],
      async setRole(id, role) {
        const r = await client.patch<ApiChangeRoleResult>(`/admin/users/${seg(id)}/role`, {
          role: roleToApi(role),
          reason: 'Perfil alterado pelo painel Climex',
        })
        return { id: r.user.id, name: r.user.name, role, phone: r.user.phone, lastAccess: r.user.createdAt, active: true }
      },
      setActive: () => Promise.reject(new Error('A API ainda não permite ativar ou desativar usuários.')),
    },
    audit: {
      async list() {
        const rows = await client.get<{ data: ApiAuditEntry[] }>('/audit', { limit: 100 })
        return rows.data.map(auditFromApi).sort((a, b) => b.seq - a.seq)
      },
    },
  }
}
