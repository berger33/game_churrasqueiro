# 23 · Progressão: 10 churrasqueiras, 10 telas, 3 carvões

O dono pediu a escada de conteúdo redesenhada **antes** do lote de arte: dez churrasqueiras diferentes,
dez telas e três tipos de carvão, com foco em progressão, dinâmica e retenção. Este documento é a
fonte da escada; a régua de arte que ela usa já existia (docs/22 §6.8) e é ela que torna degraus novos
baratos — o leito é derivado de `zoneCount × slotsPerZone`, então nenhuma grelha nova pede código novo
na esteira de arte.

**Estado do lote de arte:** segurado. `art/lote-05*.json` e `art/lote-06.json` continuam `pending`; o
runtime permanece nos 125 sprites aprovados (`build-runtime.mjs --dry-run` é o modo deste período — sem
`--dry-run` ele reconstrói o atlas em serviço e já destruiu 6 sprites uma vez). Nada é aprovado nem
embarcado enquanto a escada mudar.

---

## 1. As leis da escada

Quatro regras, todas cobradas por máquina — uma escada sem porta é só um buraco com degraus:

| # | Lei | Onde é cobrada |
|---|-----|----------------|
| 1 | Capacidade (`zoneCount × slotsPerZone`) **nunca diminui** degrau a degrau, nos 30 degraus globais | `check-grill-geometry` (imprime a escada e `monótona: sim/não`) + `validate-data` + teste em `churrasqueira.test.ts` |
| 2 | `heatBase` **nunca recua** — comprar grelha nova nunca esfria a brasa | `validate-data` (por grelha e na sequência global) |
| 3 | `charcoalBonus` só recua quando a **capacidade sobe** (corpo pequeno segura menos brasa; quem compra vaga está pagando por vaga, não por duração) | `validate-data` |
| 4 | **Nenhum degrau pode ser igual ou pior em tudo**: se o preço sobe, ao menos um eixo melhora | `validate-data` |

A lei 1 é o que deixa inserir grelhas entre as existentes sem invalidar a arte já aprovada: uma grelha
nova **começa no valor em que a anterior terminou** e **termina no valor em que a próxima começa**. Foi
essa lei que derrubou a primeira versão desta escada no `assert` — eu tinha colocado `6,6,8` antes de
`6,6,9`, o que tirava três vagas do jogador no degrau seguinte. Não se "melhora" uma grelha existente
para abrir espaço: isso quebraria arte aprovada (`lata` e1–e3, `fornalha` e1) e as notas de pacing
medidas.

Onde a capacidade repete (4,4,4 · 6,6,6 · 9,9,9 · 12,12,12 · 16,16,16 · 20,20,20), o degrau **troca de
eixo**: brasa mais longa e formato da grade, não número maior. É isso que faz dez telas de loja serem
dez escolhas em vez de dez números iguais.

Teto estrutural: **4 fileiras e 5 vagas por fileira**. O padrão de arte fecha a boca em `Z×60 ≤ 248 px`
e o leito em 408 px; uma grelha de 5 fileiras obrigaria o conform a engolir a célula mínima de 60 px.
`data.ts` agora cobra 1..4 / 2..5 com esse motivo escrito no comentário, em vez do 1..3 / 2..4 que era
só o eco das quatro grelhas antigas.

## 2. A escada

`shared/data/churrasqueiras.json` (v4, `version: 4`). Custo de evolução ≈ 1,25× e 2,3× o custo de
unlock da grelha; `heatBase` no teto 1,70 (acima disso o ponto ideal desaparece — ver docs/06).

