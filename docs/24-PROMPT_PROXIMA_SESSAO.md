# Prompt de retomada — decisão do lote 09

Continuar o `game_churrasqueiro` na branch atribuída à sessão, durante a substituição dos 33
sprites que estavam `pending` no antigo lote 03. O dono determinou quatro rodadas individuais
(10 + 10 + 10 + 3) e que o merge só ocorrerá depois de completar as 33 imagens.

## Estado confirmado

- Lotes 01–02 e 04–08 aprovados.
- **Lote 08 aprovado pelo dono em 2026-09-26:** 10/10 linhas `approved`, runtime reconstruído
  de 211 para **221 sprites / 3,49 MB WebP**.
- **Lote 09 entregue:** 10 imagens individuais — oito upgrades (`ic_heat`, `ic_stability`,
  `ic_speed`, `ic_charcoal`, `ic_charcoal_quality`, `ic_auto_refill`, `ic_knife`, `ic_board`)
  e dois fundos (`bg_restaurant_espetinho_rua`, `bg_restaurant_trailer`).
- Os oito ícones passaram na revisão a 32 px e em cinza, com zero magenta residual.
- Trailer: técnico `ok`, centro livre, sem texto/pessoas.
- Espetinho de Rua: técnico `warn`; o modelo espelhou o carrinho e entregou dois pontos, um em
  cada borda, em vez de um só à direita. O centro continua livre, sem texto ou pessoas.
- Lote 09 permanece `pending` e fora do runtime aprovado.
- Restam 13 sprites para os lotes 10–11: fundo Churrascaria de Bairro e 12 estados individuais
  de contra-filé/maminha.

## Entregáveis do lote 09

- `art/prompts/lote-09.md`
- `art/lote-09.json`
- `art/review/lote-09.jpg`
- `art/review/lote-09-preview.jpg`
- `art/review/lote-09-checks.json`

## Próximo passo imediato

Aguardar decisão explícita do dono sobre o lote 09, especialmente sobre o fundo Espetinho de
Rua com dois carrinhos.

- Se aprovar o lote completo: `node tools/art/set-status.mjs lote-09 approved --note "..."`,
  `node tools/art/build-runtime.mjs`, confirmar runtime 231 sprites e executar gates.
- Se aprovar parcialmente: passar os nomes aprovados ao `set-status`; manter os recusados
  `pending`/`rejected` e refazê-los antes do lote 10.
- Se pedir refação do fundo: não aprovar esse nome e regenerar apenas
  `bg_restaurant_espetinho_rua` com guia/composição mais restritiva.
- Não começar o lote 10 antes da decisão.

## Segurança do fluxo

- Revisão técnica não equivale à aprovação do dono.
- Não integrar `pending` no runtime versionado.
- Não abrir/mesclar PR antes de completar as 33 imagens.
- Brutos/referências são gitignored; masters, prompts, specs e revisões são versionados.
- Depois dos lotes 10–11, retomar `check-art-registry`, os dados de cosméticos e o snapshot de
  `docs/18-STATUS.md`.
