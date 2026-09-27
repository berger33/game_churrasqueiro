# F3 / A-02 — desbloqueio por nível E restaurante

2026-09-26 local / 27 UTC · `arena/01a0e03e-game-churrasqueiro` · PR #14 aberto/sem merge.
Baseline: **223b843**, árvore limpa, fetch/ancestralidade PR13 e PR14 abertos confirmados;
npm ci, 299 testes, gates locais14/15 (C# SKIP), longo15/18 com os 3 desvios de A-01.

**A-02 funcional validado. Economia global continua pendente.** Não houve tuning de
preços, receitas, calor, recompensas, alvos, política de habilidade ou níveis autorais.
Nenhuma arte, porta C# ou Unity. O vinagrete continua elegível no nível12/restaurante0;
A-03 deve implementar a UI de preparo, não apagar a receita para esconder pedidos impossíveis.

## Contrato e chamadores

- **`TurnConfig.playerLevel` obrigatório**, inteiro positivo, separado do `levelId`/índice
  da fase. Ausente, zero, negativo, fracionário, NaN ou infinito: erro explícito.
- Catálogo `availableIngredients` calculado no começo do turno com
  `unlock.restaurantIndex <= restaurante && unlock.level <= playerLevel`; lista congelada.
  Config faz cópia do nível recebido; ganhar XP só libera receitas no próximo turno.
- Pedidos naturais, catálogo do bot, estoque e UI usam esse mesmo conjunto. `takeFromStock`
  resolve o ID no catálogo canônico, rejeita locked/unknown; pedidos roteirizados também
  rejeitam ingredientes bloqueados antes de admitir o cliente. Não há bypass silencioso.
- Clientes `unusualOnly` só entram no sorteio se tiverem receita elegível não comum.
  Pedido forçado sem menu gera erro, não pedido vazio nem fallback para conteúdo bloqueado.
  Config sem qualquer ingrediente elegível também falha explicitamente.
- Sim de progressão passa **p.level antes do payout**, UI passa **meta.level**. O relatório
  agora expõe nível/restaurante reais, catálogo e ingredientes efetivamente pedidos.
- Curva de habilidade inicia um `newPlayerState` **por skill**, acumula XP real com
  `applyTurnResult`, sem compras/upgrades como antes. Não usa índice da fase nem nível44
  para mascarar a correção. Skill é fixa; progressão de receitas acompanha o desempenho.
- FTUE passa **nível1 explícito** e continua com linguiça, seus pedidos, RNG e pausas.
  Validação impede receita de FTUE acima do nível1. Tabela/roteiro FTUE não mudou.
- Fixtures anteriores de **mecânica isolada** usam nível44 explícito para conservar o
  cardápio completo daquele restaurante e isolar sua regra (calor, contagem, idempotência).
  Isso não é default de produção: 50 novas regressões cobrem níveis e limites reais.
- Dados, schemas, cópias Assets/Data, save v3 e tipos C# não mudaram. Validador TS também
  rejeita `ingredient.unlock.level` não inteiro positivo.

## Provas red/green e integração

- **`red-rules.txt`: 50 falhas/50** contra a implementação original, antes de corrigir:
  pedidos iniciais de níveis futuros, estoque não bloqueado/catálogo vazio, cada uma das
  16 receitas antes/no/depois do limite e restaurante insuficiente, ausência de nível,
  snapshot, unusualOnly e bot real. Não são 50 defeitos independentes.
- **`red-wiring.txt`: 2 falhas/2**, teste de sensibilidade substituindo temporariamente
  os níveis reais dos dois chamadores por44 (equivalente ao antigo menu todo liberado).
  Restaurado em finally. Demonstra que um caller com nível artificial não passa despercebido.
  Green compara cada turno com nível derivado do XP acumulado e reproduz a curva separadamente.
- **`red-ui.txt`: falha real do bundle** ao restaurar temporariamente só o filtro antigo
  de bancada por restaurante. O harness tenta pegar `legumes_grelhados` ainda bloqueado:
  a nova regra rejeita, provando a necessidade de alinhar drawing/hitboxes com o catálogo.
  Fonte restaurada em finally; nenhuma mutação de teste ficou no runtime.
- **`red-data.txt`: 1 teste existente fortalecido falha** ao retirar o novo guard de
  `unlock.level` inválido; restaurado em finally, sem enfraquecer schema/validação.
- Final **351/351 testes**, 18 arquivos (299+50+2), gates locais **14/15**, só C# SKIP.
  `sim` curto verde (60 turnos; metas não alcançadas ainda usam o comportamento legado
  PASS/skip, dívida F5). Não substitui o longo.
- `check-shots`: **19 PNGs**, 244 sprites. Novos cenários com save nos níveis1/5/6/7:
  compara catálogo desenhado e pedidos; antigo slot bloqueado não deixa hitbox fantasma;
  queijo aparece/é arrastável exatamente em6 e permanece em7. PNGs18/19 inspecionados.
  São fixtures de save/restaurante/grill para input, **não progressão natural completa**.
- FTUE igual: primeiro perfect **16,1s**, completo **32,9s**, upgrade **38,3s**, zero misses.
  Screenshots avançadas A-01 e os testes de vizinhos/virada continuam passando.

## Revisão semântica dos vetores

`check-vectors` acusou drift só em vectors.json; schemas, tipos C# e cópia dos dados
verificados antes de regenerar. **106+44 casos**, sem adicionar/remover casos nesta etapa.

- Formato **vectors.version1→2**, porque os20 turnos exigem `input.playerLevel` explícito.
- Perfis isolados dos12 turnos autorais: fase001/011/031/060 usa jogador1/4/8/14,
  respectivamente, para cada skill. São fixtures de cobertura, **não inferência automática
  do nível do jogador pela fase**. Os8 avançados usam44 e preservam a cobertura de A-01.
- **9 expectativas mudam**, somente turnos com jogador1/4/8; as3 de jogador14 e todas as8
  avançadas preservam expect inteiro. Cooking48, scoring/flip32 e economy6 idênticos;
  **tutorial-vectors.json byte a byte idêntico**. `dataVersions` intacto.
- Revisão por caso/antes/depois em **`vector-review.json`**, incluindo XP, estrelas e todos
  os contadores. Ex.: moedas skill.55 fase001 **651→300**, fase011 **862→534**, fase031
  **1272→1404**, fase060 **1673→1673**. Retirar receitas caras reduz renda inicial; reduzir
  variedade/complexidade também pode aumentar serviço/renda em alguns cenários — não
  foi imposta queda uniforme. Mudanças de RNG decorrentes do pool são esperadas.
- Replay TS confere cada ingrediente pedido contra ambos limites, além de resultado,
  tempo, contadores e idempotência. C# ainda **25 not ported** (5 economia+20 turnos);
  mudança de entrada deve ser portada em F8, não alegar paridade de turnos agora.
- Probe A-01 reexecutado com nível44 explícito: todas as janelas e agregados de128 turnos
  avançados idênticos ao JSON A-01. Não sobrescrever a evidência histórica de A-01.

## Economia: A-01 → A-02 (1.500 turnos)

Logs íntegros **sim-long-before.txt / sim-long-after.txt**. Mesma seed, dt=1/12, nível final80,
restaurante6, Fornalha evo3. Três desvios persistem; nenhum alvo foi relaxado.

| Métrica | A-01 | A-02 |
|---|---:|---:|
| Renda |22.675.447|22.233.557|
| Gasto |10.873.220|10.873.220|
| Saldo |11.802.227|11.360.337|
| Spend ratio |0,480|**0,489 — FAIL**, mínimo0,70|
| Perfect |75,9%|75,7%|
| Burned/servidos |0,2%|0,2%|
| Clientes perdidos |3,7%|3,5%|
| Duração média |173,4s|172,5s|
| Restaurantes |32/89/147/239/383/859|42/98/165/259/398/**883**|
| Grills |7/45/90|10/45/89|
| Renda diária L5/15/30/50 |10.793/41.115/114.616/182.381|10.480/39.445/108.533/**192.223**|
| Alvos |15/18|**15/18; exit1**|

Falhas restantes: Rede Nacional883 vs950–1450; renda L50 192.223 vs98.000–152.000;
spend0,489 vs0,70–0,99. O início fica mais lento (primeiro restaurante32→42); isso vem da
remoção dos pedidos ainda bloqueados, não de tuning. Métricas não precisam mudar todas
na mesma direção. Gap Festival→Rede485 turnos, ainda sob meta de unlock inadequada.

Curva autoral, skill fixa + XP real a partir do nível1, sem compras:

| Skill | Perfect | Good | Burned | Lost | Moedas/turno |
|---|---:|---:|---:|---:|---:|
|.30|25,0%|75,0%|0,0%|0,9%|430|
|.45|40,1%|59,6%|0,3%|0,4%|546|
|.55|46,0%|54,0%|0,0%|0,2%|571|
|.70|65,7%|34,3%|0,0%|0,2%|659|
|.85|84,9%|15,1%|0,0%|0,0%|709|
|1.00|97,9%|1,9%|0,1%|0,2%|751|

Antes perfect.55=55,7%, renda793; agora46,0%/571. A curva passa o alvo40–62%, sem alteração
do limite; perfect/renda crescem com skill. Ela só cobre restaurantes0/1. O ponto1.0 não
é oracle: mantém jitter/latência/percepção. `progression-sample.json` registra catálogo,
pedidos e XP dos60 primeiros turnos oficiais para inspecionar os desbloqueios.

## Reproduzir e limites

```sh
npm ci
npx vitest run tools/studio/test/ingredient-unlock.test.ts tools/studio/test/unlock-wiring.test.ts
npm run gates
npm run sim:long              # exit1, três alvos econômicos falhos
npm run check-shots           # PNGs18/19 em prototype/shots, ignoradas pelo Git
node --experimental-strip-types tools/studio/slow-cuts-report.ts
```

npm audit: mesmas5 vulnerabilidades (1 crítica,1 alta,3 moderadas), lock/dependências
intactos; sem force-fix. Nightly manual negada pela integração na etapa anterior (403):
o longo continua evidência **local**, sem fingir execução remota. CI A-02 **15/15** em
44ccf11: [run36286427123](https://github.com/berger33/game_churrasqueiro/actions/runs/36286427123), C#139 checks/25 não portados.
Commits8d6fbde (implementação) e44ccf11 (docs); HEAD/CI final no plano §9.12 e PR14. Próximo: **A-03**, fluxo real de prep/vinagrete, preservando os novos
gates de desbloqueio. A-04 ainda precisa da decisão do dono. F3/F4/C#/Unity/merge bloqueados.
