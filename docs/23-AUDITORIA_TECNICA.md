# 23 — Auditoria Técnica: bugs, erros e inconsistências

**Data:** 2026-09-26 · branch `arena/01a0def2-game-churrasqueiro` · base `f094b7d` (`main`)
**Escopo:** todo o repositório — regras de referência (`tools/sim-core`), dados (`shared/data`), protótipo (`prototype/`), ferramentas e gates (`tools/studio`, `tools/csharp`), porta C# (`Assets/Scripts`), documentação e materiais de loja.
**Método:** (1) execução de todos os gates locais; (2) leitura linha a linha das regras, dados e do protótipo; (3) scripts de confirmação empírica (trechos reproduzíveis na seção 8). Nenhum código foi alterado por esta auditoria — só este documento e sua linha no README.

> Resumo em uma frase: **os 13 gates que rodam aqui passam, mas eles medem o que foi codificado, não o que foi projetado.** Há regras cujo efeito é nulo, dados que o runtime nunca lê, e alguns bugs de contagem/idempotência que hoje estão latentes porque ninguém consome o resultado.

---

## 1. Baseline (o que roda e o que não roda)

| Gate (`npm run …`) | Resultado | Observação |
|---|---|---|
| `typecheck` | ✅ | `tsc --noEmit`, strict |
| `validate` | ✅ | 22 tabelas, 16 ingredientes, 11 clientes, 7 restaurantes, 27 trilhas, 58 conquistas, 60 níveis |
| `check-schema`, `verify-schemas` | ✅ | |
| `check-l10n` | ✅ | **mas en-US/es-419 têm só 54/514 chaves (10,5 %)** — passa por fallback pt-BR (item D-06) |
| `check-csharp-types`, `verify-data-sync` | ✅ | 13 arquivos `.g.cs` e `Assets/Data` em sincronia |
| `test` (vitest) | ✅ | 13 arquivos / 202 testes |
| `sim` | ✅ | 18 alvos de economia atendidos (ver item B-03/D-01 sobre *como* são atendidos) |
| `check-vectors` | ✅ | 98 vetores + 44 FTUE inalterados |
| `check-art`, `check-render`, `check-shots` | ✅ | 144 draws pintados; 13 PNGs |
| `gen-levels` + diff | ✅ | `levels.json` está em sincronia com o gerador |
| `check-csharp` | ⚠️ **não executável aqui** | exige .NET 8 SDK; sandbox sem rede/root. `Rules.cs`, `GameData.cs`, `Analytics.cs`, `Tutorial.cs` foram conferidos **por leitura** contra os `.ts` |

Ambiente: Node v22.22.3, npm 10.9.8. Árvore limpa antes e depois (os gates que escrevem em `prototype/dist|shots` estão no `.gitignore`).

---

## 2. Sumário executivo

**Achados: 47** — 🔴 9 altos · 🟠 19 médios · 🟡 19 baixos.

Os nove que mais importam, em ordem de impacto no jogo:

| # | Achado | Onde |
|---|---|---|
| A-01 | **Costela e cupim são impossíveis de acertar sem virar, mas a tabela diz `flipNeeded:false`.** Sem virada, o item vai de *cru* direto para *queimado* (overall 0,672 < limite 0,68). O bot de referência respeita `flipNeeded` e por isso **todas as metas de economia dos restaurantes 3–6 foram medidas com os cortes premium falhando sempre.** | `ingredients.json`, `policy.ts:111`, `cooking.ts:341–350` |
| A-02 | **`unlock.level` dos ingredientes nunca é aplicado.** No nível 1, restaurante 0, os clientes pedem queijo coalho (nível 6) 16 %, legumes (nível 10) 15 %, fraldinha (nível 14) 11 %. Contradiz `docs/02` §11 e a progressão "um ingrediente por vez". | `turn.ts spawnCustomer`, `ingredients.json` |
| A-03 | **Protótipo: pedidos de vinagrete não podem ser concluídos.** A bancada só mostra itens de grelha; não existe fluxo de *prep*. Com as seeds do protótipo, 11,8 % dos clientes do restaurante 0 e 13,7 % do restaurante 1 pedem vinagrete → cliente perdido, combo quebrado, 3ª estrela inalcançável quando ≥ 2 aparecem no turno. | `prototype/src/main.ts:531–534` |
| A-04 | **Zona 4 não existe no runtime.** `restaurants.json` declara `zoneCount: 4` (idx 4–6) e `introduces: zone_4`; `grill.json` só define 3 zonas e `createGrill` clampa → `zones.length === 3` nos 7 restaurantes. | `restaurants.json`, `cooking.ts createGrill` |
| A-05 | **VIP está morto.** `weight: 0`, `vipChance` (gerado em `levels.json`, tipado em `turn.ts:60`) nunca é lido, `spawnCustomer('vip')` só em teste. Ainda assim há `introduces: vip`, `sfx_vip_arrive.wav`, conquistas `vipServed`, `events.json vipBaseChance` e a ficha da loja promete "VIP que paga muito". | `customers.json`, `turn.ts`, `store-assets/listing/full-ptBR.txt` |
| A-06 | **14 das 27 trilhas de upgrade não fazem nada** (stat calculado e nunca lido, ou nem calculado). `run-sim.ts` compra todas por `UPGRADE_PRIORITY`, então o alvo `coinSpendRatio` é atingido queimando moedas em no-ops. | `cooking.ts deriveStats`, `upgrades.json`, `run-sim.ts` |
| A-07 | **`restaurantsUnlocked` acumula em vez de setar** (`addCounter(p,'restaurantsUnlocked', index+1)`): sequência 2, 5, 9, 14, 20, 27. A conquista `restaurant_5` (40 000 moedas + 50 brasas) dispararia no 3º restaurante e `restaurant_7` (200 000 + 150 brasas + coroa) no 4º. | `economy.ts:162` |
| A-08 | **`burnedFood` conta em dobro** quando um prato queima na grelha e depois é servido (1 na grelha + 1 no `serve`). Infla `burnedRate` do simulador e os vetores dourados. | `turn.ts:337` e `:370` |
| A-09 | **`TurnSimulation.result()` não é idempotente:** cada chamada soma o bônus de fim de turno de novo (745 → 842 moedas na 2ª chamada). Hoje todos os chamadores chamam uma vez — armadilha latente para a porta Unity. | `turn.ts:501` |

