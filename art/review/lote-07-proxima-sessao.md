Continuar o game_churrasqueiro a partir do main atualizado após o merge do PR #11 (`8540b05`). Use a branch atribuída à sessão; nesta sessão Arena fixa a branch `arena/01a0dfd3-game-churrasqueiro`.

ESTADO:
- Lotes 01–02 e 04–06 aprovados e integrados; runtime: 177 sprites, 3,11 MB WebP.
- Lote 03 continua pendente de decisão do dono; não alterar.
- Chapa evo 3 e fornalhas evo 2–3 do lote 06 têm desvios autorizados; não alterar nem afrouxar `holeValidation`.
- Lote 07 está completo: 10/10 imagens, 34/34 sprites, TODOS `pending`. A imagem 05 `iap_a.png` já foi gerada, processada e versionada. O PR #11 e este checkpoint NÃO são aprovação de arte.
- Folha completa: `art/review/lote-07.jpg`; montagem estática: `art/review/lote-07-preview.jpg`; detalhes e ressalvas em `art/review/lote-07.md`.

AÇÃO IMEDIATA:
1. Mostre/revise comigo a folha COMPLETA e a montagem. Destaque que o mapa contém divisões internas não cartográficas, a inox da coleção não tem manivela, e a montagem não é captura do jogo.
2. Aguarde meu “ok” explícito para o lote completo. Não aprove partes, não rode `set-status`/`build-runtime` e não modifique o runtime sem esse “ok”.
3. Se eu pedir alterações, registre-as no prompt/spec antes de gerar; preserve os masters e não regenere as outras nove imagens sem pedido.
4. Só depois do meu “ok”: `node tools/art/set-status.mjs lote-07 approved` → `node tools/art/build-runtime.mjs` → `npm run gates` → atualizar docs 22/23. Explique quais assets entraram no runtime e quais telas foram efetivamente integradas; a montagem não é screenshot do jogo.

REGRAS:
- O lote 03 permanece intocado; também não tocar nos desvios autorizados do lote 06.
- Todos os masters/spec/prompts/revisões ficam no Git; raws/refs permanecem ignorados.
- Antes de descartar qualquer trabalho, confira status e preserve diffs locais. Não altere `main` diretamente.
- Não incorporar `arena/01a0daed` ou `arena/01a0de76`; experimentos abandonados.
