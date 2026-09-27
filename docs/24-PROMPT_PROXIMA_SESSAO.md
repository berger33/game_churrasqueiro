# Prompt de retomada — decisão final do lote 11

Continuar o `game_churrasqueiro` na branch atribuída à sessão. A substituição dos 33 sprites
que estavam `pending` no antigo lote 03 foi executada nas quatro rodadas individuais pedidas
pelo dono (10 + 10 + 10 + 3). Nenhum merge foi realizado.

## Estado confirmado

- Lotes 01–02 e 04–10 aprovados.
- Lotes 08–10 substituíram e aprovaram 30/33 sprites individuais.
- **Lote 10 aprovado pelo dono em 2026-09-26:** os dez estados de grelha foram marcados
  `approved`; runtime reconstruído de 231 para **241 sprites / 3,88 MB WebP**.
- **Lote 11 entregue:** três imagens individuais finais:
  - `spr_food_contra_file_served` — fileira reta de fatias retangulares;
  - `spr_food_maminha_served` — leque assimétrico de fatias em cunha;
  - `bg_restaurant_churrascaria_bairro` — cozinha/balcão nas bordas e centro livre.
- A primeira passada do fundo Bairro foi descartada por ocupar o eixo do gameplay; somente a
  segunda passada, com palco central explícito, foi processada.
- Os dois pratos têm 0 pixels magenta residuais. O fundo é opaco em 768×1376, sem pessoas ou
  texto. Os três vereditos técnicos são `ok`, sem avisos.
- As três linhas do lote 11 permanecem `pending` e fora do runtime aprovado.
- As **33 imagens de substituição já foram geradas**; falta apenas a decisão final sobre estas
  três para encerrar a sequência.

## Entregáveis do lote 11

- `art/prompts/lote-11.md`
- `art/lote-11.json`
- `art/review/lote-11.jpg`
- `art/review/lote-11-preview.jpg`
- `art/review/lote-11-checks.json`
- masters em `Assets/Art/Sprites/Food/` e `Assets/Art/Backgrounds/`

## Próximo passo imediato

Aguardar decisão explícita do dono sobre o lote 11.

- Se aprovar o lote completo:
  1. `node tools/art/set-status.mjs lote-11 approved --note "aprovado pelo dono em 2026-09-26; sequência de 33 substituições concluída"`;
  2. `node tools/art/build-runtime.mjs` e confirmar 16 comidas + 7 fundos no índice;
  3. atualizar revisão, docs e snapshot honesto;
  4. executar gates completos;
  5. só abrir/mesclar PR se o dono der instrução explícita para isso.
- Se pedir refação: manter apenas os nomes apontados fora do runtime, regenerar e repetir a
  revisão antes de qualquer fechamento.

## Segurança do fluxo

- Revisão técnica não equivale à aprovação do dono.
- O runtime versionado só pode conter linhas `approved`.
- Brutos/referências são gitignored; masters, prompts, specs e revisões são versionados.
- Nenhum merge automático: completar as 33 imagens removeu o bloqueio de produção, mas não
  substitui uma ordem explícita de merge.