| # | id | destrava | grade e1 → e2 → e3 | `heatBase` | `charcoalBonus` | estilo |
|---|----|----------|--------------------|-----------|-----------------|--------|
| 0 | `lata_valente` | L1 · 0 | 1×2 → 1×3 → 1×3 | 0,65 / 0,82 / 0,95 | 0 / 0,08 / 0,15 | lata |
| 1 | `grelha_de_praca` | L3 · 420 | 2×2 → 2×2 → 2×2 | 0,95 / 0,96 / 0,97 | 0,10 / 0,11 / 0,12 | chapa (dobrável, rodas) |
| 2 | `ze_da_esquina` | L4 · 900 | 2×2 → 2×2 → 2×3 | 0,97 / 1,05 / 1,15 | 0,13 / 0,19 / 0,23 | chapa + toldo |
| 3 | `espeto_do_neno` | L6 · 1 600 | 2×3 → 2×3 → 2×3 | 1,15 / 1,16 / 1,17 | 0,24 / 0,25 / 0,26 | **espeto** (rotisseria) |
| 4 | `parrilla_chef_cisma` | L8 · 3 200 | 3×2 → 3×2 → 3×3 | 1,17 / 1,28 / 1,38 | 0,27 / 0,29 / 0,31 | inox |
| 5 | `tambor_vertical` | L11 · 5 200 | 3×3 → 3×3 → 3×3 | 1,39 / 1,40 / 1,41 | 0,32 / 0,33 / 0,34 | **tambor** (aço em pé) |
| 6 | `fornalha_dragao_manso` | L14 · 8 500 | 3×3 → 3×3 → 3×4 | 1,42 / 1,52 / 1,62 | 0,35 / 0,39 / 0,43 | fornalha |
| 7 | `parrilla_do_cais` | L26 · 48 000 | 4×3 → 4×3 → 4×4 | 1,63 / 1,64 / 1,65 | 0,44 / 0,46 / 0,48 | inox de bancada |
| 8 | `fornalha_da_orla` | L36 · 84 000 | 4×4 → 4×4 → 4×5 | 1,66 / 1,68 / 1,69 | 0,50 / 0,52 / 0,54 | fornalha de duas bocas |
| 9 | `cozinha_do_campeao` | L46 · 150 000 | 4×5 → 4×5 → 4×5 | 1,70 / 1,70 / 1,70 | 0,56 / 0,60 / 0,66 | **campeao** (ilha de chef) |

As quatro grelhas existentes mantiveram grade, estilo e identidade — o que mudou nelas foi `heatBase`
/ `charcoalBonus` de um ponto (para a escada não recuar) e os textos, que continuam prometendo o grid
real (a regra "N fileiras, M espetos" do `validate-data` não deixa mentir).

Retenção, em termos do que o jogador vê: no primeiro dia a meta seguinte está a **2–3 níveis** de
distância em vez de 4–7; são 30 micro-metas (30 evoluções) no lugar de 12; e o topo não é um número
maior, é outro caráter de brasa (espeto gira, tambor segura calor, fornalha ruge).

## 3. Medido, não opinado

`npm run sim:long` (LONG_HORIZON=1500), política gulosa padrão, depois da escada nova:

```
turno em que cada churrasqueira foi comprada:
  grelha_de_praca 3 · ze_da_esquina 7 · espeto_do_neno 19 · parrilla_chef_cisma 50
  tambor_vertical 61 · fornalha_dragao_manso 95 · parrilla_do_cais 184
  fornalha_da_orla 309 · cozinha_do_campeao 509
telas: 32 · 91 · 148 · 248 · 474 · 1328        nível final 80 · restaurante final 6
all 24 balance targets met
```

Antes havia **três** compras de grelha (turnos 7 / 45 / 90) e depois disso nada de grelha para
almejar; agora são nove, distribuídas de 3 a 509. O custo total da escada é 1 390 240 moedas — 9,7 %
dos 14,4 milhões ganhos no run. Isso é intencional: **no topo, o portão é o nível e a tela, não a
moeda** (renda medida 8–12 mil moedas/turno nos tiers 4–6; uma grelha de 1,4 milhão engolia o
horizonte inteiro e o `rede_nacional` parava de ser comprado — foi o que aconteceu na primeira
tentativa, e o `unlock:rede_nacional` virou FAIL).

