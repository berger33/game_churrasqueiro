# Lote 07 — aprovado pelo dono; assets no runtime

2026-09-26 · checkpoint do PR #11 (`8540b05`, main) · continuação nesta sessão na branch `arena/01a0dfd3-game-churrasqueiro`.

## Estado

**10/10 imagens, 34/34 sprites. O dono aprovou o lote completo; os 34 registros estão `approved` / `ai-assisted-reviewed`.** A imagem 05, `iap_a.png`, foi gerada com o prompt literal 05 e a referência aprovada `lote07_rewards`; os quatro novos sprites foram processados e acrescentados sem alterar as linhas anteriores do registro.

- Spec de recorte: `art/lote-07.json`; prompts literais: `art/prompts/lote-07.md`.
- Masters PNG: `Assets/Art` (versionados). Raw gerado e referências ficam em `art/source` (ignorados).
- Folha completa: `art/review/lote-07.jpg` (10/10 imagens, 34/34 sprites).
- Montagem estática: `art/review/lote-07-preview.jpg`. **Não é captura do jogo nem material de store.** Nenhuma dessas telas/funcionalidades foi integrada.
- Evidências técnicas por sprite: `art/review/lote-07-checks.json`.

O “ok” explícito do dono foi dado para o lote completo em 2026-09-26. As ressalvas visuais abaixo foram apresentadas e aceitas. Lotes 01–02 e 04–06 permanecem aprovados; lote 03 e os desvios autorizados do lote 06 ficaram intocados.

## Verificações

- `node art/prepare-lote-07.mjs`: os raws antigos de IAP 2/2 e medalhas não existem após wipe; masters versionados foram mantidos.
- `node tools/art/process-sprites.mjs art/lote-07.json`: processou os 4 novos sprites e pulou as outras 9 fontes brutas ausentes, sem apagar masters.
- `node tools/art/review-sheet.mjs art/lote-07.json`: **10/10 imagens, 34/34 sprites**; folha e montagem regeneradas.
- Verificação dos 34 PNGs: dimensões conferem com o manifesto; **0 pixels magenta residuais** pela métrica `(R > 150 && B > 150 && min(R,B)-G > 80 && A > 0)`; todos os 34 estados são `approved` / `ai-assisted-reviewed`.
- `ASSET_REGISTRY.csv`: linhas fora do lote 07 preservadas byte a byte; 34 linhas aprovadas com CRLF e notes inalteradas.
- Manifesto: 34 sprites do lote 07 (30 do checkpoint + 4 novos); entradas anteriores inalteradas. Runtime reconstruído: **211 sprites, 3,44 MB WebP**.
- `npm run gates`: 13/14 gates locais; `check-csharp` SKIP por falta de `dotnet` no sandbox (CI executará).
- Sem alterações de gameplay, `holeValidation`, lote 03 ou sprites do lote 06.

## Pontos para inspeção visual do lote completo

1. **IAP 1/2, imagem 05:** kit inicial com avental, moedas, brasas e sino; escudo de “sem intersticiais”; sacola de brasas pequena e caixa média. Conferir na folha a leitura a 32 px e a progressão de quantidade pequeno/médio.
2. **Coleção:** 6 `grillSkin` + Coroa da Brasa + Medalha da Picanha (8), conforme dados. A inox não tem a manivela pedida no prompt. São miniaturas de coleção, não molduras de gameplay; geometria nenhuma de churrasqueira foi substituída.
3. **Banners:** proporções diferentes (semanais ~2,97:1, sazonais A ~2,64:1, sazonais B ~2,32:1). A montagem usa `contain`, sem distorcer. Textos, quantidades e benefícios são overlays, não estão pintados.
4. **IAP 2/2 e medalhas:** o modelo produziu duas linhas; apenas a superior foi selecionada pelos recortes documentados, sem sobrescrever os originais. Extras não registrados.
5. **Mapa:** reconhecível como Brasil, mas contém divisões internas apesar da proibição. **Não representam limites cartográficos oficiais.** Caminhos e pins não estão integrados.
6. **Avisos `touches cell edge`:** fogo de chão, neon, coroa, banner fim de semana e medalha tier 4. Recortes conservam os componentes completos; inspeção visual sem cortes/sangramento visível.
7. **Miniaturas:** teste em cor 32 px e cinza 48 px incluído para coleção/IAP/medalhas. Centros das molduras de medalhas opacos e vazios para símbolos sobrepostos.
8. **Key art e montagem:** key art é ilustração para tela-título, não screenshot. A montagem inteira é uma prévia estática, não prova que eventos, mapa, IAP ou passe existam no jogo.

## Estado após aprovação

Aprovação, `set-status`, `build-runtime` e gates locais concluídos. A folha e a montagem documentam a revisão aprovada. Próximo passo técnico: `check-art-registry` (docs/23 §1.4); decisão do lote 03 continua pendente. As telas e fluxos de coleção, eventos, IAP/loja, passe, rota e conquistas continuam não implementados: assets no bundle não equivalem a integração funcional.
