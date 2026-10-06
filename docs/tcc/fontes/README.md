# Fontes: dados, ferramentas e referências do painel web

Tudo o que alimenta o painel e que alguém pode precisar citar ou refazer. As datas de acesso das referências devem ser preenchidas por quem citar, porque dependem de quando a página for consultada.

## 1. Base de abrigos candidatos (dado real)

| Item | Valor |
|---|---|
| Arquivo usado pelo painel | `public/data/osm-sp-estado.json` (3,4 MB) |
| Origem | OpenStreetMap, consultado pela Overpass API (`overpass-api.de`) |
| Data da consulta | 02/10/2026 |
| Abrangência | Estado de São Paulo (`ISO3166-2 = BR-SP`) |
| Licença | ODbL 1.0, © colaboradores do OpenStreetMap. Exige atribuição, e o painel e o README já citam |
| Resultado | 13.987 elementos brutos, **11.824 com nome**: 7.605 escolas, 1.348 ginásios e centros esportivos, 1.269 unidades de saúde, 849 de assistência social, 558 centros comunitários e 195 postos de bombeiros |
| Uso no painel | Escolas, ginásios, centros comunitários e assistência social viram **candidatos a abrigo** (≈ 10 mil). Saúde e bombeiros ficam no arquivo como pontos de apoio, mas não aparecem como abrigo |

**O que o arquivo não é:** uma lista de abrigos oficiais. Quem designa abrigos é a Defesa Civil de cada município. O OpenStreetMap quase nunca traz capacidade (só 30 locais têm esse campo), por isso capacidade e ocupação no painel são **simuladas**.

**Qualidade do preenchimento** (dos 11.824 itens): rua 69%, bairro 50%, cidade 46%, telefone 40%. A cidade vem vazia em mais da metade e só poderia ser completada cruzando as coordenadas com os limites municipais do IBGE, o que não foi feito.

**Por que não existe base pública oficial pronta:** o S2iD (Ministério da Integração) registra desabrigados e a instalação de abrigos temporários, mas são dados de danos e decretos, não um cadastro de locais com endereço e capacidade. Veja o conjunto de dados no portal de dados abertos (link abaixo).

### Como refazer a base

1. Rodar a consulta [`overpass-query.txt`](overpass-query.txt) na Overpass API e salvar a resposta em `bruto.json`. Exemplo:
   ```bash
   curl -A "climex-tcc/1.0" --data-urlencode "data@docs/tcc/fontes/overpass-query.txt" \
     https://overpass-api.de/api/interpreter -o bruto.json
   ```
   O servidor público pode recusar ou demorar. Se responder com erro, tente outro servidor espelho ou repita depois. Informe um `User-Agent`, senão ele pode devolver erro 406.
2. Normalizar com o script [`normalizar-osm.mjs`](normalizar-osm.mjs):
   ```bash
   node docs/tcc/fontes/normalizar-osm.mjs bruto.json public/data/osm-sp-estado.json 2026-10-05
   ```
   O último argumento é a data da consulta, gravada no arquivo.

O script foi conferido contra o arquivo publicado: com o mesmo `bruto.json` ele gera exatamente os mesmos 11.824 itens. O resultado muda com o tempo, porque o OpenStreetMap é editado todos os dias.

## 2. Mapa