As bandas de `economy.json.targets.churrasqueiraUnlockPacingTurns` agora cobrem as nove compras, com
janela larga de propósito:

```
grelha_de_praca 2-7 · ze_da_esquina 4-12 · espeto_do_neno 12-32 · parrilla_chef_cisma 32-62
tambor_vertical 42-90 · fornalha_dragao_manso 70-120 · parrilla_do_cais 140-260
fornalha_da_orla 240-430 · cozinha_do_campeao 390-720
```

Correção de instrumentação que essas bandas exigiram: `run-sim.ts` decidia "esse check precisa de run
longo" por uma **lista à mão**. Qualquer conteúdo novo fora dela virava FAIL injusto. Agora quem decide
é a própria banda (`horizon < fim_da_banda` → pulado), para as duas tabelas de pacing.

FTUE não se moveu: primeiro PERFEITO em **16,1 s**, turno completo em **32,9 s**, upgrade em **38,3 s**,
0 misses — e os 98 + 44 vetores dourados continuam idênticos (só a *entrada* de um vetor de economia
incorpora o tamanho novo do array de idle; ver §6).

## 4. Os três carvões

`shared/data/grill.json.charcoal.types`. Cada tipo troca **tempo por temperatura** e cobra na recarga:

| id | nome | `durationMult` | `heatMult` | recarga | libera | leitura |
|----|------|----------------|-----------|---------|--------|---------|
| `comum` | Carvão Comum | 1,00 | 1,00 | grátis | L1 | o jogo de hoje, bit a bit |
| `vegetal` | Carvão Vegetal Selecionado | 1,35 | 0,97 | 18 | L6 | 35 % mais brasa, fogo mais brando — alívio no sol forte |
| `briquete` | Briquete de Coco | 1,15 | 1,10 | 46 | L12 | mais quente e mais curto — empurra o ponto para cima |

Por que `comum` é exatamente 1,00/1,00 e recarga grátis: é o default do save e o caminho do FTUE. Com
esse tipo equipado, `sampleCurve(t) × 1,00` e `duração × 1,00` são identidades em ponto flutuante,
então **nenhum vetor dourado andou** por causa do recurso novo — foi a condição que impus ao desenho, e
o `check-vectors` confirma.

Como entra no motor (dois pontos, nenhum outro lugar):

- `tickGrill` avança `charcoalT` com `stats.charcoalDurationSec × charcoalDurationMult` e fixa
  `charcoalEfficiency = sampleCurve(curva, t) × charcoalHeatMult`. Como `effectiveHeat` já multiplica
  por `charcoalEfficiency`, o efeito se espalha por cocção, HUD e o estimador da política sem tocar em
  mais nada.
- O multiplicador é carimbado **depois** de `deriveStats` e `applyChurrasqueiraToStats` conversarem
  (`applyCharcoalTypeToStats`, em `turn.ts`), porque `applyChurrasqueiraToStats` retro-deriva o bônus de
  restaurante+upgrade a partir da duração; multiplicar antes contaminaria essa conta.

Preço e travas:

- A recarga cobra na **bolsa do próprio turno** (`TurnSimulation.charcoalSpend`). Se não houver moeda
  no turno, a recarga sai do fundo de cozinha e é grátis — escolher carvão nunca trava o loop nem quebra
  quem está sem moeda.
- `applyTurnResult` lança o gasto como `coinsSpentTotal` / `coinsSpentSession` / `charcoalSpendTotal` e
  registra o ganho em bruto, para a banda `coinSpendRatio` continuar medindo a mesma coisa.
- Preço é afiado por regra: o tipo mais caro tem de custar mais, cada tipo melhora ao menos um eixo
  sobre o anterior, nenhum eixo cai mais de 15 %, e o custo de recarga não pode passar de 35 % da renda
  de um turno no nível em que o tipo destrava (senão é taxa, não escolha).

