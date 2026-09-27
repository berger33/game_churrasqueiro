# F3 / A-03 — preparo real do vinagrete

2026-09-27 UTC · branch `arena/01a0e099-game-churrasqueiro`.
**Funcional validado localmente; economia global ainda bloqueada. Sem push, PR ou merge desta entrega.**

## Base confirmada (não repetir trabalho já integrado)

O prompt colado era anterior ao estado real. `git fetch origin` confirmou árvore inicial
limpa e `HEAD == origin/main == e50ce1523fa3d04119dc454e3edb050070641c10`.
PR #13 MERGED; PR #14 MERGED em 2026-09-27T01:56:09Z. CI do merge #14 verde:
[run 36287025604](https://github.com/berger33/game_churrasqueiro/actions/runs/36287025604).
Recibos em `base-pr14.json` / `base-main-ci.json`. Esse CI **é da base**, não deste patch.
PRs #7/#8 continuam abertos e preservados. Nenhuma operação de limpeza ou merge realizada.

Node22.22.3/npm10.9.8, `npm ci`, baseline351 testes, 14/15 gates locais (C# SKIP sem dotnet),
sim longo15/18 com os três desvios conhecidos. Logs em `baseline-*.log`.
F1, F2, A-01 e A-02 já estavam integrados; só A-03 foi executado nesta sessão.

## Contrato implementado

- Receita preservada: `cookMethod:prep`, nível12/restaurante0, `prepSec:2`, sem calor/virada.
- Retirar estoque cria porção **inerte**. `startPrep(food, slotIndex?)` admite uma única vez
  numa vaga livre; sem índice escolhe a primeira. Rejeita item de outro turno, não-prep,
  servido/descartado, slot inválido/ocupado e admissão duplicada, sem efeito colateral.
- `prepSlots = restaurant.service.prepSlots + floor(board.effect)`; a faca mantém
  `prepSpeedMult = 1 + knife.effect`. Cada vaga avança `dt * prepSpeedMult / prepSec`.
  Sem fila oculta: stock fora da estação não avança. Porção pronta **continua ocupando**
  a vaga, inclusive durante drag; só serviço válido/descarte libera. Não queima esperando.
- A API de ações `TurnSimulation.place` rejeita preparo na grelha. Serviço exige admissão
  na estação **e** progresso1. Mover/virar também não funciona para prep fora da grelha.
  Pedido errado, incompleto ou cliente que saiu não consome porção. Crédito, combo e eventos
  passam pelo `serve` existente; repetição não credita de novo, resultado segue puro.
- Primitivas geométricas/heat de `cooking.ts` não foram alteradas: não são a fronteira de
  ações de turno. Inclusive o antigo fixture sintético `flip.vinagrete` permanece igual;
  ele **não** representa uma ação permitida no jogo. Um experimento de guard nessa primitiva
  foi removido: mudaria esse vetor/paridade parcial C#, fora da fronteira deste checkpoint.
  A regressão final verifica a API pública de turno. Não houve ajuste de expectativas/gates.
- Bot chama `startPrep` e consulta capacidade antes de criar. Preservada a política existente
  de uma porção ativa por ingrediente: **não** medir benefício de múltiplas tábuas pelo bot
  atual. Humanos podem ocupar todas as vagas; A-06 ainda precisa mapear/validar os27 upgrades.
  Vazamento de itens de **grelha** A-15 não foi corrigido junto.

## UI e orientação

- Catálogo completo de `availableIngredients`, com unlock A-02. Vinagrete ausente em11,
  presente em12/13; sem retirar ingrediente do pool para esconder o defeito.
- Toque no vinagrete inicia na primeira vaga; drag até uma vaga vazia escolhe o destino.
  Área de preparo separada da grelha/estoque, abaixo da bancada, com progresso e PRONTO.
  Arrastar ao pedido serve; arrastar de volta à bancada descarta. Drop inválido retorna
  porção à vaga; stock inválido é devolvido, sem deixar comida/timer órfão.
- Cinco alvos58×48 por página, pager64×48; suporta as10 vagas de restaurante6+tábua5.
  Paginação de receitas e de vagas independentes. Autoinício acompanha a página da porção.
  `pointercancel` não serve/descarta porção admitida, nem inicia stock (retorna ao estoque).
- Seis textos novos em pt-BR/en-US/es-419; orientação de bancada distingue brasa/preparo.
  Usa sprites aprovados de vinagrete e sons existentes (place/erro/serve/perfect/combo),
  sem lote novo nem inventar evento analytics fora do schema. FTUE permanece inalterado.

## Prova red → green

- `red-rules.log`: **15/16 falham** com a suíte final contra `turn.ts/policy.ts` da base
  e50ce15 (substituição temporária, restaurada em `finally`). Uma regressão de unlock11
  já passava. Inclui reprodução direta estoque pronto sem admissão e aceitação na grelha;
  novos contratos de capacidade/admissão ainda não existiam.
- `red-layout.log`: **2/2 falham** antes de existir layout de vagas/pager.
- `red-ui.log`: harness do bundle real, antes da implementação, falha no nível12 porque
  vinagrete está ausente da bancada. Depois o harness foi ampliado para testar o ciclo.
- `red-prep-gap.log`: durante revisão, drop no espaço entre vagas descartava a porção.
  Regressão de ponteiro falhou antes da correção; toda a faixa de preparo agora é retorno
  seguro, não lixeira. Cancelamento foi limitado a prep para preservar o contrato grill/FTUE.
- Final: **369/369 testes**,20 arquivos (18 novos + teste antigo de prep passa a iniciar
  explicitamente); gates **14/15 locais**, único SKIP C# sem SDK. `green-gates.log`.
- Regras: tempo exato com faca0/1/6, capacidade/restaurantes0/2/6+tábua5, admissão inválida,
  espera pronta, serviço antecipado/duplicado/atrasado, descarte, cliente perdido/pedido
  errado, pedido misto **cozido fisicamente** com combo/moedas/XP/resultado, bot com dois pedidos.
- UI real (`green-ui.log`): níveis11/12/13; tap e drag, grelha proibida, lotação sem vazamento,
  tentativa antecipada, cancelamento, serviço de pedido **natural** UID10 da seed do jogo,
  descarte,10 vagas/pager e seleção de vaga vizinha. Outros clientes são servidos com
  ponteiro para abrir capacidade de chegada; nenhuma mutação de Food/Customer via hook.
  Hooks são snapshots de leitura. Pedido misto tem prova unitária, não screenshot de
  serviço misto. Fixtures de save/restaurante/grill **não** provam campanha avançada natural.
- **24 PNGs /244 sprites**, novos20–24 em `prototype/shots/` (ignorados/regeneráveis via
  `npm run check-shots`). Fluxo/progresso/capacidade inspecionados visualmente.
  FTUE:16,1s primeiro PERFEITO;32,9s conclusão;38,3s upgrade;0 erros de interação.

## Contratos, economia e limites

- `check-vectors`: **106 +44 byte-idênticos**, não regenerados. Os turnos golden do bot
  continuam preparando no mesmo tick e sem concorrência prep; não medem lotação humana.
  As regressões novas protegem a semântica não exercitada nesses vetores.
- `gen-levels` executado, diff vazio (`levels-check.log`); nenhum schema, tabela de gameplay,
  Assets/Data, save, arte ou arquivo C# alterado. C# permanece139 checks/25 casos não portados
  conforme CI da base; **não foi executado localmente**. Nova CI ainda não executada.
- `green-long.log` **inteiramente idêntico** a `baseline-long.log`, incluindo curva skill.
  1.500 turnos, renda22.233.557, gasto10.873.220, saldo11.360.337; perfect75,7%, burned0,2%,
  perdidos3,5%, duração172,5s. **15/18, exit1**: rede883 vs950–1450; rendaL50=192.223 vs
  98.000–152.000; spend0,489 vs0,70–0,99. Nenhum tuning/limite relaxado.
- Prep agora consome tábua, mas isso não resolve a auditoria global de upgrades/loja/bot,
  nem a economia. `auxiliar/autoPrepLevel` segue sem consumidor. Descrições/gating de
  upgrades, demais no-ops e benefício marginal simulado pertencem a A-06/F5.
- Sem projeto Unity, device QA, nova arte, SDKs ou dependências atualizadas.

**Próximo checkpoint: A-04.** Confirmar decisão do dono sobre manter quatro zonas antes de
alterar dados/runtime/UI. Depois A-05/A-06/F4; não antecipar C# nem declarar economia aprovada.
