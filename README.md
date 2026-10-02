# Climex Painel (web)

Painel operacional do SAD/DC para agentes, gestores e administradores da Defesa Civil.
Complementa o app mobile [`climex-mobile-app`](https://github.com/UNIP-CC7/climex-mobile-app) e usa o mesmo tema de cores.

> A API ainda não está publicada. O painel roda 100% com dados simulados.

## Rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm run test     # vitest
npm run lint
npm run typecheck
npm run build
```

Na tela de entrada escolha um perfil (agente, gestor ou administrador). Não há login real ainda.

## Telas

| Rota | Perfis | O que faz |
|---|---|---|
| `/` Painel | todos | contadores, mapa resumo, alertas, ocupação, próximas solicitações |
| `/mapa` | todos | camadas de alerta, abrigos, solicitações e concentração de ocorrências |
| `/socorro` | todos | fila por nível de risco, aceitar e concluir |
| `/abrigos` | gestor, admin | candidatos e ativos, busca, edição, entrada e saída |
| `/alertas` | gestor, admin | emitir (área no mapa) e encerrar |
| `/relatorios` | gestor, admin | indicadores, exportar CSV, imprimir ou salvar em PDF |
| `/usuarios`, `/auditoria` | admin | perfis e trilha de auditoria |

## Dados

- **Abrigos candidatos:** locais reais do OpenStreetMap em todo o estado de SP (`public/data/osm-sp-estado.json`, ~10 mil escolas, ginásios, centros comunitários e CRAS). Não são abrigos oficiais. © colaboradores do OpenStreetMap, licença ODbL.
- **Capacidade, ocupação, alertas, solicitações e usuários:** simulados (`src/mocks/seed.ts`, `src/services/mock`).
- O nível de risco (`src/lib/risk.ts`) é uma regra de exemplo. A regra real virá da API.

## Trocar para a API real

Os componentes só falam com `src/services/index.ts`. Quando a API estiver no ar, crie `src/services/http/` com as assinaturas de `src/services/types.ts` e escolha a implementação por `VITE_USE_MOCKS`. Pendências já mapeadas no TCC: WebSocket (hoje há atualização a cada 30 s), gráficos climáticos do INMET, PDF gerado no servidor.

## Mapa em produção

Os tiles usam `tile.openstreetmap.org`, que serve para protótipo mas não para carga alta. Em produção, hospede os tiles (o OSRM do projeto já usa um extrato do OpenStreetMap) ou use um provedor com chave guardada no ambiente.

## Estrutura

```
src/
  components/   AppShell, mapa, primitivos de UI
  screens/      uma pasta por tela (index.tsx + styles.ts)
  services/     contratos e implementação simulada
  features/     autenticação e permissões por rota
  domain/       tipos do domínio
  theme/        tokens herdados do app mobile
  _layout/      (na raiz) mockup estático aprovado
```

## Fluxo de trabalho (Git Flow)

- `main`: só código de produção.
- `develop`: integra o que está em andamento. É a base de toda feature.
- `feature/<assunto>`: uma branch por funcionalidade ou correção, criada a partir da `develop`.

Todo código entra na `develop` por pull request, com revisão de pelo menos outra pessoa da equipe. Ninguém faz push direto em `main` ou `develop`.

Commits seguem o Conventional Commits. Use `npm run commit` para montar a mensagem (commitizen), por exemplo `feat(socorro): filtrar por bairro` ou `fix(mapa): corrigir zoom inicial`.

Antes de abrir o pull request, rode `npm run typecheck`, `npm run lint` e `npm run test`.
