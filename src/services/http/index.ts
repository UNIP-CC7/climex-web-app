import type { Alert, AppUser } from '@/domain/types'
import type { Services } from '../types'
import { toBboxParam } from '@/lib/bbox'
import { createHttpClient, type HttpClient } from './client'
import type {
  ApiAlert,
  ApiAuditEntry,
  ApiAdminUser,
  ApiChangeRoleResult,
  ApiCheckInRecord,
  ApiCheckInResult,
  ApiCheckOutResult,
  ApiCreateAlert,
  ApiDashboardSummary,
  ApiHeatmap,
  ApiPage,
  ApiReport,
  ApiRiskConfigVersion,
  ApiRescue,
  ApiShelter,
  ApiReviewList,
  ApiReviewShelter,
  ApiSyncInmet,
  ApiSyncShelters,
  ApiTokenPair,
  ApiUserStatusResult,
} from './dto'
import {
  alertDescription,
  alertFromApi,
  appUserFromApi,
  occupantFromApi,
  candidateFromApi,
  confirmToApiPatch,
  heatFromApi,
  reportFromApi,
  summaryFromApi,
  auditFromApi,
  rescueFromApi,
  rescueStatusToApi,
  riskVersionFromApi,
  roleToApi,
  SEV_ORDER,
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
const MAX_USER_PAGES = 20

export function createHttpServices(client: HttpClient = createHttpClient(), tokens: TokenStore = browserTokens): Services {
  // a API não ordena por severidade; o painel mostra a mais grave primeiro, como no modo simulado
  const listAlerts = async (): Promise<Alert[]> =>
    (await client.all<ApiAlert>('/alerts')).map(alertFromApi).sort((a, b) => SEV_ORDER[b.severity] - SEV_ORDER[a.severity])
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
      async checkIn(id, people) {
        if (people < 1) throw new Error('Informe quantas pessoas entraram.')
        const r = await client.post<ApiCheckInResult>(`/shelters/${seg(id)}/check-in`, {
          guestCount: people,
          guestName: 'Entrada pelo painel',
        })
        return shelterFromApi(r.shelter)
      },
      async occupants(id) {
        const r = await client.get<{ data: ApiCheckInRecord[] }>(`/shelters/${seg(id)}/check-ins`)
        return r.data.map(occupantFromApi)
      },
      async checkOut(id, occupantId) {
        const r = await client.post<ApiCheckOutResult>(`/shelters/${seg(id)}/check-out`, { checkInId: occupantId })
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
        return summaryFromApi(await client.get<ApiDashboardSummary>('/dashboard/summary'))
      },
      async heatmap(hours) {
        return heatFromApi(await client.get<ApiHeatmap>('/dashboard/heatmap', { hours }))
      },
      async report(hours) {
        return reportFromApi(await client.get<ApiReport>('/dashboard/report', { hours }))
      },
      reportCsv: (hours) => client.text('/dashboard/report/csv', { hours }),
    },
    users: {
      async list(): Promise<AppUser[]> {
        const all: AppUser[] = []
        for (let page = 1; page <= MAX_USER_PAGES; page++) {
          const r = await client.get<ApiPage<ApiAdminUser>>('/admin/users', { page, limit: 100 })
          all.push(...r.data.map(appUserFromApi))
          if (!r.pagination.hasNext) break
        }
        return all
      },
      async setRole(id, role) {
        const r = await client.patch<ApiChangeRoleResult>(`/admin/users/${seg(id)}/role`, {
          role: roleToApi(role),
          reason: 'Perfil alterado pelo painel Climex',
        })
        return appUserFromApi(r.user)
      },
      async setActive(id, active) {
        const r = await client.patch<ApiUserStatusResult>(`/admin/users/${seg(id)}/status`, {
          isActive: active,
          reason: active ? 'Conta reativada pelo painel Climex' : 'Conta desativada pelo painel Climex',
        })
        return appUserFromApi(r.user)
      },
    },
    riskConfig: {
      active: async () => riskVersionFromApi(await client.get<ApiRiskConfigVersion>('/admin/risk-config')),
      async history() {
        const r = await client.get<{ data: ApiRiskConfigVersion[] }>('/admin/risk-config/history', { limit: 50 })
        return r.data.map(riskVersionFromApi)
      },
      async publish(config, reason) {
        return riskVersionFromApi(await client.put<ApiRiskConfigVersion>('/admin/risk-config', { config, reason }))
      },
    },
    audit: {
      async list() {
        const rows = await client.get<{ data: ApiAuditEntry[] }>('/audit', { limit: 100 })
        return rows.data.map(auditFromApi).sort((a, b) => b.seq - a.seq)
      },
    },
    shelterReview: {
      async list({ status, search, limit, offset, bbox }) {
        const q = search?.trim()
        const r = await client.get<ApiReviewList>('/shelters', {
          status,
          limit,
          offset,
          ...(q ? { search: q } : {}),
          ...(bbox ? { bbox: toBboxParam(bbox) } : {}),
        })
        return { items: r.data.map(candidateFromApi), total: r.total }
      },
      // a API confirma em dois passos: os dados (capacidade e recursos) em PATCH /shelters/:id e a decisão em /status.
      // Se o segundo falhar, o primeiro já valeu, o que é inofensivo para um candidato.
      async confirm(id, input) {
        await client.patch<ApiShelter>(`/shelters/${seg(id)}`, confirmToApiPatch(input))
        const note = input.note?.trim()
        return candidateFromApi(
          await client.patch<ApiReviewShelter>(`/shelters/${seg(id)}/status`, { status: 'CONFIRMED', ...(note ? { note } : {}) }),
        )
      },
      async reject(id, note) {
        return candidateFromApi(await client.patch<ApiReviewShelter>(`/shelters/${seg(id)}/status`, { status: 'REJECTED', note: note.trim() }))
      },
      async reopen(id, note) {
        const text = note?.trim()
        return candidateFromApi(
          await client.patch<ApiReviewShelter>(`/shelters/${seg(id)}/status`, { status: 'CANDIDATE', ...(text ? { note: text } : {}) }),
        )
      },
    },
    imports: {
      syncAlerts: () => client.post<ApiSyncInmet>('/admin/alerts/sync-inmet'),
      async syncShelters() {
        const r = await client.post<ApiSyncShelters>('/admin/shelters/sync/OSM')
        return {
          source: r.source,
          fetched: r.fetched,
          skipped: r.skipped,
          created: r.created,
          updated: r.updated,
          unchanged: r.unchanged,
          removedFromSource: r.removedFromSource,
        }
      },
    },
  }
}
