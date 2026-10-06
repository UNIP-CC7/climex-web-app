# Mapa do código: onde conferir cada afirmação sobre o painel web

Para quem escreve o TCC: cada linha liga um assunto ao arquivo onde ele está e ao jeito de conferir. Os arquivos são citados pelo nome e pelo trecho, sem número de linha, porque as linhas mudam a cada formatação.

Todos os caminhos são relativos à raiz do repositório. Para rodar o painel: `npm ci`, `cp .env.example .env`, `npm run dev` (veja o [`README.md`](../../README.md)).

## Perfis, acesso e sessão

| Assunto | Onde está | Como conferir |
|---|---|---|
| Perfis do painel (`AGENTE`, `GESTOR`, `ADMIN`) | `src/domain/types.ts` (`Role`, `ROLE_LABEL`) | Tela de entrada, três botões |
| Quem acessa cada tela | `src/features/auth/store.ts` (`ROUTE_ROLES`) | Entrar como agente e tentar abrir `/abrigos`: volta ao Painel |
| Bloqueio de rotas | `src/routes/index.tsx` (`Protected` e `Guard`) | `src/routes/routes.test.tsx` |
| Sessão simulada (sem token) | `src/features/auth/store.ts`, grava `{ id, nome, perfil }` no `localStorage`, chave `climex.session` | Ferramentas do navegador, aba Armazenamento |
| Tela de entrada | `src/screens/Login` | `npm run dev` |

O controle por perfil só esconde telas no navegador. A decisão de verdade será da API.

## Telas e o que cada uma mostra

| Tela | Rota | Arquivo | Observação |
|---|---|---|---|
| Painel | `/` | `src/screens/Dashboard` | Contadores, mapa resumo, alertas, ocupação e próximas solicitações |
| Mapa | `/mapa` | `src/screens/MapScreen` | Camadas ligáveis e legenda de severidade |
| Socorro | `/socorro` | `src/screens/Rescue` | Fila ordenada por risco (decrescente) e distância (crescente) |
| Abrigos | `/abrigos` | `src/screens/Shelters` | Ativos e candidatos, busca, edição, entrada e saída |
| Alertas | `/alertas` | `src/screens/Alerts` | Emissão manual com a área escolhida no mapa, e encerramento |
| Relatórios | `/relatorios` | `src/screens/Reports` | Indicadores, CSV e impressão |
| Usuários | `/usuarios` | `src/screens/Users` | Troca de perfil e ativação |
| Auditoria | `/auditoria` | `src/screens/Audit` | Registros com hash encadeado |

Total: oito telas autenticadas mais a tela de entrada (nove).

## Comportamentos citados no TCC

| Assunto no TCC | Onde está no código | Como conferir |
|---|---|---|
| RF-DASH: quatro contadores (alertas ativos, solicitações por NR, abrigos com vagas, agentes em campo) | `src/screens/Dashboard/index.tsx`; os valores vêm de `dashboard.summary` em `src/services/mock/index.ts` | Painel, faixa de cima |
| RF-DASH: atualização a cada 30 s | `REFRESH_MS = 30_000` em `src/lib/queries.ts`, usado em resumo, alertas, abrigos e solicitações | O indicador "atualizado há N s" no topo (`src/components/AppShell`) |
| RF-DASH: mapa de calor | `HeatLayer` em `src/components/map/index.tsx`: círculos translúcidos por solicitação, **sem** agrupar por bairro | Mapa, camada "Concentração de ocorrências" |
| RF-DASH: ranking de bairros | `src/screens/Reports/index.tsx` (`byNb`), em tabela | Relatórios, "Bairros com mais ocorrências" |
| RF-DASH: tempo médio | Mesmo arquivo: `minutesAgo(r.openedAt)`, ou seja, **desde a abertura** | Relatórios, "Tempo médio desde a abertura" |
| RF-DASH: exportação | CSV gerado no navegador (`toCsv` em `src/lib/format.ts`); PDF por `window.print()` | Relatórios, dois botões |
| RF-SOC: nível de risco | `src/lib/risk.ts` (`riskLevel`), **regra de exemplo**. SOS sempre vale 5 | `src/lib/lib.test.ts` |
| RF-ALT: quatro níveis de severidade | `Severity` e `SEVERITY_LABEL` em `src/domain/types.ts`; cores em `src/components/map/index.tsx` (`SEVERITY_COLOR`) | Mapa, legenda |
| Alerta emitido pelo gestor | `alerts.create` em `src/services/mock/index.ts` (`source: 'MANUAL'`) | Alertas, formulário "Novo alerta" |
| UC-06: gestor acompanha alertas, solicitações por nível e vagas | Tela Painel (linha de contadores e listas) | Entrar como gestor |
| UC-04: triagem de solicitações | `src/screens/Rescue`: aceitar e concluir. **Agente, gestor e administrador** acessam | Entrar como agente |
| Trilha de auditoria com hash encadeado | `log()` em `src/services/mock/index.ts` e `fakeHash` em `src/mocks/seed.ts`: **hash ilustrativo, não criptográfico** | Auditoria, coluna Hash (o título mostra o hash anterior) |