---

## 3. Tabela completa

Severidade: 🔴 afeta regra/economia/contrato ou promessa ao jogador · 🟠 comportamento errado mas contido, ou drift dado↔código↔doc · 🟡 dead code, duplicação, cosmético.

| ID | Sev | Área | Título |
|---|---|---|---|
| A-01 | 🔴 | Regras/Dados | Costela e cupim inalcançáveis sem virar (`flipNeeded:false` + `sides:2`) |
| A-02 | 🔴 | Regras/Dados | `unlock.level` de ingrediente nunca aplicado |
| A-03 | 🔴 | Protótipo | Pedidos de vinagrete (prep) impossíveis de concluir |
| A-04 | 🔴 | Dados/Regras | Zona 4 declarada, nunca criada |
| A-05 | 🔴 | Dados/Regras/Loja | VIP não aparece em jogo, mas é prometido |
| A-06 | 🔴 | Regras/Dados | 14 trilhas de upgrade sem efeito |
| A-07 | 🔴 | Regras | `restaurantsUnlocked` acumula |
| A-08 | 🔴 | Regras | `burnedFood` dobrado |
| A-09 | 🔴 | Regras | `result()` não idempotente |
| A-10 | 🟠 | Regras | `refillCharcoal()` nunca cobra `refillCostCoins` |
| A-11 | 🟠 | Regras | `evolveChurrasqueira()` gasta brasas sem contador/ledger |
| A-12 | 🟠 | Regras | `computeOfflineEarnings`: `gerente` sem clamp de `maxLevel`; código morto |
| A-13 | 🟠 | Regras | `deriveStats`: expressões sem sentido, `auto*Level` sem clamp |
| A-14 | 🟠 | Regras | `stageOf()` ignora `burned` em itens com `stageOverrides` |
| A-15 | 🟠 | Regras | Bot de referência vaza itens (7 800 spawns para 19 cozidos) |
| A-16 | 🟡 | Regras | `startCharcoalRefill/charcoalRefillDuration` sem uso; hack `1e-6` em `Rules.cs` |
| A-17 | 🟡 | Regras | `policy.ts`: `push()` morto, `reactionSec`/`latency` duplicados, `perfectOnly` sem uso |
| A-18 | 🟡 | Regras | `spawnCustomer` — `forcedId` inválido cai em `pool[0]`; pico medido antes da expiração |
| A-19 | 🟠 | Regras/Doc | Streak: doc diz "dia de graça não avança", código avança; reset não volta ao dia 1 |
| A-20 | 🟡 | Regras | `serializeSave` quebra com `undefined` no estado |
| B-01 | 🟠 | Dados | Campos declarados e nunca lidos: `speedBonusWindow`, `roundCoinMultiplierRange`, `streakBonusPerCycle`, `minCollectIntervalMin`, `adDoubleAvailable`, `refillCostCoins`, `burnRate`, `vipChance`, `heatStability` |
| B-02 | 🟠 | Dados | Upgrades sem gating: `employees.json` diz "garçom no restaurante 1, gerente no 4"; `canAfford` só olha preço |
| B-03 | 🟠 | Dados/Doc | Idle começa no restaurante 1 (`coinsPerMinuteByRestaurant[1]=6`) mas `introduces: idle_offline` está no 3 |
| B-04 | 🟠 | Dados/l10n | Texto de upgrade descreve efeito diferente do `effect.stat` (6 trilhas) |
| B-05 | 🟡 | Dados/l10n | Descrições de evolução do `chef_cisma` com contagem de espetos errada |
| B-06 | 🟡 | Dados | `shortName`/`humorTag`/`abilities[].effect` — texto literal em tabela, sem acento, sem uso |
| B-07 | 🟡 | Dados/IAP | Produtos `brasa.coins.*` entregam **brasas**, não moedas (id imutável no Play Console) |
| B-08 | 🟡 | Dados | `achievements.json`/`missions.json` referenciam stats que ninguém produz; sem avaliador |
| B-09 | 🟡 | Dados | `queijo_coalho.region = nordeste`, `costela.region = sul` — consistente com `regions.json` (ok), mas `regional_ingredients` do festival não tem regra |
| C-01 | 🟠 | Protótipo | Streak diário: `graceUsed` nunca volta a `false`; gap ≥ 2 dias não reseta; streak por login ≠ por resgate |
| C-02 | 🟠 | Protótipo | Ganhos offline falsos (`mins*(6+level*2.2)`) até no restaurante 0 |
| C-03 | 🟠 | Protótipo | Level-up não paga `levelUpCoins`/brasas (diverge de `applyTurnResult`) |
| C-04 | 🟡 | Protótipo | Fórmula de XP e `DAILY_REWARDS` duplicadas (hoje iguais, drift garantido) |
| C-05 | 🟡 | Protótipo | Baú do dia 7 = `+500` fixo; roleta "Chest"/"Booster" não entregam nada; `buyUpgrade` ignora `track.currency` |
| C-06 | 🟡 | Protótipo | Strings pt-BR literais (`'Moedas insuficientes'`, `'QUEIMADO'`, …) fora do l10n; bancada `.slice(0,8)` |
| C-07 | 🟡 | Protótipo | `dev-server.mjs` só observa `src/main.ts`; `readFile` em diretório → 500 |
| D-01 | 🟠 | Ferramentas | `measureSkillCurve` roda na grelha padrão de 3 zonas; `simulateProgression` na `lata_valente` de 1 zona |
| D-02 | 🟠 | Ferramentas | `targets.sessionLengthMinutes` e `noUpgradeCostRegression` nunca verificados |
| D-03 | 🟡 | Ferramentas | `validate-data.ts` valida a saída do gerador, não o `levels.json` commitado; acentos só em 8/22 tabelas; `void validateDatabase` |
| D-04 | 🟡 | Ferramentas | `validate-data` não checa nomes de stat de conquistas/missões |
| D-05 | 🟡 | Ferramentas | `check-csharp` é o único gate que pode ser pulado silenciosamente sem SDK |
| D-06 | 🟠 | l10n | en-US/es-419 a 10,5 % — gate verde por fallback |
| E-01 | 🟠 | C# | `AdService`: caps e cooldowns hardcoded e diferentes de `ads.json`; cooldown `< 0` nunca bloqueia; `shownToday` nunca zera |
| E-02 | 🟠 | C# | `BillingService.Purchase` concede posse sem loja; `IsNonConsumable` por substring |
| E-03 | 🟡 | C# | `GameData.cs`: doc diz 10 tabelas, carrega 7; `Build()` `<0` vs TS `<=0` |
| E-04 | 🟡 | C# | Nenhum `.cs` foi compilado neste ambiente (ver §1) |
| F-01 | 🟠 | Docs | README: `Packages/`, `ProjectSettings/`, `marketing/`, `Assets/Scripts/Sim/`, `tools/studio/golden.test.ts` não existem |
| F-02 | 🟠 | Docs | `docs/02` tabela de restaurantes: custos 3 500/12 000/70 000/150 000/500 000/2 800 000 vs dados 0/3 500/15 000/67 000/178 000/4 200 000 |
| F-03 | 🟡 | Docs | `docs/02` §10 curva de skill defasada vs `npm run sim`; §4.5 "janela de 4,3 s da costela" pressupõe algo impossível (A-01) |
| F-04 | 🟡 | Docs | README "Not started: art assets, recorded audio" — há 100+ PNG e WAVs gerados |
| F-05 | 🟡 | Docs | `types.ts` e `docs/03` citam `tools/sim-core/golden/` (é `tools/golden/`) |

