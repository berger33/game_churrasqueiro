# Prompt de retomada — decisão do lote 10

Continuar o `game_churrasqueiro` na branch atribuída à sessão, durante a substituição dos 33
sprites que estavam `pending` no antigo lote 03. O dono determinou quatro rodadas individuais
(10 + 10 + 10 + 3) e que o merge só ocorrerá depois de completar as 33 imagens.

## Estado confirmado

- Lotes 01–02 e 04–09 aprovados.
- **Lote 08 aprovado:** 10 ícones individuais; runtime 211 → 221 sprites.
- **Lote 09 aprovado pelo dono em 2026-09-26** ao pedir a rodada seguinte. A decisão inclui o
  Espetinho de Rua com dois carrinhos espelhados. Runtime aprovado atual: **231 sprites /
  3,81 MB WebP**.
- **Lote 10 entregue:** 10 imagens individuais — `raw`, `rare`, `medium`, `well` e `burned` de
  contra-filé e de maminha.
- Contra-filé: corpo longo retangular e faixa fina de gordura; maminha: corpo baixo assimétrico
  com ponta à direita. Os cortes permanecem visualmente distintos.
- Cada estado posterior usou o raw recém-gerado da própria família como referência estrita.
- O novo `alignGroups` normalizou tela, pivô e área aparente: contra-filé **918×404**, maminha
  **1038×432**, pivô **0.5,0.5**; variação de área alfa de 0,01% e zero magenta residual.
- Os 10 vereditos técnicos são `ok`, sem avisos. Revisão técnica não é aprovação.
- As dez linhas do lote 10 permanecem `pending`; o runtime aprovado não foi alterado.
- Restam exatamente três imagens para o lote 11: `spr_food_contra_file_served`,
  `spr_food_maminha_served` e `bg_restaurant_churrascaria_bairro`.

## Entregáveis do lote 10

- `art/prompts/lote-10.md`
- `art/lote-10.json`
- `art/review/lote-10.jpg`
- `art/review/lote-10-preview.jpg`
- `art/review/lote-10-checks.json`
- masters em `Assets/Art/Sprites/Food/`

## Próximo passo imediato

Aguardar decisão explícita do dono sobre o lote 10.

- Se aprovar o lote completo: aplicar
  `node tools/art/set-status.mjs lote-10 approved --note "aprovado pelo dono em 2026-09-26 ao pedir o próximo lote"`.
  Só então preparar o lote 11 com os dois pratos servidos e o fundo Bairro. Usar os raws/estados
  aprovados do lote 10 como referências dos pratos.
- Se pedir refação: não iniciar o lote 11; regenerar apenas os nomes apontados, repetir
  processamento, alinhamento e revisão técnica.
- O runtime só deve ser reconstruído com linhas `approved`; nunca publicar os masters `pending`.

## Segurança do fluxo

- Não iniciar o lote 11 antes da decisão do lote 10.
- Não abrir/mesclar PR antes de completar as 33 imagens.
- Brutos/referências são gitignored; masters, prompts, specs e revisões são versionados.
- Depois do lote 11 e das decisões finais, retomar `check-art-registry`, os dados de cosméticos e
  o snapshot de `docs/18-STATUS.md`.