- Tiles: `tile.openstreetmap.org` (© colaboradores do OpenStreetMap). A [política de uso de tiles](https://operations.osmfoundation.org/policies/tiles/) permite uso leve, não carga alta. Em produção, hospedar os tiles ou usar um provedor com chave.
- Os tiles escuros do CARTO foram testados e descartados: passaram a exigir chave de API. O tema escuro do painel é feito por filtro de CSS sobre os tiles claros (`src/components/GlobalStyle.ts`).

## 3. Tecnologias do painel

Versões conforme o `package.json` em 05/10/2026. A coluna "No Rev 7" diz se a tecnologia já aparece nas referências do TCC.

| Tecnologia | Versão | Para que serve no painel | Site oficial | No Rev 7 |
|---|---|---|---|---|
| React | 19 | Interface | <https://react.dev/> | Sim (§3.1.3) |
| TypeScript | 6 | Tipagem | <https://www.typescriptlang.org/> | Sim (§3.1.8) |
| Vite | 8 | Empacotamento e servidor de desenvolvimento | <https://vite.dev/> | Não |
| React Router | 7 | Rotas | <https://reactrouter.com/> | Não |
| TanStack Query | 5 | Cache, atualização e repetição de consultas | <https://tanstack.com/query> | Só no mobile (§3.4.2) |
| Zustand | 5 | Estado da sessão | <https://zustand.docs.pmnd.rs/> | Só no mobile (§3.4.2) |
| styled-components | 6 | Estilos e tema | <https://styled-components.com/> | Não |
| Leaflet | 1.9 | Mapa | <https://leafletjs.com/> | Não |
| react-leaflet e react-leaflet-cluster | 5 e 4 | Leaflet em React e agrupamento de marcadores | <https://react-leaflet.js.org/> | Não |
| Phosphor Icons | 2 | Ícones | <https://phosphoricons.com/> | Não |
| Vitest | 5 | Testes e cobertura | <https://vitest.dev/> | Não |
| Testing Library | 16 | Testes das telas | <https://testing-library.com/> | Não |
| ESLint | 10 | Análise estática | <https://eslint.org/> | Não |
| Prettier | 3 | Formatação | <https://prettier.io/> | Não |
| Husky | 9 | Hooks de commit | <https://typicode.github.io/husky/> | Não |
| lint-staged | 16 | Roda lint e formatação só nos arquivos alterados | <https://github.com/lint-staged/lint-staged> | Não |
| commitlint | 21 | Valida a mensagem de commit | <https://commitlint.js.org/> | Não |
| Conventional Commits | 1.0.0 | Padrão das mensagens de commit | <https://www.conventionalcommits.org/pt-br/v1.0.0/> | Sim (§3.4.12, citado sem referência) |
| GitHub Actions | | CI | <https://docs.github.com/pt/actions> | Sim (§3.2.5) |
| Vercel | | Publicação do site | <https://vercel.com/docs> | Não |
| Playwright | | Verificação das telas no navegador e capturas | <https://playwright.dev/> | Não |

## 4. Dados e documentos externos citados

| Fonte | Endereço | Para que serve |
|---|---|---|
| OpenStreetMap, direitos autorais e licença | <https://www.openstreetmap.org/copyright> | Atribuição obrigatória dos dados e do mapa |
| ODbL 1.0 | <https://opendatacommons.org/licenses/odbl/1-0/> | Texto da licença |
| Overpass API (documentação) | <https://wiki.openstreetmap.org/wiki/Overpass_API> | Como a base foi consultada |
| `social_facility=shelter` | <https://wiki.openstreetmap.org/wiki/Tag:social_facility=shelter> | Marcação de abrigos de emergência no OSM. A cobertura é irregular, por isso não foi usada sozinha |
| Política de uso de tiles | <https://operations.osmfoundation.org/policies/tiles/> | Limite de uso dos tiles |
| S2iD no Portal de Dados Abertos | <https://dados.gov.br/dataset/sistema-integrado-de-informacoes-sobre-desastres-s2id> | Dados de danos e decretos, **não** de locais de abrigo |

## 5. Como a verificação foi feita

- **Testes e cobertura:** `npm run test:coverage`, 42 testes, relatório HTML em `coverage/`. O CI publica o relatório como artefato por 7 dias.
- **Telas e capturas:** conferidas no navegador com o Playwright, em 1440, 768 e 375 px de largura, com checagem de erros no console, de rolagem horizontal e dos acessos por perfil.
- **README:** testado num clone limpo (`npm ci`, tipos, lint, testes e build).
- **API:** as rotas e os valores citados em [`../../contrato-api.md`](../../contrato-api.md) foram lidos no código da `climex-api` (branch `main`, último commit em 18/05/2026). Se a API mudou depois disso, o contrato precisa ser revisto.

## 6. Modelo de entradas para a lista de referências

Formato das entradas existentes no Rev 7 (ABNT). A data de acesso fica por conta de quem for citar.

```
OPENSTREETMAP CONTRIBUTORS. OpenStreetMap. Disponível em: https://www.openstreetmap.org/copyright. Acesso em: __ ___. 2026.
LEAFLET. Leaflet: an open-source JavaScript library for interactive maps. Disponível em: https://leafletjs.com/. Acesso em: __ ___. 2026.
VITE. Vite documentation. Disponível em: https://vite.dev/. Acesso em: __ ___. 2026.
TANSTACK. TanStack Query documentation. Disponível em: https://tanstack.com/query. Acesso em: __ ___. 2026.
VERCEL. Vercel documentation. Disponível em: https://vercel.com/docs. Acesso em: __ ___. 2026.
CONVENTIONAL COMMITS. Conventional Commits 1.0.0. Disponível em: https://www.conventionalcommits.org/pt-br/v1.0.0/. Acesso em: __ ___. 2026.
```

As demais tecnologias da tabela da seção 3 seguem o mesmo molde, com o site oficial da coluna correspondente.