---

## 4. Regras de referência — `tools/sim-core/src`

### A-01 🔴 Costela e cupim inalcançáveis sem virar

- **Onde:** `shared/data/ingredients.json` (`costela`: `sides:2, flipNeeded:false, perfectWindow [0.76,0.88]`; `cupim`: `[0.78,0.90]`), `shared.carryoverRate = 0.12`, `shared.burnedThreshold = 1.2`; `cooking.ts:341–350` (lado de cima cozinha a `carry`), `cooking.ts:427–437` (`scoreItem`), `policy.ts:111` (`if (ing.flipNeeded && …) a.flip(f)`).
- **Matemática:** sem virar, quando o lado de baixo chega a 1,2 (queima) o de cima está em 0,144 → overall 0,672. Para costela `lo − padding = 0,76 − 0,08 = 0,68`; para cupim 0,70. O item **nunca** sai de `raw` antes de virar `burned`.
- **Evidência (script §8.3, grelha do restaurante 4, zona alta):**
  ```
  costela  no flip    burn@ 18.4s overall@burn 0.673  raw:0.1-18.3s burned:18.4s
  costela  WITH flip  burn@ 25.4s overall@burn 0.969  raw … good:18.6-25.2s perfect:20.5-23.3s
  cupim    no flip    burn@ 21.2s overall@burn 0.672  raw:0.1-21.2s burned:21.2s
  cupim    WITH flip  burn@ 29.3s                     … perfect:24.2-27.4s
  ```
  Turno completo com skill 1,0 no restaurante 4 (script §8.1): `costela {raw:6}`, `cupim {}` (clientes desistem), `picanha {perfect:18, good:3}`.
- **Impacto:** `flipFood` **não** checa `flipNeeded`, então um humano que virar mesmo assim consegue — mas a UI/prompt não vai pedir, e o bot que calibra `docs/06`, `perfectRateAtSkillMid` e as metas L30/L50 nunca vira. As metas dos restaurantes 3–6 foram medidas com os cortes mais caros do jogo valendo `ing.value * 0.35` ou zero.
- **Correção sugerida:** ou `sides: 1` para itens `flipNeeded:false` (cozinha "overall" de verdade), ou remover `flipNeeded:false` e ensinar o bot/UI a virar. Regerar `tools/golden/vectors.json` depois (`npm run gen-vectors`) e reavaliar `npm run sim`.

