# 26 — Consolidação das PRs #7 e #8

**Data:** 2026-09-27. **Autorização vigente:** “dê um merge completo em tudo (resolva conflitos)”.
Esta autorização substitui a decisão anterior de deixar as PRs abertas sem integração.

## Escopo e método

- Base de produção preservada: `bf478348f2490263f2feab4a6bd902e57bf2cae6` (PR #17).
- Auditoria preservada antes de modificar a árvore: commit `8040486`.
- Branch de trabalho e único destino de push: `arena/01a0e494-game-churrasqueiro`.
- Histórico completo recuperado (`--unshallow`); ancestral comum `3e6ea7f`.
- Ponta #7: `1874270c0464c24e659e5edac9a0a03b00569d37`.
- Ponta #8: `021cc2f2718cfff451659409432f1431c2318a5d`; contém integralmente a #7.
- Executado merge real `--no-ff` da #8, resolvendo os 142 conflitos. Não foi usado
  `merge -s ours`, squash ou marcação artificial de branches como integradas.
- Todas as **198 entradas do delta de entrada** foram classificadas na
  [matriz por arquivo](evidence/merge-pr7-pr8/resolutions.csv), inclusive arquivos
  que Git combinou sem conflito textual mas alteravam contratos de produção.

“Merge completo” aqui significa integrar os históricos e reconciliar o conteúdo,
não ativar simultaneamente regras incompatíveis. O modelo de 10 grelhas/10 restaurantes
foi substituído pelo modelo posterior, já validado, de 4 grelhas/7 restaurantes.
Seu código e materiais continuam recuperáveis no histórico integrado; estudos e
conceitos exclusivos também foram arquivados na árvore. Não há perda de commits.

## Resolução por domínio

| Domínio | Decisão |
|---|---|
| Gameplay e dados | Mantidos os contratos posteriores A-01–A-06.4: virada dos cortes lentos, Fornalha/Premium, VIP, estoque, funcionários, upgrades, save/offline e economia de 1.500 turnos. Não importar curvas/combustíveis/10 restaurantes antigos por automerge. |
| C# e vetores | Mantida a API atual e os vetores atuais. Os ports preliminares antecedem as correções da main. Nenhum vetor foi regenerado/afrouxado para passar o merge. |
| Arte aprovada | Masters, atlas, manifestos, lotes e revisões finais mantidos byte a byte. Os sete conceitos PNG e seis WebPs exclusivos foram para `art/archive/pr7-pr8/`, fora dos consumidores de produção. |
| Aprovação de arte | O antigo `check-art-registry.mjs` agora delega ao gate estrito `.ts`, propagando falhas. Nada de allowlist congelada que permita contornar as 244 identidades aprovadas. |
| Builder do atlas | Recuperados `--dry-run`, diagnóstico de estados incompletos e lacunas nas evoluções. Dry-run testado para não apagar ou alterar arquivo algum. Suporte a saída absoluta/relativa consistente. |
| Guias de arte | Recuperado gerador orientado a grelha/evolução com inclinação do vão e corpo nivelado em `make-grill-guide.mjs`. Mantidos os comandos legados de `make-ref.mjs`. O novo comando recusa sobrescrita, saídas de produção e parâmetros inválidos. |
| Geometria experimental | Recuperada como ferramenta de autoria/pesquisa, com configuração separada em `art/grill-authoring-standard.json`. Não altera a escala do renderer nem decide aprovação de arte. |
| Ferramenta de deformação | `conform-mouth.mjs` preservado como texto histórico: reescrever pixels mantendo o status anterior é incompatível com o contrato atual de aprovação. Não disponibilizado como bypass executável. |
| Pesquisa | Três estudos em `docs/research/pr7-pr8/`, explicitamente históricos. Probe adaptado a `playerLevel` obrigatório, IDs existentes e topo atual; não muda gameplay. |
| CI e dependências | Preservados as versões atuais e os 15 gates. Acrescentados testes funcionais das ferramentas; nenhum gate enfraquecido ou substituído pelo antigo. |

**Checagem de não regressão:** diff vazio contra a base nos diretórios `shared/`,
`Assets/`, `prototype/`, `.github/`, `tools/csharp/`, `tools/golden/` e `tools/sim-core/`.
O helper experimental de layout foi colocado em `tools/art/`, não no motor de jogo.

## Uso das adições

```bash
npm run art:preview
npm run art:guide -- art/guias/ze-evo3.png 1024 --grill ze_da_esquina --evo 3 --mouth-tilt 7
PROBE_TURNS=1 npm run probe:monetization
npm run art:inspect
```

O último comando é **diagnóstico de uma régua proposta**, não gate de produção.
Nesta base retorna 1 por três divergências contra essa proposta. O resultado foi
preservado, não escondido com tolerâncias novas nem corrigido repintando artes aprovadas.
Ele não demonstra defeito do renderer atual, cuja escala é outra. O gate de aprovação
continua sendo `npm run check-art-registry`, que passa com 244 sprites.

## Validação local e limitações

- `npm run gates`: **14/15 PASS**, C# SKIP por ausência de .NET local.
- Vitest: **756 testes / 38 arquivos PASS** (740 anteriores + 16 de integração/autoria).
- `npm run sim:long`: **18/18 metas PASS**, 1.500 turnos.
- Arte, render smoke, FTUE e capturas do protótipo: PASS.
- Tests adicionais cobrem dry-run sem escrita, wrapper com sucesso e erro,
  guias válidos, proteção de pixels/aprovações, parâmetros inválidos, API legada,
  geometria para as 12 evoluções atuais e probe com os desbloqueios atuais.
- Nenhum conflito no índice depois da resolução.

Evidências: [gates](evidence/merge-pr7-pr8/gates.log),
[simulação longa](evidence/merge-pr7-pr8/sim-long.log),
[16 testes adicionais](evidence/merge-pr7-pr8/new-tests.log),
[probe](evidence/merge-pr7-pr8/probe.log),
[diagnóstico experimental, não gate](evidence/merge-pr7-pr8/geometry-research.log).

**Não confundir merge com conclusão do Android.** Os bloqueios descritos na
[auditoria 25](25-AUDITORIA_STATUS_E_BRANCHES.md) permanecem: runtime/cena Unity,
persistência, serviços simulados, release/QA de dispositivo e o runner C# que
reclassifica 13 divergências como `not ported`. Este merge não corrige nem introduz
a supressão; preserva explicitamente a mesma base de C#. Sem Unity local, não há
homologação Android. O CI deve compilar o core e confirmar o mesmo resultado antes
que esta consolidação seja integrada à main.

## Entrega GitHub e limpeza

A entrega remota é feita por PR desta branch para `main`, com **merge commit**,
checks verdes e confirmação da ponta revisada. Não fazer squash/rebase desta PR,
pois isso perderia a ancestralidade usada para encerrar #7/#8 e limpar refs.
A PR e os respectivos checks no GitHub são a evidência do estado de entrega remoto.

Depois da integração, verificar `git merge-base --is-ancestor` de cada ponta antiga
contra `origin/main`. Confirmar também que ninguém avançou a branch desde a inspeção.
Só então remover as quatro refs antigas (#7, #8, #16 e #17); manter `main` e a branch
ativa desta sessão. Se #7/#8 não forem encerradas automaticamente pelo GitHub por
integração indireta, registrar a PR de consolidação antes de fechá-las. Não marcar
como integrado algo que não esteja no histórico remoto.
