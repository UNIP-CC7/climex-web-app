# Registro do que foi feito no painel web, por card

Documento de passagem para quem vai escrever o texto do TCC. Aqui está o que foi feito em cada card do Trello que toca o painel web, onde está, como conferir e o que ficou de fora. O texto do TCC **não** está neste registro: ele fica com outra pessoa do grupo.

- Repositório: <https://github.com/UNIP-CC7/climex-web-app>
- Site publicado: <https://climex-web-app.vercel.app>
- Posição de referência: branch `develop`, em 05/10/2026 (PRs 1 a 8 mergeados). A `main` ainda não recebeu os PRs 7 e 8.
- Onde achar cada coisa no código: [`mapa-do-codigo.md`](mapa-do-codigo.md). Fontes externas e dados: [`fontes/README.md`](fontes/README.md).

## Resumo

| Card | Parte web | Situação | Onde está |
|---|---|---|---|
| P-16 README, .env.example e como rodar do zero | Feito | PR 6 mergeado | `README.md`, `.env.example`, `docs/contrato-api.md` |
| C-01 fact-check da §3.4 contra o código | Feito para o painel | Documento pronto | [`fact-check-web.md`](fact-check-web.md) |
| C-02 corrigir divergências | Código: feito. Texto: **não feito** (outra pessoa) | PRs 7 e 8 mergeados | [`fact-check-web.md`](fact-check-web.md), seção 5 |
| R-03 §4.2, UC-06, capturas do painel | Capturas: feitas. Texto: **não feito** (outra pessoa) | Imagens prontas | [`capturas/`](capturas) |

---

## P-16: README, .env.example e "como rodar do zero" (só o painel web)

**O que foi feito**
- `README.md` reescrito com: pré-requisitos, passo a passo do clone ao `npm run dev`, scripts de qualidade, hooks de commit, cobertura, variáveis de ambiente, ordem de subida API, mobile e web, tabela de telas por perfil, origem dos dados, estrutura de pastas, publicação e Git Flow.
- `.env.example` com `VITE_USE_MOCKS=true` e `VITE_API_URL` (reservada, ainda sem uso).
- `src/services/index.ts`: com `VITE_USE_MOCKS=false` o painel não carrega e o erro no console explica o motivo e aponta para o contrato.
- [`../contrato-api.md`](../contrato-api.md): diferenças entre o painel e a `climex-api` (rotas, enums, perfis, o que falta, CORS, sessão).

**Como conferir**
- Foi testado num clone limpo: `git clone`, `npm ci`, `cp .env.example .env`, e `typecheck`, `lint`, `test` e `build` passaram (código de saída 0).
- Com `VITE_USE_MOCKS=false`, a página fica em branco e o console mostra a mensagem. Foi verificado no navegador.

**Fora do escopo desta entrega**
- README raiz do monorepo, README e `.env.example` do mobile e da API: ficam com quem cuida de cada um. O README do painel já traz o trecho "Ordem de subida no monorepo" que pode ser reaproveitado.
- Cliente HTTP do painel (`services/http`): decisão tomada de **não** implementar enquanto a API não estiver publicada.

---

## C-01: fact-check do Cap. 3 contra o código (só o painel web)

**O que foi feito**
- Comparação de **37 trechos** do Rev 7 do TCC com o código do painel: §1.1, §1.3, §3.1, §3.2, §3.3.1 a §3.3.3, §3.4.1 a §3.4.13 e §3.5.
- Cada linha tem: trecho do TCC, o que o código faz (com o arquivo), situação, correção sugerida e um comentário curto para a margem do Word.
- Resultado: **9** conferem (alguns com ressalva), **18** divergem, **4** são omitidos no texto, **2** faltam no código, **1** é parcial e **3** foram corrigidos no código depois da checagem.
- Itens de API e de mobile ficaram listados à parte, como "fora do escopo", com o dono de cada um.

