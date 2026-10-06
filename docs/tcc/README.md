# Documentação para o TCC: painel web

Esta pasta reúne o que foi feito no painel web para os cards do Trello (P-16, C-01, C-02 e R-03), com as fontes para quem for escrever o texto do TCC. **Aqui não há texto de TCC.** É o registro do trabalho e o material de apoio.

| Documento | Para quê |
|---|---|
| [`registro-do-que-foi-feito.md`](registro-do-que-foi-feito.md) | Comece por aqui. O que foi feito em cada card, onde está, como conferir e o que ficou de fora |
| [`fact-check-web.md`](fact-check-web.md) | Card C-01 e C-02: 37 trechos do Rev 7 comparados com o código, com situação e correção sugerida |
| [`mapa-do-codigo.md`](mapa-do-codigo.md) | Cada assunto do TCC ligado ao arquivo do código e ao jeito de conferir |
| [`capturas/`](capturas) | Card R-03: quatro capturas do painel real, logado como gestor (1440 px e 768 px) |
| [`fontes/`](fontes) | Origem dos dados reais, como refazê-los, tecnologias com versão e site oficial, e modelo de referências |
| [`../contrato-api.md`](../contrato-api.md) | Card P-16: diferenças entre o painel e a `climex-api` |

## Lembretes para quem escreve

1. Os dados que aparecem nas capturas são **simulados**, exceto os abrigos candidatos do mapa, que são reais (OpenStreetMap). O texto precisa dizer isso.
2. O painel é o **terceiro artefato** do sistema (API, app e painel). O Rev 7 fala em dois.
3. A API ainda não tem módulo de dashboard, usuários, auditoria nem relatórios. O painel usa dados simulados nesses pontos.
4. As figuras novas começam na 11, porque o Rev 7 termina na Figura 10.
5. Os números de cobertura e de testes são de 05/10/2026 (branch `develop`). Refaça com `npm run test:coverage` se o código mudar.