### A-02 🔴 `unlock.level` de ingrediente nunca aplicado

- **Onde:** `turn.ts spawnCustomer` monta o pool por `unlock.restaurantIndex <= restaurantIndex` (só isso). `unlock.level` aparece apenas em `tools/studio/test/data.test.ts:40`. O simulador nem recebe o nível do jogador.
- **Evidência (script §8.1, 24 níveis do restaurante 0, seeds do protótipo):** queijo_coalho 16,1 % (nível 6), legumes 15,5 % (nível 10), pão de alho 13,4 %, coração 12,9 %, frango 11,8 %, fraldinha 10,8 % (nível 14), linguiça 10,5 %, vinagrete 8,9 %.
- **Impacto:** contradiz `docs/02` §11 ("um ingrediente novo por vez") e a recompensa diária do dia 2 ("ingrediente queijo coalho" — que o jogador já recebe em pedidos desde o primeiro turno). Também deixa o FTUE dependente do `TutorialTurn` para não sortear um item difícil.
- **Correção:** passar `playerLevel` em `TurnConfig` e filtrar por `unlock.level`; adicionar teste.

### A-04 🔴 Zona 4 declarada, nunca criada

- **Onde:** `restaurants.json` idx 4/5/6 `grill.zoneCount: 4` (+ `introduces: zone_4`, `docs/02` l.129 "a fourth zone unlocks at restaurant 5"); `grill.json` define 3 zonas; `createGrill` itera `db.grill.zones` e clampa.
- **Evidência:** script §8.1 — `sim.grill.zones.length` = 3 para os 7 restaurantes.
- **Correção:** ou adicionar a 4ª zona em `grill.json` (com `heatMultiplier`, cor, ids) e fazer `createGrill` respeitar `zoneCount`, ou remover `zoneCount:4`/`zone_4` dos dados e docs.

### A-05 🔴 VIP inexistente em jogo

- **Onde:** `customers.json vip.weight = 0`; `levels.json[].vipChance` (gerado por `gen-levels.ts`) e `turn.ts:60` só tipam; `grep -rn vipChance tools prototype` → nenhum consumidor; `spawnCustomer('vip')` só em `test/turn.test.ts`.
- **Contradições:** `restaurants.json` idx 1 `introduces: vip`; `events.json defaults.vipBaseChance 0.06 / vipMaxPerDay 2` sem consumidor; `ads.json rewardedPlacements.call_vip`; `Assets/Audio/sfx_vip_arrive.wav`; conquistas `vipServed`; ficha da loja "11 tipos de cliente, incluindo VIP que paga muito".
- **Correção:** implementar o evento de chegada (`vipChance`/`vipBaseChance` por turno + placement `call_vip`) ou tirar VIP do que é prometido.

### A-06 🔴 Trilhas de upgrade sem efeito

- **Com efeito real** (lidas por `cooking.ts`/`economy.ts`/`turn.ts`): `grill_size`, `grill_heat`, `grill_speed`, `charcoal_duration`, `knife`, `plates`, `decor`, `patience_charm`, `music`, `capacity`, `lighting`, `sign`, `gerente` (só offline).
- **Sem efeito:** `grill_stability` (`heatStability` nunca lido), `charcoal_quality`, `charcoal_auto`, `board` (`prepSlots` calculado, nunca lido), `counter`, `tray`, `tables`, `garcom`/`auxiliar`/`churrasqueiro`/`caixa` (`auto*Level` calculados, nenhuma automação implementada — `employees.json` descreve 5 habilidades cada), `brasa_mastery`, `clientela_fiel`, `imperio_logistica`.
- **Impacto:** o jogador paga (até 2 500 × 1,85ⁿ) por nada; `run-sim.ts UPGRADE_PRIORITY` compra todas, então `coinSpendRatio` "passa" com dinheiro jogado fora, e o `noUpgradeCostRegression` nem é checado (D-02).
- **Correção:** implementar ou esconder as trilhas (flag `implemented:false` filtrada na loja e no bot) até existirem.

### A-07 🔴 `restaurantsUnlocked` acumula

- **Onde:** `economy.ts:162` `addCounter(p, 'restaurantsUnlocked', index + 1)`.
- **Evidência (script §8.1):** desbloqueando 1→6 em sequência o contador vale 2, 5, 9, 14, 20, 27.
- **Impacto:** `achievements.json restaurant_3/5/7` (alvos 3/5/7) disparariam nos restaurantes 2/3/4 — `restaurant_7` paga 200 000 moedas, 150 brasas e a coroa. Latente só porque não há avaliador (B-08).
- **Correção:** `p.counters.restaurantsUnlocked = index + 1` (ou `addCounter(…, 1)` com base 1).

### A-08 🔴 `burnedFood` dobrado

- **Onde:** `turn.ts:370` (callback `onBurn` do `tickGrill`) e `turn.ts:337` (`serve` com `quality === 'burned'`).
- **Evidência (script §8.1):** deixar queimar e servir o mesmo prato → `burnedFood = 2`.
- **Impacto:** `burnedRate` em `run-sim`/`balance-report` e o campo `counters.burnedFood` dos vetores dourados de turno (`tools/golden/vectors.json`) estão inflados. O bot descarta queimados antes de servir, então o efeito é pequeno no sim, mas no jogo real (servir queimado é comum) dobra.
- **Correção:** contar só em um lugar (o `onBurn`), regerar vetores.

