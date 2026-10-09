# Painel web e climex-api: o que falta para ligar

Comparação entre o que o painel espera (`src/services/types.ts` e `src/domain/types.ts`) e o que a [`climex-api`](https://github.com/UNIP-CC7/climex-api) expõe. A base é a branch **`develop`** da API (último commit de 04/10/2026), lida em 07/10/2026. A `main` da API está desatualizada (parou em 18/05/2026) e **não** deve ser usada como referência. Serve de guia para escrever `src/services/http/`.

Enquanto isso, o painel usa os serviços simulados (`VITE_USE_MOCKS=true`).

> Correção: a primeira versão deste documento foi escrita lendo a `main` da API e dizia, por engano, que faltavam o prefixo `/v1`, a auditoria, o módulo de administração e as notificações. Todos existem na `develop`.

A fonte de verdade do contrato é o `openapi.json` da própria API (`npm run openapi:export`). O app mobile já gera os tipos a partir dele (`npm run gen:api`, com `openapi-typescript`), e o painel pode fazer o mesmo no lugar dos tipos escritos à mão em `src/domain/types.ts`.

## 1. Rotas

Todas sob o prefixo `/v1`. Papéis: `CIDADAO`, `AGENTE`, `GESTOR`, `ADMINISTRADOR`.

| Serviço do painel | Rota da API | Quem pode | Situação |
|---|---|---|---|
| `auth.login` | `POST /v1/auth/login` (telefone e senha), `POST /v1/auth/refresh`, `POST /v1/auth/logout`, `GET /v1/auth/me` | público e autenticado | Existe. O painel hoje só escolhe um perfil. O app usa cadastro e OTP por celular, e o painel pode usar a senha. |
| `alerts.list` | `GET /v1/alerts` e `GET /v1/alerts/:id` (polígono em GeoJSON) | leitura opcional | Existe. |
| `alerts.create` | `POST /v1/alerts` (título, descrição, `level`, latitude, longitude, `radiusMeters`, cidade, UF, `polygon` opcional, `expiresAt`) | gestor, administrador | Existe. O painel já trabalha com centro e raio. |
| `alerts.close` | `PATCH /v1/alerts/:id/status` (`status` e `reason`) | gestor, administrador | Existe. |
| `shelters.list` | `GET /v1/shelters` e `GET /v1/shelters/:id` | leitura opcional | Existe. |
| `shelters.update` | `PATCH /v1/shelters/:id` (capacidade, `isActive`, recursos) | **agente**, gestor, administrador | Existe. |
| `shelters.checkIn` | `POST /v1/shelters/:id/check-in` (`guestCount`, `guestName`) | autenticação opcional (visitante pode) | Existe, mas só registra **entrada**. O painel tem o botão de saída (`-1`), que não tem rota. |
| (cadastro de abrigo) | não existe | | **Falta** `POST /v1/shelters`. Hoje abrigos entram por seed ou banco. |
| `rescue.list` | `GET /v1/rescue` (fila ordenada por `nrScore`) | agente, gestor, administrador | Existe. |
| `rescue.setStatus` | `PATCH /v1/rescue/:id/status` | agente, gestor, administrador | Existe. Concluir (`RESOLVED`) exige `outcomeNote`. |
| `users.setRole` | `PATCH /v1/admin/users/:id/role` (`role` e `reason` com 5 a 500 caracteres) | administrador | Existe. |
| `users.list`, `users.setActive` | não existe | | **Falta** listar usuários e ativar ou desativar. |
| `audit.list` | `GET /v1/audit` e `GET /v1/audit/verify` (integridade da cadeia) | gestor e administrador (a verificação só administrador) | Existe, com hash encadeado de verdade. O painel hoje mostra um hash ilustrativo. |
| `dashboard.summary` | `GET /v1/dashboard/summary` | autenticado | Existe. `agentsActive` conta agentes ativos (não é presença em campo) e `agentsAttending` os que têm um caso aceito. |
| `dashboard.heatmap` | `GET /v1/dashboard/heatmap?hours&cellDegrees` | autenticado | Existe. Células de grade com a contagem de solicitações; o painel calcula a intensidade pela maior contagem. |
| `dashboard.report` | `GET /v1/dashboard/report?hours` | gestor e administrador | Existe. O painel oferece 24 horas, 7 dias e 30 dias. |
| `dashboard.reportCsv` | `GET /v1/dashboard/report/csv?hours` | gestor e administrador | Existe. O painel baixa o texto com o token da sessão. |
| (dispositivos, só o app) | `PUT` e `DELETE /v1/devices` | autenticado | Existe. Registra o token de push do celular. |
| (rota de fuga, só o app) | `GET /v1/map/route`, `GET /v1/map/pois` | leitura opcional | Existe. O painel não usa. |

## 2. Nomes e valores

| Conceito | Painel | API |
|---|---|---|
| Perfil | `AGENTE`, `GESTOR`, `ADMIN` | `CIDADAO`, `AGENTE`, `GESTOR`, `ADMINISTRADOR` |
| Severidade do alerta | `OBSERVACAO`, `ATENCAO`, `ALERTA`, `ALERTA_MAXIMO` | igual |
| Situação do alerta | `active` (booleano) | `ACTIVE`, `MONITORING`, `RESOLVED`, `EXPIRED` |
| Tipo de socorro | `ILHADO`, `FERIDO`, `EVACUACAO`, `DESABAMENTO` | os mesmos, mais `OUTROS` |
| Risco do socorro | número de 1 a 5 (NR) | `nivelRisco`: `BAIXO`, `MEDIO`, `ALTO`, `CRITICO`, e `nrScore`, a pontuação inteira |
| Situação do socorro | `ABERTA`, `EM_ATENDIMENTO`, `CONCLUIDA` | `PENDING`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CANCELLED` |
| Abrigo | `ATIVO`, `CANDIDATO`, `INATIVO` e recursos em objeto | `isActive` (booleano) e `hasWater`, `hasFood`, `hasMedical`, `isPetFriendly`, `isAccessible` |

Decisões a tomar na hora de ligar:

- **Perfil:** mapear `ADMINISTRADOR` para `ADMIN` na borda do serviço, para não espalhar a diferença pelas telas.
- **Risco:** a API devolve a faixa e a pontuação, e ordena a fila por `nrScore`. O painel usa uma regra de exemplo própria (`src/lib/risk.ts`), que **deve ser descartada** ao ligar a API. O cálculo real é `calculateNivelRisco` (soma de pesos por tipo, alerta ativo, grupos vulneráveis, número de vítimas, nível da água e risco estrutural; faixas em 30, 55 e 80 pontos), e o SOS entra direto como `CRITICO`. O painel pode exibir as 4 faixas ou converter para 1 a 5. O `nrScore` é descrito no schema como "0-100", mas a soma máxima dos pesos é 165.
- **Situação do socorro:** `PENDING` vira aberta, `ASSIGNED` e `IN_PROGRESS` viram em atendimento, `RESOLVED` vira concluída. `CANCELLED` não existe no painel.
- **Alerta ativo:** `ACTIVE` e `MONITORING` contam como ativo, `RESOLVED` e `EXPIRED` não.
- **Abrigos candidatos:** a API só conhece abrigos do cadastro oficial (`isActive`). Os cerca de 10 mil candidatos do OpenStreetMap continuam como arquivo estático do painel, numa camada à parte, e não passam pela API.

## 3. Outras diferenças que afetam o painel

- **Quem edita abrigos:** a API libera `PATCH /v1/shelters/:id` para **agente**, gestor e administrador. O painel só deixa gestor e administrador (`ROUTE_ROLES`). Ao ligar, o painel deve liberar a tela de abrigos para o agente, o que também alinha o código ao texto do TCC (RF-ABR).
- **CORS:** a API libera as origens listadas na variável `CORS_ALLOWED_ORIGINS`. O `.env.example` dela já traz `http://localhost:5173`, a porta do painel. Em produção é preciso acrescentar `https://climex-web-app.vercel.app`.
- **Sessão:** o token de acesso dura 15 minutos e o de renovação é opaco e rotacionado a cada uso (`POST /v1/auth/refresh`). O painel precisa renovar ao receber `401`, com uma única renovação por vez, como faz o app (`src/services/api/client.ts` do mobile).
- **Cabeçalhos:** o app envia `X-Request-Id`, `X-Client-Version`, `X-Device-Id` e, nas mutações, `Idempotency-Key`. Nas rotas de socorro a API usa a chave de idempotência para descartar repetições. O painel deve enviá-la nas mutações de socorro.
- **Erros:** a API responde no formato Problem Details (`application/problem+json`, com `code` e `traceId`).
- **Tempo real:** a API não tem WebSocket. O painel continua com consulta periódica (`REFRESH_MS`).
- **Saída de abrigo:** não existe rota (só `check-in`). O botão de saída do painel fica sem integração.
- **Usuários de teste:** o `prisma/seed.ts` da API cria usuários de cada perfil. O painel pode usá-los no desenvolvimento.

## 4. Como ligar

1. Subir a API (`docker compose up --build`, na `climex-api`) e rodar `npm run db:seed`.
2. Gerar os tipos do painel a partir do `openapi.json` da API, no lugar dos tipos manuais.
3. Criar `src/services/http/` com uma implementação de cada interface de `src/services/types.ts` (cliente `fetch` com `VITE_API_URL`, renovação em `401`, cabeçalhos e erros no formato da API) e escolher a implementação em `src/services/index.ts` por `VITE_USE_MOCKS`.
4. Manter os mocks só para o que a API ainda não tem: listar e desativar usuários, cadastro de abrigo e saída de abrigo.
5. Liberar a origem do painel em `CORS_ALLOWED_ORIGINS` na API de produção.
