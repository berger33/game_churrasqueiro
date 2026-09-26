# Prompt de retomada — decisão do lote 08

Continuar o `game_churrasqueiro` na branch atribuída à sessão, a partir do estado que gerou a
primeira das quatro rodadas de substituição dos 33 sprites `pending` do antigo lote 03.

## Estado confirmado

- Lotes 01–02 e 04–07 aprovados. Runtime aprovado: **211 sprites, 3,44 MB WebP**.
- O dono pediu refazer os 33 pending como imagens individuais em quatro rodadas: 10 + 10 + 10 + 3.
- **Lote 08 entregue:** 10 imagens individuais, cobrindo `ic_coin`, `ic_ember`, `ic_star`,
  `ic_clock`, `ic_flame`, `ic_check`, `ic_chest`, `ic_booster`, `ic_lock` e `ic_grill_size`.
- As dez imagens foram processadas em dez masters, estão `pending` e passaram na revisão
  técnica: objeto único, leitura a 32 px e em cinza, zero pixels magenta residuais.
- Entregáveis: `art/prompts/lote-08.md`, `art/lote-08.json`,
  `art/review/lote-08.jpg`, `art/review/lote-08-preview.jpg` e
  `art/review/lote-08-checks.json`.
- Os 23 pending restantes continuam fora do runtime. O runtime não foi reconstruído com
  `--include-pending` e nenhuma decisão antiga foi convertida em aprovação.

## Próximo passo imediato

Aguardar a decisão explícita do dono sobre o lote 08.

- Se disser **aprovar/ok**: aplicar `node tools/art/set-status.mjs lote-08 approved`, reconstruir
  o runtime com `node tools/art/build-runtime.mjs`, conferir que ele sobe de 211 para 221
  sprites e executar os gates de arte/render.
- Se pedir refação: manter status `pending`, registrar os pontos e refazer somente os itens
  rejeitados antes de abrir a rodada seguinte.
- Só depois da decisão final do lote 08 planejar e gravar os prompts do lote 09, com 10 dos 23
  sprites restantes. Preservar famílias visuais e usar apenas referências aprovadas.

## Depois da sequência 08–11

Retomar o gate `check-art-registry` (`docs/23` passo 1.4), os ícones de cosmético nos dados
(passo 1.5) e o fechamento do snapshot em `docs/18-STATUS.md`. As peças de ASO/store que antes
ocupavam o nome “lote 08” foram adiadas para o lote 12 ou posterior.

## Segurança do fluxo

- Revisão técnica `ok` não equivale à aprovação do dono.
- Não alterar status sem decisão explícita.
- Não iniciar lote 09 automaticamente.
- Não integrar pending no runtime versionado.
- Brutos e referências são descartáveis/gitignored; masters, prompts, spec e revisão são
  versionados.
