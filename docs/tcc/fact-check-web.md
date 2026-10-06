# Fact-check do Cap. 3 contra o painel web (cards C-01 e C-02)

Escopo: só o que o texto do **Rev 7** do TCC diz sobre o painel web (`UNIP-CC7/climex-web-app`, branch `develop`) ou que deveria dizer. Itens de API e de mobile estão no fim, como "fora do escopo", cada um com o dono.

Este documento registra **o que foi conferido e o que o código faz**. Ele não traz texto para o TCC: quem for escrever usa esta tabela como fonte e o [`mapa-do-codigo.md`](mapa-do-codigo.md) para achar cada ponto no código.

Como ler a coluna **Situação**:
- **Confere**: o código faz o que o texto diz.
- **Diverge**: o código faz outra coisa. A coluna "Correção" diz se muda o texto ou o código.
- **Falta**: o texto cita algo que não existe no web.
- **Omitido**: o web faz algo que o texto não menciona.

A coluna **Comentário para o Word** é uma sugestão curta de comentário de margem, como o card C-01 pede. O bloco "Decisão do C-02" marca cada divergência como **texto ajustado** (o código fica como está) ou **código passa a atender**.

## 1. Introdução e objetivos

| # | Trecho do Rev 7 | O que o código faz (onde) | Situação | Correção | Comentário para o Word |
|---|---|---|---|---|---|
| 1 | §1.3 obj. 5: dashboard com "distribuição espacial dos abrigos e a densidade dos alertas emitidos" | Painel mostra abrigos e polígonos de alerta no mapa, mais um contador de alertas ativos (`src/screens/Dashboard`). Não existe densidade de alertas. A camada "Concentração de ocorrências" mede **solicitações de socorro**, não alertas (`HeatLayer` em `src/components/map`). | Diverge | Texto ajustado: "distribuição espacial dos abrigos, dos alertas ativos e da concentração de solicitações de socorro". | Painel não mede densidade de alertas. A concentração exibida é de solicitações. Ajustado o objetivo 5. |
| 2 | §1.1: interface com "gráficos climáticos e mapas de calor" | Não há gráficos climáticos. A "concentração de ocorrências" é um conjunto de círculos translúcidos por solicitação, não um mapa de calor interpolado. | Diverge | Texto ajustado (gráficos climáticos viram trabalho futuro, junto da integração com o INMET). | Gráficos climáticos não foram implementados no painel. Registrado como trabalho futuro. |

## 2. Tecnologias e ferramentas (§3.1 e §3.2)