### A-09 🔴 `result()` não idempotente

- **Onde:** `turn.ts:501–` soma `turnEndBonus` em `this.coins` a cada chamada.
- **Evidência (script §8.1):** duas chamadas seguidas → 745 e 842 moedas (turno `level_001`, seed 4242, skill 0,6). Os chamadores atuais (`main.ts:931`, `run-sim.ts:141,316`, `gen-vectors.ts:338`) chamam uma vez cada.
- **Correção:** memoizar (`this.finalResult ??= …`) ou calcular o bônus fora de `this.coins`.

### A-10 🟠 `refillCharcoal()` não cobra

`turn.ts:266` nunca lê `grill.json charcoal.refillCostCoins`. Hoje é 0, então o dado é decorativo — mas qualquer tuning aqui não terá efeito.

### A-11 🟠 `evolveChurrasqueira()` sem contador de brasas

`economy.ts:218–235` debita `p.embers -= step.costEmbers` mas não faz `addCounter('embersSpentTotal')` (o `buyUpgrade` faz em `:144`) e o `LedgerEntry` devolvido é só de moedas — o gasto de brasas some do extrato. Latente: hoje todos os `costEmbers` em `churrasqueiras.json` são 0; no primeiro tuning com brasas, contadores e ledger premium ficam errados.

### A-12 🟠 `computeOfflineEarnings`

`economy.ts:283` `(p.upgradeLevels['caixa'] ? 1 : 1)` (morto), `:293 void nowSec` (parâmetro inútil), `gerenteMult` usa `upgradeLevels['gerente']` sem clamp ao `maxLevel 4`. Evidência (script §8.1, restaurante 3, 8 h ausente): nível 4 → 34 675 moedas; nível 14 (save adulterado ou bug futuro) → 70 963. `minCollectIntervalMin` e `adDoubleAvailable` de `economy.json` não são aplicados.

### A-13 🟠 `deriveStats`

`cooking.ts:38` `Math.floor(get('grill_size') / 1)`; `:53` `Math.floor(get('garcom') > 0 ? 0 : 0) + …` (sempre 0 + churrasqueiro); `auto*Level` sem clamp a `maxLevel`. Nada quebra hoje porque nenhum `auto*` é lido (A-06), mas é código que engana o leitor e a porta C#.

### A-14 🟠 `stageOf()` ignora `burned` com `stageOverrides`

`cooking.ts:152–155` (e `Rules.cs:450–455`, porta fiel): para `pao_de_alho`/`queijo_coalho` o estágio vem só do overall. Um pão com um lado a 1,2 (queimado, `scoreItem → burned`) tem overall ≈ 0,67 → rótulo "crocante"/"dourado". UI e pontuação discordam.

### A-15 🟠 Bot de referência vaza itens

`policy.ts:96–99` faz `a.spawn(ing)` **antes** de saber se há vaga (`pickZoneFast` pode devolver −1); o item fica fora da grelha, `alreadyCooking` continua falso e o bot spawna de novo a cada tick.
Evidência (script §8.2, `lata_valente` 1 zona, restaurante 1): `takeFromStock` chamado 7 800 ×, `foods[]` cresce a 7 779 para 19 itens cozidos; `rawStockPerTurn` nunca é aplicado. Custo de CPU/memória no `sim:long` e nos testes; sem efeito na pontuação.

### A-16 🟡 / A-17 🟡 / A-18 🟡

- `startCharcoalRefill`/`charcoalRefillDuration` (`cooking.ts:302–314`) sem uso em TS; `Rules.cs` os porta com o marcador `1e-6`.
- `policy.ts:240` `push()` morto; `reactionSec` e `latency` são o mesmo valor (`:49–50`); `perfectOnly` (`:52`) nunca lido.
- `turn.ts:541` `forcedId` desconhecido cai em `pool[0]` em silêncio; `:437` pico de pedidos medido antes do loop de expiração.

### A-19 🟠 Streak: doc × código

`docs/08-LIVEOPS.md:88` e o comentário em `save.ts` dizem "dia de graça não avança a sequência"; `resolveDailyClaim` avança (e `save.test.ts:242–248` congela esse comportamento: streak 5 → 6 após um dia perdido). Após reset (`streak = 1`) o `dayIndex` continua de `lastClaimDayIndex + 1` em vez de voltar ao dia 1 — o protótipo faz `lastClaimDay = 0`. Decidir qual é a regra e alinhar doc + teste + protótipo.

### A-20 🟡 `serializeSave`

`stableStringify` emite `undefined` literal e o `JSON.parse(payload)` seguinte lança. Basta um campo opcional indefinido no `SaveGame` para quebrar o save. Sugestão: pular `undefined` no `stableStringify`.

---

## 5. Dados — `shared/data`

### B-01 🟠 Campos sem consumidor

`grep -rn` em `tools/sim-core/src tools/studio prototype/src` (excluindo `types.ts`):
`economy.reward.speedBonusWindow`, `roundCoinMultiplierRange`, `dailyReward.streakBonusPerCycle`, `idle.minCollectIntervalMin`, `idle.adDoubleAvailable`, `grill.charcoal.refillCostCoins`, `ingredients[].burnRate`, `levels[].vipChance`, `restaurants[].grill.heatStability`, `events.defaults.vipBaseChance/vipMaxPerDay`. Tuning nesses campos não muda nada; o schema os aceita.

