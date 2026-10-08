# Climex Painel (web)

Painel operacional do SAD/DC para agentes, gestores e administradores da Defesa Civil.
É o terceiro artefato do projeto, ao lado da [`climex-api`](https://github.com/UNIP-CC7/climex-api) e do app [`climex-mobile-app`](https://github.com/UNIP-CC7/climex-mobile-app), e usa o mesmo tema de cores do app.

> **Estado atual:** a API ainda não está publicada, então o painel roda 100% com dados simulados. Só os abrigos candidatos são reais (OpenStreetMap).

Site publicado: <https://climex-web-app.vercel.app>

## Como rodar do zero

Pré-requisitos: [Node.js 22](https://nodejs.org) e Git. Não precisa de Docker, banco de dados nem da API.

```bash
git clone https://github.com/UNIP-CC7/climex-web-app.git
cd climex-web-app
npm ci
cp .env.example .env
npm run dev
```

Abra <http://localhost:5173>. Na tela de entrada escolha um perfil (agente, gestor ou administrador). Ainda não há login de verdade: cada botão abre o painel como aquele perfil enxerga.

No Windows, se o `cp` não existir, use `copy .env.example .env`.

### Conferir que está tudo certo

```bash
npm run typecheck      # tipos
npm run lint           # análise estática (ESLint)
npm run format:check   # formatação (Prettier). Para corrigir: npm run format
npm run test           # testes (vitest)
npm run test:coverage  # testes com cobertura, falha abaixo de 80%
npm run build          # build de produção em dist/
npm run verify         # tudo acima, na ordem do CI (tipos, lint, formatação, testes com cobertura e build)
```

O `npm run verify` para no primeiro passo que falhar e é o que se roda antes de abrir um pull request. O mesmo conjunto roda no CI a cada push e pull request em `main` e `develop`.

### Hooks de commit (Husky)

O `npm ci` instala os hooks automaticamente (script `prepare`). Eles rodam em todo commit:

- **pre-commit:** o `lint-staged` aplica Prettier e ESLint só nos arquivos que você alterou.
- **commit-msg:** o `commitlint` exige o formato Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`...). A mensagem é recusada se não seguir. O `npm run commit` monta a mensagem para você.

### Cobertura de testes

O mínimo é 80% de linhas, instruções, funções e ramos, medido sobre o código da aplicação. Ficam de fora, por não terem lógica testável em ambiente de teste: o ponto de entrada (`main.tsx`), as definições de estilo (`styles.ts`), o tema, a massa de dados (`mocks/seed.ts`) e as camadas do mapa em Leaflet (`components/map`), que precisam de um navegador de verdade e são conferidas com o Playwright. O relatório HTML sai em `coverage/`.

## Variáveis de ambiente

O Vite lê o `.env` ao iniciar. Depois de mudar um valor, reinicie o `npm run dev`.

| Variável | Padrão | Para que serve |
|---|---|---|
| `VITE_USE_MOCKS` | `true` | Usa os serviços simulados de `src/services/mock`. Qualquer valor diferente de `false` mantém os mocks. |
| `VITE_API_URL` | não usada | Endereço da API (por exemplo `http://localhost:3000`). **Reservada:** o painel ainda não tem cliente HTTP. |

Com `VITE_USE_MOCKS=false` o painel não carrega: a página fica em branco e o erro explicativo aparece no console do navegador. Isso é proposital, para ninguém achar que está falando com a API quando não está. O que falta para ligar a API real está em [`docs/contrato-api.md`](docs/contrato-api.md).

## Ordem de subida no monorepo (API, mobile, web)

Para quem for montar o README raiz do projeto, esta é a ordem em que as partes sobem:

1. **API** (`climex-api`): `docker compose up --build` sobe PostgreSQL com PostGIS e a API em `http://localhost:3000`.
2. **Mobile** (`climex-mobile-app`): `npm install` e `npx expo start`, apontando para a URL da API.
3. **Web** (este repositório): os passos de "Como rodar do zero", acima. Hoje funciona sozinho, sem a API.

## Telas

| Rota | Perfis | O que faz |
|---|---|---|
| `/entrar` | todos | escolhe o perfil (login simulado) |
| `/` Painel | agente, gestor, admin | contadores, mapa resumo, alertas, ocupação e próximas solicitações |
| `/mapa` | agente, gestor, admin | camadas de alertas, abrigos, solicitações e concentração de ocorrências |
| `/socorro` | agente, gestor, admin | fila por nível de risco, aceitar e concluir |
| `/abrigos` | agente, gestor, admin | candidatos e ativos, busca, edição, entrada e saída |
| `/alertas` | gestor, admin | emitir (área no mapa) e encerrar |
| `/relatorios` | gestor, admin | indicadores, exportar CSV, imprimir ou salvar em PDF |
| `/usuarios` | admin | perfis e ativação |
| `/auditoria` | admin | trilha de auditoria com hash encadeado |

O controle de acesso por rota está em `src/features/auth/store.ts` (`ROUTE_ROLES`). Ele só esconde telas no navegador. Quando a API existir, quem decide é o servidor.

## Dados

- **Abrigos candidatos:** locais reais do OpenStreetMap em todo o estado de SP (`public/data/osm-sp-estado.json`, cerca de 10 mil escolas, ginásios, centros comunitários e CRAS). Não são abrigos oficiais. © colaboradores do OpenStreetMap, licença ODbL.
- **Capacidade, ocupação, alertas, solicitações e usuários:** simulados (`src/mocks/seed.ts` e `src/services/mock`). Recarregar a página volta tudo ao estado inicial.
- **Nível de risco:** `src/lib/risk.ts` é uma regra de exemplo. A regra real virá da API.

## Cache de leitura (72 horas)

Para o painel continuar útil quando a conexão cai, os dados lidos ficam salvos no navegador (`localStorage`, chave `climex.cache`) por **72 horas**. Ao reabrir o painel, ele mostra o que foi salvo e atualiza assim que a conexão voltar. Sem conexão, o topo mostra o aviso "Sem conexão, dados salvos".

- **O que é salvo:** o resumo do painel, os alertas e as solicitações de socorro.
- **O que não é salvo:** usuários e auditoria (têm dados pessoais) e a base de abrigos (arquivo estático de 3 MB que o navegador já guarda).
- **Quando é apagado:** ao sair da conta, ao entrar de novo, quando passa de 72 horas, quando o formato dos dados muda (`CACHE_BUSTER` em `src/lib/persist.ts`) ou quando o navegador bloqueia o armazenamento (o painel segue só com a memória).
- **Cuidado:** o cache fica em texto no navegador. Com dados reais da API, avalie com a equipe quais campos podem ficar salvos por 72 horas, principalmente localização e dados de quem pediu socorro.

O código está em `src/lib/persist.ts`, ligado em `src/main.tsx`.

## Estrutura

```
src/
  components/   AppShell, mapa e componentes de interface
  screens/      uma pasta por tela (index.tsx e styles.ts)
  services/     contratos (types.ts) e implementação simulada (mock/)
  features/     sessão e permissões por rota
  domain/       tipos do domínio
  theme/        tokens de cor herdados do app mobile
docs/           contrato com a API e capturas de validação
_layout/        mockup estático aprovado do layout
```

Os componentes só falam com `src/services/index.ts`. Para ligar a API real, crie `src/services/http/` com as assinaturas de `src/services/types.ts` e escolha a implementação por `VITE_USE_MOCKS`.

## Publicação

O site está na Vercel, ligada a este repositório. Um merge na `main` publica sozinho. O `vercel.json` manda todas as rotas para o `index.html`, porque o painel usa rotas no navegador (`/socorro`, `/mapa`).

Os tiles do mapa vêm de `tile.openstreetmap.org`, que serve para protótipo mas não para carga alta. Em produção, hospede os tiles ou use um provedor com chave guardada no ambiente.

## Fluxo de trabalho (Git Flow)

- `main`: só código de produção.
- `develop`: integra o que está em andamento. É a base de toda feature.
- `feature/<assunto>`: uma branch por funcionalidade ou correção, criada a partir da `develop`.

Todo código entra na `develop` por pull request, com revisão de pelo menos outra pessoa da equipe. Ninguém faz push direto em `main` ou `develop`.

Commits seguem o Conventional Commits. Use `npm run commit` para montar a mensagem (commitizen), por exemplo `feat(socorro): filtrar por bairro` ou `fix(mapa): corrigir zoom inicial`.

Antes de abrir o pull request, rode `npm run typecheck`, `npm run lint` e `npm run test`.
