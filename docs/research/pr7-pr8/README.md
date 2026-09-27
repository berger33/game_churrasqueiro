# Pesquisa recuperada das PRs #7/#8

Fonte preservada: `021cc2f2718cfff451659409432f1431c2318a5d`.

Estes três estudos registram uma proposta anterior (10 grelhas/10 restaurantes,
carvões, retenção e experimentos). **Não substituem os dados e as regras canônicas**.
Referências de seção/caminho dentro dos textos pertencem àquela revisão histórica.

O probe foi adaptado à API atual em `tools/studio/probe-monetization.ts` e pode ser
executado com `PROBE_TURNS=1 npm run probe:monetization` para um smoke rápido.

`conform-mouth.mjs.txt` preserva o utilitário experimental de deformação de masters
como texto, não comando executável: ele podia reescrever pixels mantendo aprovação
antiga. O merge não introduz esse caminho alternativo para modificar arte aprovada.
O processador e o gate atuais continuam sendo os pontos de controle oficiais.

A ferramenta de guias foi recuperada como `tools/art/make-grill-guide.mjs`, com
proteção contra sobrescrever arquivos ou gravar em `Assets/`/`prototype/assets/`.
A régua proposta vive em `art/grill-authoring-standard.json`, fora dos dados de gameplay.

[Decisões completas do merge](../../26-MERGE_PR7_PR8.md).