### B-02 🟠 Upgrades sem gating

`upgrades.json` não tem `unlockRestaurantIndex`/`unlockLevel`; `economy.ts canAfford/buyUpgrade` só comparam preço. `employees.json` diz `garcom` no restaurante 1, `auxiliar` 2, `churrasqueiro`/`caixa` 3, `gerente` 4. Um jogador no quintal pode comprar Gerente (renda offline) no primeiro dia.

### B-03 🟠 Idle no restaurante 1 × "introduces idle_offline" no 3

`economy.json idle.coinsPerMinuteByRestaurant = [0, 6, 16, …]` e `computeOfflineEarnings` só zera para índice 0. `restaurants.json` idx 3 `introduces: idle_offline` e `docs/02` l.191 idem. O protótipo (C-02) ainda mostra renda offline no restaurante 0.

### B-04 🟠 Texto do upgrade ≠ efeito

| Trilha | `effect.stat` | Texto pt-BR promete |
|---|---|---|
| `board` | `prepSlots` | "Organiza os pedidos para ninguém esperar demais" (paciência) |
| `plates` | `tipMult` | "Serve mais clientes antes de lavar a louça" (capacidade) |
| `decor` | `tipMult` | "segura o cliente na mesa" (paciência) |
| `clientela_fiel` | `patienceMult` | "dão gorjetas melhores" (gorjeta) |
| `auxiliar` | `autoPrepLevel` | "Cuida do carvão" |
| `grill_speed` | `heatRampRate` | "Aquece de forma mais estável" (é `grill_stability` que fala de oscilação — e não faz nada) |

### B-05 🟡 Evoluções do `chef_cisma`

`grill.chef_cisma.evo2.desc` "3 fileiras, 7 espetos" → dados `slotsPerZone 2 × zoneCount 3 = 6`; `evo3.desc` "8 espetos" → `3 × 3 = 9`. As outras 10 descrições batem.

### B-06 🟡 Texto literal em tabela

`churrasqueiras.json` `shortName` ("Aprovada pela Vo", "Chapa da Calcada", "Termometro que Nao Mente"…) e `humorTag`, `employees.json abilities[].effect` (inglês) — sem consumidor, sem acento, duplicam o l10n. Viola a regra §56 que o `check-l10n` aplica a outras tabelas; `churrasqueiras.json` não está na lista de acentos do `validate-data`.

### B-07 🟡 IDs de produto

`brasa.coins.small|medium|large.v1` têm `nameKey iap.embers.*` e `contents: embers`. IDs no Play Console são imutáveis — vale renomear **antes** de criar os produtos (e atualizar `.env.example` + `SecureConfig.cs`, que hoje estão consistentes entre si).

### B-08 🟡 Conquistas/missões sem produtor

Não existe avaliador de conquistas/missões. `addFoodCounter` (`economy.ts:111`) nunca é chamado; ninguém produz `category.*`, `vipServed`, `playerLevel`, `employeesHired`, `dailyMissionsComplete`, `loginStreak`, `collectionEntries`, `routeStopsCleared`, `idleCollections`, `eventsCompleted`, `passTiersClaimed`. `validate-data` não valida nomes de stat (D-04), então um typo passa.

---

## 6. Protótipo — `prototype/src/main.ts`

### A-03 🔴 Vinagrete (detalhe)

`main.ts:531–534` monta a bancada só com `cookMethod === 'grill'`; não há `prepProgress`, nem gesto de prep, nem `serve()` para prep. `turn.ts` sorteia vinagrete (`unlock.restaurantIndex 0`, `perfectWindow [0,1]`, `heatRate 0`).
Evidência (script §8.2, seeds do protótipo): restaurante 0 → 32/271 clientes (11,8 %), em 19 dos 24 turnos; restaurante 1 → 75/547 (13,7 %), em 34 de 36 turnos. Como estrelas = servidos/spawnados ≥ 0,9 para 3★, bastam 2 vinagretes num turno de ~12 clientes para a 3ª estrela ficar impossível.

### C-01 🟠 Streak diário

`main.ts:373–388`: (a) `graceUsed = true` nunca volta a `false` num login consecutivo → graça **uma vez por instalação**, não por falha; (b) com `graceUsed` falso, um gap de 30 dias "segura" a sequência; (c) a sequência conta **logins** (`lastLoginISO`) enquanto o dia resgatável conta **resgates** (`lastClaimDay`) — divergem quando se entra sem resgatar; (d) usa dia local, `save.ts` usa `unixDay` UTC.

### C-02 🟠 / C-03 🟠 / C-04 🟡 / C-05 🟡 / C-06 🟡

- `main.ts:391–` popup offline `mins*(6+level*2.2)` com `Math.random()`, inclusive no restaurante 0 e ignorando `computeOfflineEarnings`.
- `finishTurn` (`:930–996`) sobe de nível em loop próprio sem pagar `levelUpCoins` (`100·L^0.85`) nem as 3 brasas a cada 5 níveis que `applyTurnResult` paga.
- `xpForLevel` (`:205`) e `DAILY_REWARDS` (`:214`) hardcoded — iguais a `economy.json` hoje.
- `claimDaily` (`:1306`): dia 7 = `+500` fixo, ingrediente/booster não fazem nada; roleta "Chest"/"Booster" idem; `buyUpgrade` (`:1748`) debita sempre `coins`.
- Strings literais fora do l10n; bancada `.slice(0, 8)` esconde itens além do 8º.