**Onde está:** [`fact-check-web.md`](fact-check-web.md).

**Como conferir:** cada linha cita o arquivo. O [`mapa-do-codigo.md`](mapa-do-codigo.md) diz onde olhar e qual comando mostra o comportamento.

**Principais achados** (a lista completa está no fact-check)
- O TCC fala em dois artefatos (§3.4, §3.4.1) e o sistema tem **três**: API, app e painel.
- A §3.4.2 só descreve o app. O painel não aparece em nenhuma subseção.
- A Tabela 2 não tem módulos de dashboard e relatórios, que o painel usa. A API real também não tem.
- A Tabela 1 chama o gestor e a equipe de TI de "Administrador", mas o sistema tem os perfis Gestor e Administrador separados.
- RF-DASH: não há mapa de calor por bairro (há camada de concentração por solicitação), o tempo mostrado é desde a abertura (não do atendimento) e o PDF sai pela impressão do navegador.
- RF-ABR: o TCC diz que o agente edita abrigos, mas no painel só gestor e administrador editam. Cita WebSocket, e a atualização é periódica.
- A revisão obrigatória de PR (§3.1.9) não está imposta no GitHub (sem proteção de branch).

---

## C-02: corrigir divergências já identificadas (só o painel web)

**Parte de código: feita.** Os itens em que o código passou a atender o texto:

