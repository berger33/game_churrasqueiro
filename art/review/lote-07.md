# Lote 07 — completo para revisão; não aprovado

2026-09-26 · checkpoint do PR #11 (`8540b05`, main) · continuação nesta sessão na branch `arena/01a0dfd3-game-churrasqueiro`.

## Estado

**10/10 imagens, 34/34 sprites. Todos os 34 registros continuam `pending`.** A imagem 05, `iap_a.png`, foi gerada com o prompt literal 05 e a referência aprovada `lote07_rewards`; os quatro novos sprites foram processados e acrescentados sem alterar as linhas anteriores do registro.

- Spec de recorte: `art/lote-07.json`; prompts literais: `art/prompts/lote-07.md`.
- Masters PNG: `Assets/Art` (versionados). Raw gerado e referências ficam em `art/source` (ignorados).
- Folha completa: `art/review/lote-07.jpg` (10/10 imagens, 34/34 sprites).
- Montagem estática: `art/review/lote-07-preview.jpg`. **Não é captura do jogo nem material de store.** Nenhuma dessas telas/funcionalidades foi integrada.
- Evidências técnicas por sprite: `art/review/lote-07-checks.json`.

**Este checkpoint não é aprovação de arte.** Não executar `set-status`, `build-runtime` nem integrar antes do “ok” explícito do dono para o lote completo. Lotes 01–02 e 04–06 permanecem aprovados; lote 03 e os desvios autorizados do lote 06 ficaram intocados.

## Verificações

- `node art/prepare-lote-07.mjs`: os raws antigos de IAP 2/2 e medalhas não existem após wipe; masters versionados foram mantidos.
- `node tools/art/process-sprites.mjs art/lote-07.json`: processou os 4 novos sprites e pulou as outras 9 fontes brutas ausentes, sem apagar masters.
- `node tools/art/review-sheet.mjs art/lote-07.json`: **10/10 imagens, 34/34 sprites**; folha e montagem regeneradas.
- Verificação dos 34 PNGs: dimensões conferem com o manifesto; **0 pixels magenta residuais** pela métrica `(R > 150 && B > 150 && min(R,B)-G > 80 && A > 0)`; todos os 34 estados são `pending` no lote 07.
- `ASSET_REGISTRY.csv`: os primeiros 58.171 bytes do HEAD foram preservados byte a byte (incluindo CRLF, notas e estados); somente 4 linhas novas foram anexadas com CRLF, todas `pending`.
- Manifesto: 34 sprites do lote 07 (30 do checkpoint anterior + 4 novos); todas as entradas anteriores ao lote 07 permanecem inalteradas. Runtime permanece o do main: **177 sprites, 3,11 MB WebP**; nenhum arquivo do runtime foi alterado.
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

## Próximo passo

Apresentar a folha completa e a montagem e aguardar o “ok” do dono para o lote 07 inteiro. Se houver pedido de alteração, registrar primeiro no prompt/spec. Somente após aprovação explícita: `set-status` → `build-runtime` → `npm run gates` → atualizar docs 22/23, distinguindo os assets incluídos no runtime das telas realmente implementadas.