### C-07 🟡 `dev-server.mjs`

O watcher (`:143–153`) só olha `src/main.ts` — editar `audio.ts`, `foods.ts`, `ftue.ts`, `sprites.ts`, `theme.ts` não rebundla. `GET /data/` (diretório) passa no `existsSync` e cai em `EISDIR` → 500. A proteção contra path traversal está correta.

---

## 7. Ferramentas, l10n, C#, docs

### D-01 🟠 Curvas medidas em grelhas diferentes

`run-sim.ts measureSkillCurve` (origem de `perfectRateAtSkillMid`) não passa `churrasqueiraId` → grelha padrão do restaurante (3 zonas), enquanto `simulateProgression` usa a `lata_valente` de 1 zona. O `_grillPacingNote` de `economy.json` descreve o contrário.

### D-02 🟠 Alvos não verificados

`economy.json targets.sessionLengthMinutes` e `noUpgradeCostRegression` não aparecem em `checkTargets`; o relatório diz "18 alvos" e omite que dois são decorativos.

### D-03 🟡 / D-04 🟡 / D-05 🟡

- `validate-data.ts` roda `generateLevels()` e valida **isso**, não o `shared/data/levels.json` commitado (o diff com o gerador não faz parte de nenhum gate — hoje está em sincronia porque eu conferi). Lista de acentos cobre 8/22 tabelas. `void validateDatabase` sobrou.
- Nenhum gate confere `stat` de conquistas/missões contra os contadores realmente produzidos.
- `tools/csharp/check.mjs` dá SKIP sem SDK; no CI o SDK existe, mas localmente é o único gate que pode passar sem rodar.

### D-06 🟠 l10n

`shared/l10n/en-US.json` e `es-419.json`: 54 de 514 chaves. `check-l10n` passa porque exige só o pt-BR completo. Se a intenção é lançar só pt-BR, documentar; se não, o gate esconde 90 % de trabalho.

### E-01 🟠 `AdService.cs`

Cabeçalho diz "100 % config-driven"; corpo hardcoda `>= 6/dia` (ads.json: por placement, 2–6), cooldown `TotalMinutes < 0` (nunca bloqueia), `>= 3` intersticiais, 60 % de probabilidade, 180 s da sessão. `shownToday` não zera na virada do dia. `ShowRewarded` devolve `Dismissed` + token falso. Assumido como stub, mas os comentários prometem outra coisa.

### E-02 🟠 `BillingService.cs`

`Purchase` marca posse com `local_receipt_pending` sem chamar a loja; `IsNonConsumable` decide por substring (`"starter"`, `"noads"`) em vez de `iap.json type`. Comentários em francês misturados.

### E-03 🟡 `GameData.cs`

Doc-comment fala em 10 tabelas, carrega 7; `Build()` rejeita `< 0` onde `data.ts` rejeita `<= 0`. `Rules.cs` ↔ `cooking.ts`: paridade OK por leitura (inclui RoundHalfUp e o `rare`).

### F-01 🟠 README / docs apontam para o que não existe

`README.md:20,23,34–35`: `Packages/`, `ProjectSettings/`, `marketing/` (os assets estão em `store-assets/`), `Assets/Scripts/Sim/` (é `Assets/Scripts/Core/`), `tools/studio/golden.test.ts` (é `tools/studio/test/golden.test.ts`). `types.ts` e `docs/03` citam `tools/sim-core/golden/` (é `tools/golden/`). `docs/18-STATUS.md:288` já admite `Packages/` e `ProjectSettings/` "not yet written" — o README não.

### F-02 🟠 Custos de restaurante

`docs/02` l.188–194 × `restaurants.json`: 3 500→**0**, 12 000→3 500, 70 000→15 000, 150 000→67 000, 500 000→178 000, 2 800 000→4 200 000. O restaurante 1 é **grátis** nos dados (só nível 8). `docs/06` provavelmente foi retunado e `docs/02` não.

### F-03 🟡 / F-04 🟡 / F-05 🟡

- `docs/02` §10 (curva de skill) não bate com `npm run sim`; §4.5 argumenta que a janela da costela "é forgiving" — sem virar ela não existe (A-01).
- `README.md:104` "Not started: 3D/2D art assets, recorded audio" — `Assets/Art` tem 100+ PNG com registro, `Assets/Audio` tem WAVs gerados por `tools/generate-audio-assets.mjs`.
- Caminho de golden errado em `types.ts`/`docs/03`.

---

## 8. Reprodução

Todos os scripts abaixo rodam com `node --experimental-strip-types <arquivo>` a partir da raiz (imports absolutos para não depender do cwd).

### 8.1 Regras (A-01, A-02, A-04, A-07, A-08, A-09, A-12)