Estado e UI: `player.charcoalType` é novo no save (**v3 → v4**, migração põe `comum` e não muda o
ritmo de ninguém). No protótipo, o tipo equipado aparece no medidor de brasa durante o turno
(`Carvão · Briquete · 46`) e o chip no canto inferior direito do cartão da grelha em casa agora **abre
um modal** com os três tipos, um por linha: nome, descrição, e os três números que importam medidos no
motor *desta* grelha — `203s` de brasa (base × bônus da evolução × `durationMult`, o mesmo cálculo de
`tickGrill`), `calor +10 %` e `46/recarga`. Bloqueado mostra `Libera no nível N` por cima da linha, sem
esconder o que a pessoa estaria perdendo. O cartão não ganhou linha própria porque `homeUpgradeRect`
ancora a mão do FTUE ali, e o modal evita a colisão de chips que a régua de 350..512 px já tinha medido.
Cada troca emite `charcoal_select` (`charcoal_type`, `player_level`, `refill_cost_coins`,
`duration_mult`, `heat_mult`) — o evento saiu como `charcoal_select`, não `charcoal_type`, porque o que
se quer no funil é a decisão, não o estado. Verificado de verdade: `CHURR_SHOT=charcoal` no
`prototype/shoot.mjs` entra na garagem, toca o chip, afirma `__churrascoHome.charcoalOpen`, mede que o
painel cabe em 420×780 e que o × fecha — e escreve o quadro em `prototype/shots/99-charcoal-panel.png`.

## 5. O que isso cobra da arte (por isso o lote está segurado)

- **30 sprites de grelha** (10 × 3), não 12. Os 3 estilos novos (`espeto`, `tambor`, `campeao`) precisam
  de corpo em `STYLE_BODIES` de `tools/art/make-ref.mjs`; os guias continuam sendo gerados **a partir dos
  dados**, então `make-ref.mjs guide <out> 1408 --grill <id> --evo <n>` já sabe a boca de cada degrau —
  foi a decisão certa de ter posto a régua em dado.
- **10 fundos de tela** (7 existentes + cais, orla, campeão).
- A régua continua a mesma: boca nivelada (`|inclinação| ≤ 12°`), célula ≥ `min(procCellW, 86) × 60`,
  boca ≤ 248 px, escada monótona, conform com teto de ±70 %. O portão aceita `pending` sem medir e só
  abre a medição com `--all`; continuar assim. Desde a decisão abaixo, `grill-geometry` também devolve
  `bedKind` e o `check-grill-geometry` imprime `⌗células` / `—aberto` em cada linha, para o tipo de leito
  ser lido na folha de medição e não deduzido do humor de quem olha.