| # | Trecho do Rev 7 | O que o código faz (onde) | Situação | Correção | Comentário para o Word |
|---|---|---|---|---|---|
| 3 | §3.1.3: React para a "interface web", com Virtual DOM | React 19 com Vite 8 e TypeScript, SPA (`package.json`). | Confere | Acrescentar Vite e o roteamento (React Router). | Web usa React 19 + Vite + React Router. Complementado. |
| 4 | §3.1.2: no mobile, estilos por "objetos JavaScript (StyleSheet)"; no web, CSS | O web usa **styled-components** (CSS-in-JS) com tema tipado (`src/theme`, `src/@types/styled.d.ts`), o mesmo do app (o `package.json` do mobile também depende de `styled-components`). | Diverge | Texto ajustado: citar styled-components como solução de estilo comum aos dois clientes. (Confirmar no mobile, que é fora do escopo deste card.) | Estilização do web é styled-components, não CSS puro. Texto atualizado. |
| 5 | §3.1.1: HTML semântico e SEO como justificativa | O painel é uma SPA atrás de login simulado. HTML semântico existe (`nav`, `main`, `header`, `table`, rótulos), mas SEO não se aplica a um painel interno. Só o site público do Vercel é indexável, e tem uma página (a de entrada). | Confere (com ressalva) | Texto ajustado: trocar a justificativa de SEO por acessibilidade no painel. | SEO não é objetivo do painel (área autenticada). Justificativa trocada por acessibilidade. |
| 6 | §3.1.8: TypeScript com contratos claros | `strict` ligado, sem `any` explícito, contratos de serviço em `src/services/types.ts`. | Confere | Nenhuma. | (sem comentário) |
| 7 | §3.1.9: Git Flow, PR com "revisão obrigatória de pelo menos um membro" | Fluxo existe (`main`, `develop`, `feature/*`, PRs #1 a #4). A revisão **não é imposta**: não há proteção de branch configurada e os PRs #1, #2 e #4 foram mergeados no mesmo dia. | Diverge | Código passa a atender: ativar proteção de branch em `main` e `develop` exigindo 1 aprovação. Se o grupo não quiser, ajustar o texto para "recomendada". | Revisão obrigatória não está configurada no GitHub. Ou ativa a proteção ou o texto vira "recomendada". |
| 8 | §3.2.1: VS Code com ESLint, Prettier, Docker, REST Client, GitLens e `.vscode/settings.json` compartilhado | O web tem ESLint (`eslint.config.js`) e, a partir do PR 8, **Prettier** (`.prettierrc.json`, aplicado nos commits pelo lint-staged e conferido no CI). Continua **sem `.vscode/`**. | Parcial (Prettier resolvido no PR 8) | Texto ajustado só no que sobra: o `.vscode/settings.json` compartilhado e as extensões de Docker e REST Client valem para o mobile e a API. | O web agora tem Prettier. Não tem .vscode compartilhado, texto restringido. |
| 9 | §3.2.3 e §3.4.11: Docker e `docker compose up` sobem o ambiente | O web **não usa Docker**: roda com `npm ci` e `npm run dev` e é publicado como site estático na Vercel. | Omitido | Texto ajustado: dizer que a conteinerização é só do backend e que o painel é estático. | O painel não é conteinerizado (site estático na Vercel). Explicitado. |
| 10 | §3.2.5: GitHub hospeda "ambas as aplicações em repositórios separados" | Agora são **três** repositórios: `climex-api`, `climex-mobile-app` e `climex-web-app`. | Diverge | Texto ajustado: "três aplicações". | Há três repositórios. "Ambas" trocado por "as três". |

## 3. Requisitos (§3.3)

| # | Trecho do Rev 7 | O que o código faz (onde) | Situação | Correção | Comentário para o Word |
|---|---|---|---|---|---|
| 11 | §3.3.1 e §3.3.2: quatro perfis (cidadão, agente, gestor, administrador) | O painel tem três: `AGENTE`, `GESTOR`, `ADMIN` (`src/domain/types.ts`). Cidadão não acessa o painel, usa o app. | Confere (com ressalva) | Texto ajustado: "o painel atende agente, gestor e administrador". | O painel atende três perfis. O cidadão usa só o app. |
| 12 | Tabela 1: o "Gestor municipal" tem papel "Administrador" e a "Equipe de TI" é "Administrador técnico" | O código separa `GESTOR` e `ADMIN`. A tabela chama os dois de administrador. | Diverge | Texto ajustado na Tabela 1: papel do gestor = "Gestor"; da TI = "Administrador". | Tabela 1 confunde gestor com administrador. Alinhado aos perfis do sistema. |
| 13 | RF-DASH: contadores de alertas ativos, solicitações por NR, abrigos com vagas e agentes em campo | Os quatro contadores existem (`src/screens/Dashboard`). "Agentes em campo" hoje conta agentes ativos do mock, não presença real. | Confere (com ressalva) | Nota no texto: dado de agentes é simulado até existir o rastreio. | Contador de agentes é simulado. Registrado. |
| 14 | RF-DASH: atualização "a cada trinta segundos" | `REFRESH_MS = 30_000` em `src/lib/queries.ts` para resumo, alertas e solicitações. A **lista de abrigos não atualiza sozinha** (`staleTime: Infinity`). | Corrigido no código (PR 7) | A lista de abrigos passou a usar o mesmo `refetchInterval` de 30 s. Sem ajuste de texto, já mergeado na develop. | (sem comentário) |
| 15 | RF-DASH: "mapa de calor de ocorrências por bairro ou setor" | Camada de concentração por círculos translúcidos por solicitação, sem agregação por bairro. A agregação por bairro existe só como tabela em Relatórios (`src/screens/Reports`). | Diverge | Texto ajustado: "camada de concentração de ocorrências, mais ranking de bairros nos relatórios". | Não há mapa de calor por bairro. Descrito o que existe. |
| 16 | RF-DASH: relatório com total, "tempo médio de atendimento" e ocupação; exportação em PDF ou CSV | Total, concluídas e ocupação existem. O tempo mostrado é **desde a abertura**, não de atendimento. CSV é gerado no navegador. PDF é "Imprimir ou salvar em PDF" do navegador. | Diverge | Texto ajustado nos três pontos (ou código: calcular tempo de atendimento quando houver data de início). | Tempo médio é desde a abertura; PDF é pela impressão do navegador. Texto ajustado. |
| 17 | RF-ABR: "agentes de Defesa Civil podem modificar capacidade, status e recursos" | Só **gestor e administrador** acessam `/abrigos` (`ROUTE_ROLES`). O agente não edita. | Diverge | Decidir: ou o texto troca "agentes" por "gestores", ou liberar a rota para agente (código). Recomendo o texto, pela separação de papéis. | Quem edita abrigos no painel é gestor/admin, não agente. Decidir. |
| 18 | RF-ABR: ocupação "atualizada em tempo real via WebSocket" | Não há WebSocket. Atualização por consulta periódica (item 14). | Diverge | Texto ajustado: "consulta periódica, com WebSocket previsto". O próprio §3.4.2 já diz "polling". | Texto cita WebSocket e a implementação é polling. Alinhado ao §3.4.2. |
| 19 | RF-SOC: fila "ordenada pelo NR e pela distância ao agente" | `RescueScreen` ordena por risco decrescente e distância crescente. A distância é fixa no mock. | Confere (com ressalva) | Nota: distância simulada. | (sem comentário) |
| 20 | RF-ALT: alertas vêm da integração com S2iD e SMSAlerta | O painel também **emite alerta manual** (tela Alertas, fonte `MANUAL`). Isso não está descrito. | Omitido | Texto ajustado: acrescentar a emissão manual pelo gestor. | Emissão manual de alerta pelo painel não estava descrita. Incluída. |
| 21 | §3.3.3: cobertura mínima de 80% e 100% dos fluxos críticos em integração | O web tem 42 testes (serviços, sessão, rotas por perfil, componentes e as 8 telas) e cobertura medida: **97,5% das linhas, 95,5% das instruções, 88% dos ramos**. O limite de 80% é imposto pelo `vitest` e pelo CI (PR 8). Ficam de fora da medição o ponto de entrada, os estilos, o tema, a massa de dados e as camadas do mapa em Leaflet. | Corrigido no código (PR 8), com ressalva | Texto ajustado: o painel atende os 80% medidos sobre a aplicação, com as exclusões acima. Os "100% dos fluxos críticos em integração" continuam sem teste de ponta a ponta no navegador (a verificação foi manual, com Playwright). | Painel atinge 80% de cobertura medida (42 testes). Fluxos de ponta a ponta ainda são verificados manualmente. |
| 22 | §3.3.3: deploy em até 30 min após merge e rollback automático acima de 1% de erro | Deploy automático na Vercel leva cerca de 20 s depois do merge. **Rollback é manual** (promover deploy anterior). | Diverge (parcial) | Texto ajustado: rollback manual pela Vercel. | Deploy rápido confere, rollback automático não existe. |
| 23 | §3.3.3: funcionar offline por 72 h | O painel **não é PWA** e não funciona offline. O requisito vale para o app. | Diverge | Texto ajustado: restringir o requisito ao aplicativo móvel. | Requisito offline é do app, o painel exige conexão. |
| 24 | §3.3.3: acessibilidade (área de toque, fonte mínima) | Foco visível, `prefers-reduced-motion`, rótulos de campos e `aria-label` nos botões. Não houve auditoria formal de contraste nem de leitor de tela. | Confere (parcial) | Nota: sem auditoria formal. Se quiser comprovar, rodar o Lighthouse (skill de auditoria). | Acessibilidade verificada de forma básica. Auditoria formal pendente. |

## 4. Arquitetura (§3.4)

| # | Trecho do Rev 7 | O que o código faz (onde) | Situação | Correção | Comentário para o Word |
|---|---|---|---|---|---|
| 25 | §3.4 (abertura) e §3.4.1: "dois artefatos de software independentes" | São três: API, app e painel web. A Figura 4 (diagrama de contexto) também precisa do cliente web. | Diverge | Texto ajustado e figura refeita. Parágrafo em o rascunho de texto opcional. | Artefatos passam de dois para três. Figura 4 precisa incluir o painel web. |
| 26 | §3.4.1: camada de apresentação "composta pelo aplicativo móvel" | O painel web também é camada de apresentação. | Diverge | Texto ajustado. | Camada de apresentação tem dois clientes: app e painel web. |
| 27 | §3.4.2: só descreve o app (Expo Router, TanStack Query com 60 s e 24 h, Zustand, SQLite, SecureStore) | Web: React Router, TanStack Query com `staleTime` de 15 s e atualização a cada 30 s, Zustand só para a sessão, styled-components, Leaflet com agrupamento de marcadores (`src/main.tsx`, `src/routes`). Sem fila de saída, sem SQLite. | Omitido | Nova subseção do web. | Painel web não estava descrito no §3.4.2. Subseção nova incluída. |
| 28 | §3.4.3, Tabela 2: oito módulos da API, sem dashboard nem relatórios | O painel precisa de resumo, relatórios, usuários e auditoria. A API real só tem auth, alerts, shelters, map e rescue (ver `docs/contrato-api.md`). | Diverge | Texto ajustado: nota sob a Tabela 2 dizendo o que o painel consome hoje de forma simulada. | Tabela 2 não prevê módulo para dashboard e relatórios, que o painel usa. |
| 29 | §3.4.5: tipos do cliente "gerados automaticamente a partir do OpenAPI" | No painel os tipos são **escritos à mão** (`src/domain/types.ts`) e já diferem da API (enums, perfis). | Diverge | Texto ajustado: "no web, tipos manuais até a API publicar o OpenAPI". Código futuro: gerar tipos. | Tipos do painel são manuais e já divergem da API. |
| 30 | §3.4.7: token de acesso só em memória; refresh opaco | O painel não usa token. Guarda `{ id, nome, perfil }` no `localStorage` (`src/features/auth/store.ts`). Isso é login simulado. | Diverge | Texto ajustado: o painel simula a sessão. A regra de token vale quando houver cliente HTTP. | Painel ainda não implementa token. Sessão é simulada. |
| 31 | §3.4.10: cabeçalhos `X-Request-Id`, `X-Client-Version`, `X-Device-Id`, `Idempotency-Key`; timeouts; tratamento por status | O painel não faz chamadas HTTP, então nenhum desses itens existe. | Falta | Texto ajustado: restringir ao app e indicar o web como futuro. | Cabeçalhos e timeouts são do app. O painel ainda não chama a API. |
| 32 | §3.4.11: "Todos os componentes do backend são conteinerizados" | Correto para o backend. O painel é estático (item 9). | Confere | Acrescentar uma frase sobre o painel. | (ver item 9) |
| 33 | §3.4.12: CI com GitHub Actions; no app, verificação de tipos e lint | O web roda `npm ci`, tipos, lint, **testes** e build, e guarda o `dist` por 7 dias (`.github/workflows/ci.yml`). Deploy contínuo pela Vercel, ligada ao repositório. | Omitido | Texto ajustado. | CI e deploy do painel não estavam descritos. |
| 34 | §3.4.12: ganchos Husky, lint-staged e commitlint, Conventional Commits | O web passou a ter **Husky, lint-staged (Prettier e ESLint nos arquivos alterados) e commitlint** (PR 8), além do `commitizen`. Mensagem fora do padrão é recusada pelo `git commit`. | Corrigido no código (PR 8) | Sem ajuste de texto, já mergeado na develop. | (sem comentário) |
| 35 | §3.4.13, UC-06: gestor acompanha alertas ativos, solicitações por nível e vagas | Tela Painel mostra os três e o mapa. | Confere | Acrescentar o que existe além: relatórios e exportação. | UC-06 atendido pelo Painel. |
| 36 | §3.4.13, UC-04: triagem "exclusivo a agentes" | `/socorro` aceita agente, gestor e administrador. | Diverge | Texto ajustado: "agente, com acompanhamento por gestor e administrador". | Triagem não é exclusiva de agentes no painel. |
| 37 | §3.5: "cinco etapas", mas só três são descritas | Fora do escopo do web, mas a etapa de implementação deve citar o painel. | Falta | Texto ajustado. | O painel entrou na etapa de implementação. Etapas 4 e 5 seguem sem texto. |

## 5. Decisão do C-02 (resumo)

| Item | Decisão | Quem faz |
|---|---|---|
| 1, 2, 4, 5, 8 a 13, 15, 16, 18, 20, 22 a 31, 33, 35 a 37 | **Texto ajustado** (parágrafos prontos em o rascunho de texto opcional) | Você, ao colar no Word |
| 7 | **Código passa a atender** (proteção de branch) | Dono do repositório (admin da org) |
| 14 | **Código passa a atender**: feito no PR 7 (abrigos a cada 30 s) | Já feito e mergeado na develop |
| 17 | **Decidir** (texto recomendado) | Grupo |
| 21, 34, 8 (Prettier) | **Código passa a atender**: feito no PR 8 (Husky, commitlint, Prettier e cobertura de 80%) | Já feito e mergeado na develop |

Depois de aplicar, reler §3.4.1 e §3.4.12, como o C-02 pede.

## 6. Fora do escopo deste card (dono indicado)

| Onde | Divergência vista | Dono |
|---|---|---|
| API | Rotas sem `/v1`; sem módulos de usuários, auditoria, dashboard e dispositivos; sem event bus; sem CI no repositório; `.env.example` com `JWT_SECRET` e `JWT_REFRESH_SECRET` reais; CORS fechado em produção | Card de API |
| Mobile | Apenas 4 abas e uma tela de login, telas ainda como placeholder. O texto descreve a aba Fila, fila de saída (outbox), SQLite, notificações, cabeçalhos e timeouts. Estilo por `styled-components` e não `StyleSheet` | Card de mobile |