```ts
import { loadDatabase } from '/home/user/game_churrasqueiro/tools/studio/load-data.ts';
import { TurnSimulation, SkillPolicy, Rng, unlockRestaurant, newPlayerState, computeOfflineEarnings }
  from '/home/user/game_churrasqueiro/tools/sim-core/src/index.ts';
const db = loadDatabase();

// A-07: contador acumula
const p = newPlayerState(); p.coins = 1e9; p.level = 99;
for (let i = 1; i <= 6; i++) { unlockRestaurant(db, p, i); console.log('restaurantsUnlocked', p.counters.restaurantsUnlocked); }
// → 2, 5, 9, 14, 20, 27

// A-12: gerente sem clamp
for (const lvl of [4, 14]) { p.upgradeLevels = { gerente: lvl }; p.restaurantIndex = 3;
  console.log('gerente', lvl, computeOfflineEarnings(db, p, 8 * 3600, 0).coins); }        // → 34675, 70963

// A-04: zonas por restaurante
for (let r = 0; r < 7; r++) {
  const sim = new TurnSimulation(db, { restaurantIndex: r, levelId: 'level_001', upgradeLevels: {}, seed: 1 }, 1);
  console.log('restaurant', r, 'zones', sim.grill.zones.length);                            // → 3 em todos
}

// A-09: result() duas vezes
const sim = new TurnSimulation(db, { restaurantIndex: 0, levelId: 'level_001', upgradeLevels: {}, seed: 4242 }, 4242);
const pol = new SkillPolicy(new Rng(1), { skill: 0.6 });
while (!sim.finished) sim.tick(1 / 30, (a) => pol.act(a));
console.log(sim.result().coins, sim.result().coins);                                         // → 745, 842
```

Para A-08 basta, num turno manual, deixar um item queimar na grelha e servi-lo: `counters.burnedFood === 2`.
Para A-02, contar `e.customer.lines[].ingredientId` nos eventos `spawn` dos 24 primeiros níveis (config e seeds iguais às do protótipo: `seed: 20260917 + id.length + i`).

### 8.2 Protótipo/bot (A-03, A-15)

Mesma montagem de turno com `churrasqueiraId: 'lata_valente', churrasqueiraLevel: 1`; contar clientes cuja linha inclui `vinagrete` (A-03) e envolver `takeFromStock`/`foods.length` para ver o vazamento (A-15).

### 8.3 Cozimento sem virar (A-01)

```ts
import { loadDatabase } from '/home/user/game_churrasqueiro/tools/studio/load-data.ts';
import { createGrill, createFood, placeOnGrill, tickGrill, scoreItem, rewardTuning, flipFood, overallDoneness, deriveStats }
  from '/home/user/game_churrasqueiro/tools/sim-core/src/cooking.ts';
const db = loadDatabase(); const r = db.restaurants.restaurants[4]!; const stats = deriveStats(db, r, {});
for (const id of ['costela', 'cupim', 'picanha']) for (const flip of [false, true]) {
  const g = createGrill(stats, db); const f = createFood(1, db.ingredientById.get(id)!); placeOnGrill(g, db, f, g.zones.length - 1);
  let t = 0, flipped = false; const seen = new Map<string, [number, number]>();
  while (!f.burned && t < 400) { tickGrill(g, db, 0.05); t += 0.05;
    if (flip && !flipped && (f.sides[f.downSide] ?? 0) >= 0.6) { flipFood(g, f, t, db); flipped = true; }
    const q = scoreItem(db, f, { target: 0, toleranceScale: 1, patienceRemaining: 1, combo: 0, tipMult: 1, xpMult: 1, tuning: rewardTuning(db.economy) }).quality;
    const c = seen.get(q); if (!c) seen.set(q, [t, t]); else c[1] = t; }
  console.log(id, flip ? 'flip' : 'no-flip', 'overall@burn', overallDoneness(f).toFixed(3), [...seen].map(([q, [a, b]]) => `${q}:${a.toFixed(1)}-${b.toFixed(1)}s`).join(' '));
}
```

### 8.4 Greps úteis

```
grep -rn "speedBonusWindow\|roundCoinMultiplierRange\|streakBonusPerCycle\|minCollectIntervalMin\|adDoubleAvailable\|refillCostCoins\|burnRate\|vipChance\|heatStability" tools/sim-core/src tools/studio prototype/src | grep -v types.ts
grep -rn "unlock.level\|\.unlock\.level" tools prototype                      # só test/data.test.ts:40
grep -rn "addFoodCounter\|vipServed\|playerLevel" tools/sim-core/src prototype/src   # sem produtor
grep -n "restaurantsUnlocked" tools/sim-core/src/economy.ts                  # :162
```

---

## 9. Ordem sugerida de correção

1. **Decisões de design primeiro** (afetam vetores e metas): A-01 (`sides` × `flipNeeded`), A-02 (gating por nível), A-04 (zona 4), A-05 (VIP), A-06/B-02 (trilhas sem efeito e sem gating), A-19 (regra do dia de graça).
2. **Bugs mecânicos, baixo risco**: A-07, A-08, A-09, A-10, A-11, A-12/A-13 (limpeza), A-14, A-15, A-20.
3. **Protótipo**: A-03 (prep na bancada ou filtrar vinagrete do pool do protótipo), C-01, C-02, C-03; depois consolidar as duplicações C-04/C-05 lendo `economy.json`.
4. **Gates**: D-01, D-02, D-03 (validar o `levels.json` commitado + diff com o gerador), D-04 (stat names), D-06 (declarar política de idiomas).
5. **Docs/loja**: F-01, F-02 e a ficha (`store-assets/listing/full-ptBR.txt`) — não prometer VIP/4ª zona até existirem.

Depois de 1–2: `npm run gen-vectors && npm run sim && npm run balance-report` e revisar `docs/06`.