- **A célula do topo, decidido (2026-09-26, por delegação explícita do dono — "tome a melhor decisão
  para o jogo").** Medido com `maxBedWidthOnScreen = 408`: a vaga pintada tem 119 px com 2 espetos, 86 px
  com 3, **73 px com 4, 59 px com 5, 49 px com 6**, contra um prato de 86 px. O problema, portanto, nunca
  foi só do `4×5`: `ze_da_esquina e3` (6 por fileira) e qualquer grelha de 4+ já viviam com célula menor
  que o prato — e as três saídas postadas só empurrariam o limite (subir o leito para 598 px é um leito
  mais largo que a tela de 420 px; escalar `foodDisplayWidth` por célula é o motor fazendo o que ele já
  faz, via `slotX`). A regra passa a dizer o que a aritmética já dizia: **`slotsPerZone ≤ 3` pinta leito
  de células e o gate exige prato por célula pelo nome; `≥ 4` pinta leito aberto** (brasa contínua, sem
  divisórias pintadas), e quem reparte a comida é o motor. O limite vai para dado —
  `grill.json.art.paintedCellsMaxSlots = 3` — porque limite de arte mora em dado, e vai para o prompt do
  lote porque é daí que o modelo sabe se desenha grades ou brasas. Consequência verificada: as 12 grelhas
  aprovadas passam as duas leituras sem nenhuma mudança de arte (a menor célula aprovada em `cells` é
  exatamente 86 px), e as duas que ainda falham (`ze_da_esquina e3`, faixa de 19 px; `parrilla_chef_cisma
  e3`, 35 px) estão no montete de `pende` por *altura*, não por largura — a decisão não salvou nem condenou
  ninguém. No protótipo nada disso aparece: lá o espaçamento vem de `usable = W − 110` em pixels de tela.

## 6. Pendências abertas por esta mudança

1. ~~**Portar os multiplicadores de carvão para o C#**~~ — **feito**: `DerivedStats.Charcoal{Duration,
   Heat}Mult` com inicializador `= 1` (o hazard era exatamente esse: `double` default 0 zeraria a
   duração da brasa e todo vetor dourado reproduziria um turno com o fogo apagado), o consumo em
   `TickGrill` e o preço em `TurnSimulation.RefillCharcoal`. Vieram junto com `TurnSimulation.cs` +
   `SkillPolicy.cs`, que fecharam os 12 vetores de turno (`check-csharp`: 150 → 162 checks concordando,
   `golden.turns` sem um único "not ported") — os turnos reproduzem a conta *com* carvão e sem pagar
   nada a mais, que é a prova de que `comum` ainda é o jogo de antes. O que sobrou da fila:
   `EconomyRules.ApplyTurnResult` (bolsa do turno → meta, com `charcoalSpend` no ledger) e
   `SaveSystem.cs` v4 (`progress.charcoalType`), ambos em docs/18 §7.2.
2. ~~**Seletor completo na garagem** (3 chips com preço, estado bloqueado e descrição) + evento de
   analytics para a escolha~~ — **feito**: modal de três linhas aberto pelo chip do cartão, números do
   motor por linha, `charcoal_select` na taxonomia (49 eventos) e o quadro verificado por
   `CHURR_SHOT=charcoal`.
3. `levels.json` continua cobrindo as telas 0–1 (`gen-levels [[0,24],[1,36]]`): as telas novas usam a
   curva de XP até `xp.maxLevel 80` contra `requiredLevel` 64 / 70 / 76 — alcançável sem reescrever os
   60 níveis autorados, o FTUE medido e os vetores. É escolha de conteúdo, não de engine.
4. As telas 7–9 estão **além do horizonte medido** (1500 turnos): o run termina com 2,1 milhões e a
   primeira delas custa 6,5 milhões. Elas existem para o endgame junto de coleção/prestígio; o vão do
   meio do jogo foi tratado pela escada de grelhas, que é o que o jogador compra toda sessão.
5. en-US / es-419 caíram para 8,8 % de cobertura por mérito do pt-BR ter crescido (615 chaves).
6. `check-art-registry` no `set-status.mjs` continua planejado e não feito (recusar aprovar grelha fora
   do padrão antes de o dono decidir).
7. Os três `redo` do lote 04 (`spr_food_maminha_served`, e as duas grelhas de aço) só voltam por nova
   geração, com prompt novo gravado antes — e agora eles são 3 de um lote de 30, o que é argumento para
   gerar a escada inteira de uma vez quando o dono destravar a arte.

## 7. Como medir de novo

```bash
npm run validate                      # leis da escada, carvões, refs de texto
npm run sim                           # gate curto (60 turnos) — o que roda no CI
npm run sim:long                      # 1500 turnos: pacing das 10 grelhas e 10 telas
npm run check-vectors                 # prova que o caminho `comum` não andou
npm run check-grill-geometry          # grelhas em runtime aprovadas + a escada
node tools/art/check-grill-geometry.mjs --all   # medição completa, incluindo `pending`
npm run typecheck && npx vitest run   # 230 testes
```