## Dados: o que é real e o que é simulado

| Dado | Real ou simulado | Onde |
|---|---|---|
| Abrigos candidatos (≈ 10 mil locais do estado de SP) | **Real** (OpenStreetMap, licença ODbL) | `public/data/osm-sp-estado.json`; como foi gerado em [`fontes/`](fontes) |
| Capacidade e ocupação dos abrigos | Simulado (calculado a partir do identificador do local) | `loadShelters` em `src/services/mock/index.ts` |
| Quais são os 7 abrigos "ativos" | Simulado (os 7 locais públicos mais próximos de Santana de Parnaíba, excluindo clubes e academias) | Mesmo arquivo |
| Alertas, solicitações, usuários e auditoria | Simulado | `src/mocks/seed.ts` |
| Reinício | Tudo volta ao estado inicial ao recarregar a página | Estado em memória |

## Arquitetura do painel

| Assunto | Onde está |
|---|---|
| React 19, Vite, TypeScript, SPA | `package.json`, `vite.config.ts`, `src/main.tsx` |
| Roteamento | `src/routes/index.tsx` (React Router, telas carregadas sob demanda) |
| Estado do servidor, cache e atualização | `src/lib/queries.ts` (TanStack Query), `QueryClient` em `src/main.tsx` |
| Estado do cliente (só a sessão) | `src/features/auth/store.ts` (Zustand) |
| Estilos e tema | `src/theme/index.ts` e `styled-components`. As cores vêm do app mobile: compare com `src/theme/index.ts` do repositório `climex-mobile-app` |
| Mapa | `src/components/map/index.tsx`: Leaflet, tiles do OpenStreetMap, marcadores agrupados (`MarkerClusterGroup`) |
| Camada de serviços (ponto de troca para a API) | Contratos em `src/services/types.ts`; implementação simulada em `src/services/mock/`; escolha em `src/services/index.ts` (`VITE_USE_MOCKS`) |
| Tipos do domínio, escritos à mão | `src/domain/types.ts` (não são gerados a partir de OpenAPI) |
| Diferenças para a API real | [`../contrato-api.md`](../contrato-api.md) |
| Responsividade | Quebras em 900 px (menu vai para a base) e 1180 px (grades em colunas): `src/components/AppShell/styles.ts` e `src/screens/Dashboard/styles.ts` |
| Acessibilidade básica | Rótulos e `aria-label` nos controles, foco visível e `prefers-reduced-motion` em `src/components/GlobalStyle.ts`. **Não houve auditoria formal** de contraste nem de leitor de tela |

## Qualidade, CI e publicação

| Assunto | Onde está | Como conferir |
|---|---|---|
| CI (GitHub Actions) | `.github/workflows/ci.yml`: instala, tipos, lint, formatação, testes com cobertura, build, artefatos | Aba Actions do repositório |
| Hooks de commit | `.husky/pre-commit` (lint-staged) e `.husky/commit-msg` (commitlint); regras em `commitlint.config.js`; formatação em `.prettierrc.json`; configuração do lint-staged em `package.json` | Tentar um commit com mensagem fora do padrão |
| Testes | 42 testes em 6 arquivos `*.test.ts(x)` | `npm run test` |
| Cobertura mínima de 80% | `vite.config.ts` (`thresholds` e exclusões) | `npm run test:coverage`. Em 05/10/2026: 97,5% das linhas, 95,7% das instruções, 94,2% das funções, 88% dos ramos |
| O que fica fora da cobertura | `main.tsx`, `styles.ts`, tema, `mocks/seed.ts` e `components/map` (Leaflet precisa de navegador de verdade, conferido com Playwright) | `vite.config.ts`, lista `exclude` |
| Publicação | `vercel.json` (rewrite das rotas para `index.html` e cache de 1 dia em `/data`); Vercel ligada ao repositório | <https://climex-web-app.vercel.app/socorro> abre direto |
| Tiles do mapa | `tile.openstreetmap.org`: serve para protótipo, não para carga alta | Texto da seção "Mapa em produção" do README |

## Mobile e API: onde olhar (fora do escopo deste registro)

- Mobile: <https://github.com/UNIP-CC7/climex-mobile-app> (privado). Em 05/10/2026 tem 4 abas e uma tela de login, e as telas de mapa e alertas ainda são espaços reservados.
- API: <https://github.com/UNIP-CC7/climex-api> (privado). Módulos: `auth`, `alerts`, `shelters`, `map` e `rescue`. Veja as diferenças em [`../contrato-api.md`](../contrato-api.md).
