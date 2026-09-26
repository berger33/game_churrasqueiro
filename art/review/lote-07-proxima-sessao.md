Continuar o game_churrasqueiro a partir do main atualizado após o merge do PR #11.
Trabalhe somente na branch atribuída a esta NOVA sessão, baseada no main atualizado;
nunca mexa diretamente no main nem reutilize a branch da sessão anterior.

ESTADO REAL:
- Lotes 01–02 e 04–06 aprovados e integrados; runtime: 177 sprites, 3,11 MB WebP.
- Lote 03 continua pendente de decisão minha. Não aprove nem altere esse lote.
- Chapa evo 3 e fornalha evo 2–3 do lote 06 têm desvios documentados e autorizados;
  não mexa nelas e nunca afrouxe holeValidation.
- Lote 07: 9/10 imagens geradas e processadas, 30/34 sprites, TODOS pending.
  O merge do PR #11 foi só preservação/transferência: NÃO é aprovação de arte.
- Falta SOMENTE a imagem 05, art/source/lote-07/iap_a.png: kit inicial, sem
  intersticiais, brasas pequeno e médio. A chamada falhou sem imagem e o limite
  de 10 chamadas do turno impediu repetir. NÃO regenere as outras 9 imagens.

LEIA ANTES DE GERAR:
- docs/22-ARTE_2D_PLANO.md, docs/23-PLANO_IMPLEMENTACAO.md e docs/04-ART_STYLE.md §11.
- art/review/lote-07.md (handoff e defeitos conhecidos).
- art/lote-07.json e art/prompts/lote-07.md (prompts literais gravados antes de gerar).
O escopo do lote 07 é o de docs/22 §6 e do spec, pois a descrição antiga do passo
1.3 em docs/23 está desatualizada: coleção; 3 folhas de eventos; 2 folhas IAP;
Brasa Pass; mapa; medalhas; key art. Stores ficam no lote 08.

TAREFA, NESTA ORDEM:
1. Conferir branch e base atualizadas, instalar dependências e recriar a referência
   aprovada de recompensas via make-ref, conforme art/prompts/lote-07.md.
2. Gerar apenas iap_a.png usando o prompt literal 05 e sua referência registrada.
   Se precisar mudar o prompt, grave a nova versão ANTES de gerar.
3. Executar process-sprites com art/lote-07.json. Masters das outras 9 imagens já
   estão no Git; fontes ausentes após wipe devem ser puladas, não regeneradas.
   art/prepare-lote-07.mjs só é necessário para recortar originais existentes das
   folhas IAP 2/2 e medalhas: preserva só a linha superior e ignora extras.
4. PROTEGER O CSV: process-sprites/set-status podem converter CRLF para LF e perder
   notes. Guarde os bytes do HEAD; depois do processamento, restaure as linhas
   anteriores e acrescente somente os 4 nomes novos em CRLF. Confira o diff.
   Nenhuma linha de lote anterior pode mudar nesta etapa.
5. Atualizar as notas de estado incompleto no spec/handoff e o relatório técnico,
   mantendo tudo pending. Rodar node tools/art/review-sheet.mjs art/lote-07.json.
   Conferir 10/10 imagens, 34/34 sprites, recortes e magenta, legibilidade e montagem.
6. MOSTRAR a folha COMPLETA e a montagem, apontando os desvios já documentados
   (inclusive divisões não cartográficas no mapa). Aguardar meu “ok”. Só aprovo
   lote completo; não faça aprovação parcial nem pending→approved sem meu ok.
7. Só APÓS meu ok: set-status → build-runtime → npm run gates → atualizar docs 22/23
   → commit+push. Diferencie assets no runtime de telas efetivamente integradas;
   as montagens não são screenshots do jogo. Não expanda o escopo para implementar
   todo o metajogo automaticamente.

PERSISTÊNCIA E SEGURANÇA:
- Faça commit+push ao FINAL DE CADA TURNO, mesmo enquanto pending, na branch desta
  nova sessão. Isso preserva trabalho, não concede aprovação nem autoriza merge.
- O sandbox pode voltar ao commit inicial e perder raws/refs/node_modules.
  Ao retomar: fetch explícito da branch atual para refs/remotes/origin/<branch>;
  confira que não há trabalho novo a perder antes de reset --hard para esse tip;
  npm install + make-ref. O refspec padrão pode buscar apenas main.
- Masters PNG, spec, prompts e revisões ficam no Git; raws/refs continuam ignorados.
- IGNORE arena/01a0daed e arena/01a0de76: experimentos abandonados de outro universo.
  Não faça merge delas sem me perguntar. Não importe atlas, C# ou renumerações.
