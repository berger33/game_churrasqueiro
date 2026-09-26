# Lote 07 — checkpoint INCOMPLETO, não solicitar aprovação parcial

2026-09-26 · branch `arena/01a0df4e-game-churrasqueiro` · base `a404034` (main / PR #10).

## Estado para continuar após wipe

**9/10 imagens geradas → 30/34 sprites, TODOS `pending`.** Falta apenas a imagem 05,
`iap_a.png` (kit inicial, sem intersticiais, brasas pequeno/médio). A ferramenta falhou
sem produzir imagem; a repetição foi bloqueada pelo limite de 10 chamadas por turno.

- Prompts literais, parâmetros e comandos de referências: `art/prompts/lote-07.md`.
- Spec completo das 10 imagens: `art/lote-07.json`.
- Masters: `Assets/Art` (versionados); brutos/refs: `art/source` (ignorados).
- Folha **parcial**, explicitamente marcada “INCOMPLETO — NÃO APROVAR PARCIALMENTE”:
  `art/review/lote-07.jpg`.
- Montagem estática: `art/review/lote-07-preview.jpg`. Não é captura do jogo e não é
  material de store. Nenhuma dessas telas foi implementada no jogo neste turno.
- Evidências técnicas: `art/review/lote-07-checks.json`.

**Não executar `set-status`, `build-runtime` nem integrar agora.** Não existe “ok” do dono.
Não pedir aprovação enquanto não entregar a folha completa das 10 imagens.
Os docs 22/23 não foram marcados como concluídos; a atualização de integração fica
para depois do “ok”, conforme a ordem pedida.

## Verificações desta parcial

- `process-sprites` terminou sem erro: 9 fontes disponíveis; só `iap_a.png` ausente.
- 30 novos registros `source=ai-assisted`, `status=pending`; todas as linhas anteriores
  do CSV preservadas **byte a byte**, inclusive CRLF e `notes` dos pending.
- Todas as entradas anteriores do manifesto e todos os estados de comida inalterados.
- 0 pixels magenta residuais na verificação `(R > 150 && B > 150 && min(R,B)-G > 80 && A > 0)`.
- Todos os PNGs com dimensões iguais às do manifesto; transparência presente nos recortes.
- 11/11 ids de eventos e 7/7 ids IAP mapeados no spec (4 produtos ainda sem arte).
- `node --check` passou para os scripts de preparação e revisão.
- Folha e montagem regeneradas com `sourceDir` inexistente: hashes idênticos; revisão
  funciona só com masters após wipe.
- `git -c core.whitespace=cr-at-eol diff --check`: o CRLF do CSV é intencional.
- Na geração parcial, `npm run gates` ficou reservado à etapa pós-aprovação. Depois,
  a pedido do dono, o checkpoint foi preparado para merge via PR #11: **13/14 gates
  passaram localmente**, `check-csharp` SKIP por falta de dotnet (CI executa).
  Merge do checkpoint NÃO aprova arte; não houve alteração de gameplay ou runtime.
- Runtime permanece o do main: **177 sprites, 3,11 MB WebP**.
- Lote 03 e as 3 bocas autorizadas com desvio do lote 06: **intocados**.

## Observações visuais a levar à revisão COMPLETA

1. **Coleção:** 6 `grillSkin` + Coroa da Brasa + Medalha da Picanha (8), conforme dados.
   A inox não tem a manivela pedida no prompt. São miniaturas de coleção, não molduras
   jogáveis: nenhuma geometria de boca foi relaxada ou substituída.
2. **Banners:** folhas têm proporções diferentes (semanais ~2,97:1, sazonais A ~2,64:1,
   sazonais B ~2,32:1). A montagem mostra encaixe com `contain`, sem distorcer. Textos,
   quantidades e benefícios nunca foram pintados nas imagens.
3. **IAP 2/2 e medalhas:** o modelo produziu duas linhas; só a superior foi selecionada
   por recorte documentado, sem sobrescrever o bruto. Extras não registrados.
4. **Mapa:** reconhecível como Brasil, mas desenhou divisões internas apesar da proibição.
   Não representa limites cartográficos oficiais. Isso está sinalizado na folha;
   eventual refação depende da revisão do lote completo. Sem caminhos/pins integrados.
5. **Avisos `touches cell edge`:** fogo de chão, neon, coroa, banner fim de semana e
   medalha tier 4. A extração conserva o componente completo, não corta pela célula;
   inspeção visual sem cortes/sangramento visível. Verificar novamente na folha completa.
6. **Miniaturas:** teste em cor 32 px e cinza 48 px incluído para coleção/IAP/medalhas.
   Os centros escuros das medalhas são opacos, próprios para sobrepor símbolos.
7. Sem texto acidental visível. Não há personagens/mãos neste lote.

## Transferência para nova sessão

O dono solicitou merge do checkpoint via PR #11 para continuar em outra sessão.
Prompt pronto: `art/review/lote-07-proxima-sessao.md`. Na **nova** sessão, partir do
main atualizado e trabalhar somente na branch atribuída à nova sessão, não reutilizar
esta branch. A sequência abaixo serve para retomar **esta mesma sessão** após wipe.

## Próximo turno — mesma branch, sem regenerar as 9 imagens

1. `git fetch origin arena/01a0df4e-game-churrasqueiro:refs/remotes/origin/arena/01a0df4e-game-churrasqueiro`
   (este clone pode buscar só main no refspec padrão); conferir que o checkout é esta
   branch e não há trabalho novo a perder; recuperar o tip remoto desta mesma branch com `git reset --hard
   origin/arena/01a0df4e-game-churrasqueiro` se o sandbox reverteu.
2. `npm install`; recriar referências com os comandos de `art/prompts/lote-07.md`.
3. Gerar **só** `iap_a.png`, prompt 05 já gravado (não está gerada/aprovada).
4. Se necessário `node art/prepare-lote-07.mjs` (pula originais ausentes sem apagar masters).
5. Guardar os bytes do CSV do HEAD. `node tools/art/process-sprites.mjs art/lote-07.json`.
   O script pula as 9 fontes ausentes após wipe e mantém seus masters. Restaurar os
   bytes anteriores do CSV e acrescentar somente os **4 nomes novos**, em CRLF.
   Não deixar o parser reescrever `notes` das linhas já existentes.
6. Atualizar o estado incompleto/nota do asset 05 no spec; não alterar `pending`.
7. `node tools/art/review-sheet.mjs art/lote-07.json`; conferir **10/10, 34/34**, sem lacuna;
   mostrar a folha **completa** ao dono e aguardar seu “ok”. Commit+push ao fim do turno.
8. Só depois do “ok” para o lote completo: `set-status` (preservando CSV/notes fora do lote)
   → `build-runtime` → `npm run gates` → docs 22/23 → commit+push na mesma branch.

Não incorporar branches antigas `arena/01a0daed`/`arena/01a0de76`. Não mexer no main.