| Item do fact-check | O que mudou | PR |
|---|---|---|
| 14 (RF-DASH, atualização a cada 30 s) | A lista de abrigos passou a atualizar a cada 30 s, como contadores, alertas e solicitações | [#7](https://github.com/UNIP-CC7/climex-web-app/pull/7) |
| 21 (cobertura de 80%) | 42 testes, 97,5% das linhas, 95,7% das instruções, 88% dos ramos. O mínimo de 80% é imposto pelo `vitest` e pelo CI | [#8](https://github.com/UNIP-CC7/climex-web-app/pull/8) |
| 34 (Husky, lint-staged, commitlint) | Hooks de commit funcionando. Mensagem fora do padrão é recusada pelo `git commit` | [#8](https://github.com/UNIP-CC7/climex-web-app/pull/8) |
| 8 (Prettier) | Prettier configurado, aplicado nos commits e conferido no CI | [#8](https://github.com/UNIP-CC7/climex-web-app/pull/8) |
| (achado nos testes) | O formulário de alertas não limpava depois de emitir. Corrigido | [#8](https://github.com/UNIP-CC7/climex-web-app/pull/8) |

**Parte de texto: não feita.** A seção 5 do [`fact-check-web.md`](fact-check-web.md) diz, item a item, se a divergência se resolve **ajustando o texto** ou **mudando o código**. Quem escrever deve, depois de ajustar, marcar a divergência como resolvida na tabela do Trello e reler §3.4.1 e §3.4.12, como o card pede.

**Decisões que ainda dependem do grupo**
- **Item 17:** quem edita abrigos no painel. Hoje: gestor e administrador. O TCC diz "agentes". A recomendação é ajustar o texto.
- **Item 7:** a revisão obrigatória de PR só existe se a proteção de branch for ativada em `main` e `develop`. Enquanto isso, o texto deve dizer "recomendada".

---

## R-03: Cap. 4, §4.2 Resultado funcional do UC-06 (só o painel web)

**O que foi feito:** quatro capturas do painel real em execução, logado como **gestor municipal**. Todas foram tiradas em 05/10/2026 com o Playwright, a partir do código da `develop`.

| Arquivo | Tela | Rota | Largura | Sugestão de figura |
|---|---|---|---|---|
| `capturas/figura-11-painel-gestor-desktop.png` | Painel de situação (página inteira) | `/` | 1440 px | Figura 11 |
| `capturas/figura-12-mapa-operacional-desktop.png` | Mapa operacional | `/mapa` | 1440 px | Figura 12 |
| `capturas/figura-13-relatorios-desktop.png` | Relatórios pós-evento | `/relatorios` | 1440 px | Figura 13 |
| `capturas/figura-14-painel-gestor-tablet.png` | Painel de situação, versão tablet | `/` | 768 px | Figura 14 |

O Rev 7 termina na Figura 10, por isso a sugestão começa na 11. Renumere conforme o capítulo.

**O que observar ao usar as imagens (para o texto ficar honesto, como pede o A-02)**
- Os dados que aparecem são **simulados**: alertas, solicitações de socorro, capacidade e ocupação dos abrigos, agentes e usuários. A API ainda não tem módulo de dashboard.
- Só os **abrigos candidatos** do mapa são reais (OpenStreetMap), e a capacidade deles é simulada.
- O painel mostra três alertas ativos, 12 solicitações abertas, 5 de 7 abrigos com vagas e 3 agentes em campo. Esses números vêm de `src/mocks/seed.ts` e mudam conforme o estado simulado.
- A concentração de ocorrências é um conjunto de círculos translúcidos, e não um mapa de calor interpolado por bairro.
- O tempo médio mostrado nos relatórios conta desde a abertura da solicitação, não desde o início do atendimento.

**Como refazer as capturas**
1. `npm ci`, `cp .env.example .env`, `npm run dev`.
2. Abrir `http://localhost:5173`, escolher "Entrar como gestor municipal".
3. Ajustar o navegador para 1440 por 900 (desktop) ou 768 por 1024 (tablet) e esperar o mapa terminar de carregar os tiles.
4. Capturar `/`, `/mapa` e `/relatorios`.

**Texto da §4.2:** não feito, fica com outra pessoa. O requisito de origem é o **UC-06** da §3.4.13 (gestor acompanha alertas ativos, solicitações abertas por nível de risco e vagas).

---

## Extras feitos durante o trabalho

| O quê | Para que serve | Onde |
|---|---|---|
| Site publicado na Vercel, ligado ao repositório | Um merge na `main` publica sozinho | <https://climex-web-app.vercel.app>, `vercel.json` (PR [#3](https://github.com/UNIP-CC7/climex-web-app/pull/3)) |
| CI no GitHub Actions | Tipos, lint, formatação, testes com cobertura e build a cada push e PR | `.github/workflows/ci.yml` (PRs [#2](https://github.com/UNIP-CC7/climex-web-app/pull/2) e [#8](https://github.com/UNIP-CC7/climex-web-app/pull/8)) |
| Git Flow | `main`, `develop` e `feature/*`, com PR | `README.md`, PR [#1](https://github.com/UNIP-CC7/climex-web-app/pull/1) |
| Base de abrigos candidatos | Locais reais do estado de SP, reproduzível | `public/data/osm-sp-estado.json`, [`fontes/`](fontes) |

**Problema que apareceu e foi resolvido:** depois do PR 4 (develop para main), a Vercel publicou sem o `vercel.json` e as rotas do painel davam 404 ao atualizar a página. O PR 3 corrigiu. Está funcionando.

## O que não foi feito (e por quê)

- Texto do TCC (§4.2 e ajustes do Cap. 3): decisão do Diego, outra pessoa escreve.
- Cliente HTTP e integração com a API: a API não está publicada, e não tem rotas de usuários, auditoria, dashboard e relatórios.
- Gráficos climáticos e integração com o INMET: ficaram como trabalho futuro.
- WebSocket: a atualização é periódica (30 s).
- Proteção de branch no GitHub: é configuração do repositório, depende de decisão do grupo.
- Mobile e API: ver a seção "fora do escopo" do [`fact-check-web.md`](fact-check-web.md).

## Rascunhos de texto (opcional)

Existem rascunhos de parágrafos para o Cap. 3 e para a §4.2, escritos durante o trabalho. Eles **não** estão neste repositório. Quem quiser usá-los como ponto de partida pode pedir ao Diego. Não são necessários para usar este registro.
