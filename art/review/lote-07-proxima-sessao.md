Continuar o game_churrasqueiro a partir do main atualizado após o merge do PR #11 (`8540b05`). Use a branch atribuída à sessão; nesta sessão Arena fixa `arena/01a0dfd3-game-churrasqueiro`.

ESTADO APROVADO:
- Lotes 01–02 e 04–07 aprovados; runtime do protótipo: 211 sprites, 3,44 MB WebP.
- Lote 03 continua pendente da decisão do dono; não alterar.
- Desvios autorizados do lote 06 permanecem documentados; não alterar nem afrouxar `holeValidation`.
- Lote 07: 10/10 imagens, 34/34 sprites aprovados; PR #11 checkpoint não era aprovação, mas o dono deu “ok” explícito para o lote completo em 2026-09-26.
- Evidências e ressalvas: `art/review/lote-07.md`, `art/review/lote-07-checks.json`, folha `art/review/lote-07.jpg`, montagem estática `art/review/lote-07-preview.jpg`.

PRÓXIMOS PASSOS:
1. Não repetir geração, `set-status` ou build-runtime do lote 07: já foram concluídos. Os 34 assets estão no bundle.
2. Continue pelo próximo passo do plano: `check-art-registry` (docs/23 §1.4) e, separadamente, aguarde minha decisão sobre o lote 03.
3. As novas telas/fluxos de coleção, eventos, IAP/loja, Brasa Pass, mapa/rota e conquistas ainda não foram implementados. Não confundir assets no runtime com telas funcionais ou screenshots reais; montagem é estática.
4. Não alterar os desvios do lote 06 nem regenerar o lote 07 sem pedido explícito.

REGRAS:
- Masters/spec/prompts/revisões ficam no Git; raws/refs permanecem ignorados.
- Não altere `main` diretamente. Antes de descartar trabalho, confira o status e preserve diffs locais.
- Não incorporar `arena/01a0daed` ou `arena/01a0de76`; experimentos abandonados.
