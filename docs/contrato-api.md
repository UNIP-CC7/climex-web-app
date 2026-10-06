# Painel web e climex-api: o que falta para ligar

Comparação entre o que o painel espera (`src/services/types.ts` e `src/domain/types.ts`) e o que a [`climex-api`](https://github.com/UNIP-CC7/climex-api) expõe hoje (branch `main`, último commit de 18/05/2026, lida em 05/10/2026). Serve de guia para escrever `src/services/http/` quando a API for publicada.

Enquanto isso, o painel usa os serviços simulados (`VITE_USE_MOCKS=true`).

## 1. Rotas

A API registra os módulos sem o prefixo `/v1` que o TCC descreve (§3.4.1).

| Módulo | Rotas na API hoje | Quem pode | Serviço do painel | Situação |
|---|---|---|---|---|
| Autenticação | `POST /auth/register`, `/otp/send`, `/otp/verify`, `/login`, `/guest`, `/refresh`, `/logout`; `GET /auth/me` | público e autenticado | `auth.login` | Existe. O painel hoje escolhe um perfil, sem credenciais. |
| Alertas | `GET /alerts`, `GET /alerts/:id`, `POST /alerts`, `PATCH /alerts/:id/status` | leitura opcional; escrita gestor e administrador | `alerts.list/create/close` | Existe. Encerrar vira `PATCH` de status. |
| Abrigos | `GET /shelters`, `GET /shelters/:id` | leitura opcional | `shelters.list` | **Só leitura.** |
| Mapa | `GET /map/overview`, `/map/route`, `/map/pois` | leitura opcional | (camadas do mapa) | Existe. O painel ainda não usa. |
| Socorro | `POST /rescue`, `POST /rescue/sos`, `GET /rescue`, `GET /rescue/:id`, `PATCH /rescue/:id/status` | listar e mudar status: agente, gestor, administrador | `rescue.list/setStatus` | Existe. |
| Painel (contadores) | não existe | | `dashboard.summary` | **Falta.** Dá para montar no cliente somando alertas, socorro e abrigos. |
| Relatórios | não existe | | indicadores e CSV | **Falta.** Hoje calculado no navegador. |
| Usuários | não existe | | `users.list/setRole/setActive` | **Falta** (inclui a promoção de perfil auditada do TCC, §3.4.3). |
| Auditoria | não existe | | `audit.list` | **Falta** (trilha com hash encadeado, §3.4.7). |
| Notificações | não existe | | (não usado pelo painel) | Falta na API (o TCC §3.4.3 prevê `/v1/devices`). É necessário para o app mobile, não para o painel. |

Abrigos: criar, editar capacidade, situação, recursos e registrar entrada e saída (telas Abrigos e Painel) **não têm rota**. A tela de abrigos precisa de `POST /shelters`, `PATCH /shelters/:id` e check-in e check-out.

## 2. Nomes e valores (enums)

| Conceito | Painel | API |
|---|---|---|
| Perfil | `AGENTE`, `GESTOR`, `ADMIN` | `CIDADAO`, `AGENTE`, `GESTOR`, `ADMINISTRADOR` |
| Severidade do alerta | `OBSERVACAO`, `ATENCAO`, `ALERTA`, `ALERTA_MAXIMO` | igual |
| Situação do alerta | `active` (booleano) | `ACTIVE`, `MONITORING`, `RESOLVED`, `EXPIRED` |
| Tipo de socorro | `ILHADO`, `FERIDO`, `EVACUACAO`, `DESABAMENTO` | os mesmos, mais `OUTROS` |
| Risco do socorro | número de 1 a 5 (NR) | `BAIXO`, `MEDIO`, `ALTO`, `CRITICO` (campo `nivelRisco`) e a pontuação inteira que originou a faixa (campo `nrScore`) |
| Situação do socorro | `ABERTA`, `EM_ATENDIMENTO`, `CONCLUIDA` | `PENDING`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CANCELLED` |

Decisões a tomar na hora de ligar:

- **Risco:** a API devolve a faixa (`nivelRisco`, 4 valores) **e** a pontuação (`nrScore`), e ordena a fila de socorro por `nrScore` decrescente. O painel mostra NR de 1 a 5 e o selo SOS, com uma regra de exemplo própria (`src/lib/risk.ts`) que **deve ser descartada** ao ligar a API: o cálculo real está em `calculateNivelRisco`, no módulo `rescue` da API (soma de pesos por tipo, alerta ativo, grupos vulneráveis, número de vítimas, nível da água e risco estrutural; faixas em 30, 55 e 80 pontos). O SOS entra direto como `CRITICO`. Para o painel, basta decidir se exibe as 4 faixas ou converte para 1 a 5. Atenção: o campo `nrScore` está descrito no schema da API como "0-100", mas a soma máxima possível dos pesos é 165.
- **Situação do socorro:** mapear `PENDING` para aberta, `ASSIGNED` e `IN_PROGRESS` para em atendimento, `RESOLVED` para concluída. `CANCELLED` não existe no painel.
- **Perfil:** criar um mapeamento `ADMINISTRADOR` para `ADMIN` na borda do serviço, para não espalhar a diferença pelas telas.

## 3. Outras diferenças que afetam o painel

- **CORS:** a API usa `origin: false` quando `NODE_ENV=production`. Com isso o navegador bloqueia o painel hospedado na Vercel. A API precisa liberar a origem do painel (por exemplo `https://climex-web-app.vercel.app`).
- **Cabeçalhos:** o TCC (§3.4.10) lista `X-Request-Id`, `X-Client-Version`, `X-Device-Id` e `Idempotency-Key`. Não conferi se a API exige ou lê esses cabeçalhos.
- **Sessão:** o TCC descreve token de acesso de 15 minutos mais refresh opaco. A API configura `JWT_ACCESS_EXPIRES=8h` e `JWT_REFRESH_EXPIRES=7d` no `.env.example`. O painel terá de tratar `401` e renovar pelo `POST /auth/refresh`.
- **Tempo real:** o painel atualiza a cada 30 segundos (`REFRESH_MS` em `src/lib/queries.ts`). A API não tem WebSocket, o que o TCC cita em §3.3.2.
- **Região:** os abrigos reais do painel vêm de um arquivo estático (`public/data/osm-sp-estado.json`). Na API, `GET /shelters` deve devolver o cadastro oficial da Defesa Civil.

## 4. Como ligar, quando a API estiver publicada

1. Criar `src/services/http/` com uma implementação de cada interface de `src/services/types.ts` (cliente `fetch` com `VITE_API_URL`, renovação de token em `401`, erros no formato da API).
2. Escolher a implementação em `src/services/index.ts` por `VITE_USE_MOCKS`, trocando o erro atual por esse caminho.
3. Manter os mocks para as rotas que a API ainda não tiver (usuários, auditoria, relatórios) até elas existirem.
4. Liberar o CORS da API para o endereço do painel.
