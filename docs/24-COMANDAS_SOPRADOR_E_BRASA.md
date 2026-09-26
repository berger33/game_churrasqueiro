# 24 · Comandas, soprador e a moeda certa

> Estudo. Nada aqui está implementado; nada aqui entra no runtime sem a decisão do dono.
> Instrumento: `tools/studio/probe-monetization.ts` (commitado junto — as tabelas abaixo saem dele,
> não da cabeça de quem escreve).

Três ideias chegaram assim: **comanda** (vídeo → fila e pedidos em dobro por 5 min), **soprador e
garrafa de água** por fileira, e **carvões no lugar de diamantes**, com as moedas virando gorjetas.
A régua da casa é medir antes de decidir, então as três foram jogadas contra o simulador. Duas
sobrevivem mudadas; uma sobrevive quase inteira; e a terceira revela um buraco que não estava na
conversa.

## 0. O que já existe (fatos, conferidos no repositório)

| | estado hoje |
|---|---|
| Moeda premium | **não existe diamante nenhum.** `economy.json.currencies.embers` (`premium: true`), na UI **Brasas** (`ui.hud.embers`, `currency.embers`), vendida em `iap.json` a 4,08 → 3,33 centavos por unidade (`docs/07` §) |
| Pia da moeda premium | **nenhuma.** Torneiras há quatro (level-up, conquistas, diária, passe) + IAP; `buyUpgrade` aceita `currency: "embers"`, mas **toda** track hoje é `coins`, e as evoluções de grelha não têm campo `costEmbers` — a soma de custo em brasas nas 30 evoluções é **0** |
| Boosters | `tip_2x` e `xp_2x` são **concedidos** (pacote inicial ×3, dia 5 da diária, tiers 8 e 28 do passe) e **não fazem nada**: não há `boosters.json`, nem timer, nem leitura no `applyTurnResult`; o protótipo só desenha o ícone na faixa da diária |
| Anúncios | `ads.json.rewardedPlacements` tem 8, incluindo `double_turn` (resultado do turno, 6/dia) e `unburn_plate` (2 min de cooldown, 3/dia); intersticial só entre turno e lobby, com supressão durante o jogo |
| Moeda mole | `coins`, rotulada **"Moedas"** na UI — mas a regra de payout *é* de gorjeta: `orderBaseTip`, `perfectTipBonus`, `speedBonus`, `tipMult`, `customerTipMult` (`docs/06` §8), e a missão diária já diz "Receba 2.000 em gorjetas" |
| Carvão | `grill.json.charcoal.types` = `comum` / `vegetal` / `briquete` (duração × calor, preço de recarga), `ui.hud.charcoal = "Carvão"`, `charcoal.label = "Carvão"`, aviso "Carvão acabando!" |

Ou seja: a terceira ideia mira um problema real (a moeda premium não compra nada) com um nome que já
está ocupado (o jogador ouve "carvão" a toda hora querendo dizer *combustível*), e as duas primeiras
precisam de um sistema que está morto nos dados — o booster.

## 1. Condições da medição

`node --experimental-strip-types tools/studio/probe-monetization.ts` → 24 turnos por caso, grelha
fixa sem upgrade algum (`upgradeLevels: {}` — senão a comparação vira "dois upgrades e meio"), skill
0.55, `STEP = 1/16`, seed `4242 + t·977`, bot = `SkillPolicy` com o `Rng(seed + nível·104729)` dos
vetores dourados. `perf%` = pratos perfeitos / pratos servidos; `queim%` = queimados / pratos tocados
(na grelha um prato queima sem ser servido, então os dois denominadores não podem ser o mesmo).

A banda de renda que o buff atravessa: `npm run sim` mede **105,4 s por turno** e o alvo é
`turnsPerSession [3,5]` com 12 turnos/dia — **5 min de buff são ~2,8 turnos, quase a sessão inteira.**

## 2. Comanda — a fila dobrada é boa, o pedido dobrado é o que quebra

`spawnIntervalSec: 3.75` = chegada 2×; `maxOrdersOnScreen: 6` = +2 pedidos esperando;
`itemsMult: 2` = cada cliente pede o dobro de pratos. Moeda/turno no topo (L46 · `cozinha_do_campeao e3`, 4×5):

| caso | skill 0.55 | Δ | perdido% | ★ |
|---|---|---|---|---|
| baseline | 2 281 | — | 11 | 2,13 |
| chegada 2× | 4 053 | **+78 %** | 13 | 2,00 |
| chegada 2× + 2 vagas | 3 944 | +73 % | 12 | 2,00 |
| chegada 2× + pedido em dobro | 5 775 | +153 % | **18** | **1,58** |
| só pedido em dobro | 3 838 | +68 % | 16 | 1,75 |

E nas outras grelhas, com a chegada 2× sozinha: **L1 466 → 586 (+26 %)**, L8 1 738 → 2 885 (+66 %),
L24 1 884 → 3 223 (+71 %). Quatro leituras que importam:

1. **A grelha é o gargalo, e isso é o melhor que a comanda tem.** Em `lata_valente e1` (1 zona × 2
   vagas) dobrar a chegada rende +26 % porque *não há onde pôr* o resto: o teto é o número de vagas,
   que o próprio motor aplica (`active < maxOrdersOnScreen`). No meio da escada, onde a fila é que é o
   gargalo, o mesmo botão rende +66 a +91 %. Um buff que vende a próxima grelha é melhor para a
   progressão do que um buff que só dá dinheiro.
2. **O que quebra é multiplicar os dois.** "Pedidos em dobro" *junto* com chegada em dobro joga o
   perdido% para 18-24 % e o ★ para 1,4-1,6 (na L1: 6 dos 24 turnos **perdidos**). Dobrar a fila já é
   o dobro do trabalho por cliente; dobrar o pedido *também* é pedir que o jogador faça o triplo com
   as mesmas mãos. A frase "fila *e* pedidos em dobro" não sobrevive medida.
3. **Para quem joga mal, a fila 2× paga igual.** Com skill 0,30 no topo: 1 954 → 3 404 (+74 %) com o
   perdido% praticamente parado (13 → 14). O buff não exige perícia — é o tipo de recompensa de vídeo
   que não humilha quem assiste.
4. **Ela é *melhor* para quem é bom, e isso é bom.** Na L46 o `perf%` subiu de 38 para 44 com a fila
   dobrada (fila cheia = sempre existe um prato no ponto certo para servir). Não é borracha elástica
   para trás: quem domina a grelha aproveita mais a propaganda.

**Custo real na escada.** A banda `dailyCoinIncomeAtLevel` é derivada do simulador **sem** anúncios,
então nada aqui "quebra o gate" — o que anda é a escada do jogador assistido: 2,8 turnos buffados de
12, a +72 % = **+17 % de renda/dia** → as churrasqueiras chegam ~15 % mais cedo, na beira das ±20 % de
`churrasqueiraUnlockPacingTurns`. Com 150 s em vez de 300 s: **+8 %** (1/dia) e **+17 %** (2/dia), e o
"5 min" deixa de ser "a sessão inteira". Recomendação: **duração por pedido, não por relógio** —
"as próximas 4 comandas entram em dobro" — porque relógio de 5 min pune quem pausa, é trapaceável em
segundo plano e não aparece na tela do churrasco, enquanto um contador `3/4` aparece.

## 3. Soprador e garrafa — um é armadilha, o outro é pontaria

A física primeiro (o motor no calor real da fileira, `espetinho_misto`):

| grelha | zona | calor | taxa | janela perfeita | +35 % · 1 s | % da janela |
|---|---|---|---|---|---|---|
| `lata_valente e1` | 1 | 0,65 | 21,7 %/s | 0,8 s | 7,6 % | 42 % |
| `ze_da_esquina e2` | 2 | 1,63 | 54,3 %/s | 0,3 s | 19,0 % | **105 %** |
| `parrilla_chef_cisma e2` | 3 | 1,70 | 56,7 %/s | 0,3 s | 19,8 % | **110 %** |
| `cozinha_do_campeao e3` | 3–4 | 1,70 | 56,7 %/s | 0,3 s | 19,8 % | **110 %** |

Um segundo de sopro na fileira quente **atravessa a janela inteira de perfeição**. Não é ajuste de
número: é a estrutura. A escada já levou o calor ao teto de 1,70 (lei da escada, `docs/23` §1), e o
jogo nesse ponto é sobre *timing*, não sobre *velocidade*. Consequência medida (topo, 38 sopros/turno):

| ferramenta | moeda/turno | queim% | ★ |
|---|---|---|---|
| baseline (skill 0,55) | 2 281 | 11 | 2,13 |
| ar +35 %, 3 s, freio 6 s | 2 236 (**−2 %**) | 13 | 2,08 |
| ar +70 %, 6 s, freio 2 s | 2 141 (**−6 %**) | **19** | 2,17 |
| ar +35 % (skill 0,30) | 1 868 (**−4 %**) | 16 (de 14) | 2,17 |
| água −35 %, gatilho 0,80 | 2 278 (0 %) | 12 | 2,17 · **perf 38 → 41** |

Ou seja: **vender "mais calor" é vender um botão que faz o jogador perder dinheiro e queimar mais**, e
isso vale em qualquer skill. A água é o contrário — não aumenta a renda (0 %), mas devolve 3 pp de
perfeição, e é *sensível ao gatilho*: com o limiar em 0,96 da janela ela nunca dispara (0 sopros/turno,
números idênticos ao baseline — o bot já serve antes); em 0,80 ela dispara 15,8×/turno e mexe no
jogo. A lição é que a garrafa é uma ferramenta de **precisão com custo**, não de produção, e o valor
dela é definido pelo momento em que o jogador pode usá-la — isso é design, tem de ser escrito.

O que sobra de bom na sua ideia, e é a parte original: **por fileira**. Uma grelha de 4 fileiras exige
4 toques para soprar a grelha inteira, e isso transforma a largura da grelha em *atenção*, não só em
vagas — hoje, depois do teto de calor (1,70), a grelha maior compra apenas capacidade. E o granular por
fileira só é jogável porque a régua de arte garante fileira ≥ 60 px de boca (`mouthH = Z·60 ≤ 248`,
`docs/22` §6.8): o alvo de toque existe no layout antes de existir no código.

Proposta que a medição sustenta: **as duas ferramentas são a mesma troca, e o custo é o carvão.**

* **Soprador** = converte carga em calor: `+X %` na fileira por pouco tempo **e** consome a brasa mais
  rápido naquela fileira. O `X` deve *cair* com o calor da fileira (auto-limitado e físico: num fogo já
  no tiragem máxima, soprar não faz quase nada) — assim a ferramenta é útil na `lata_valente` (42 % da
  janela por segundo) e inofensiva no topo, em vez de ser um interruptor de desastre. Curva a fechar
  com o probe, não de cabeça: dois pontos medidos acima são a meta.
* **Garrafa/spray** = converte tempo em controle: `-X %` na fileira por N s, e o custo é a produção que
  você não fez enquanto esfriou. Limiar de uso explícito no dado (o "0,80 da janela" medido).
* As duas entram como **camada de runtime sobre `zone.heat`** — mesmo caminho por onde
  `PatchGrillForChurrasqueira` já escreve — e não como dado novo de progressão: é o "motor fazendo o
  que ele faz", sem segunda fonte de verdade para o calor.
* **Não monetizar as ferramentas como poder.** Como *qualquer* item que multiplica calor, elas furam a
  lei da escada (calor por fileira vem da grelha, e o teto 1,70 existe porque a parrila premium já foi
  medida incineradora). O espaço delas é cosmético/conveniência (.skin do soprador, +0,5 s de efeito),
  e o `unburn_plate` (vídeo) já é a versão cara do resgate — a garrafa é a versão *habilidade*.

## 4. A moeda — o instinto está certo, a palavra está ocupada

"Carvão" não dá: é o combustível do HUD (`ui.hud.charcoal`), do aviso ("Carvão acabando!"), das três
tipos e do modal que o jogador acabou de ganhar; virar também o nome da moeda compraria confusão em
cada frase de loja. O `Brasas` já é a moeda premium do jogo, é a palavra do título e já está em 620
chaves pt-BR. O problema verdadeiro que a sua ideia achou é outro: **Brasas não compram nada.** Uma
moeda com quatro torneiras e zero pia não é economia, é placar — e é por isso que "trocar o nome"
parecia a solução.

Recomendação em três golpes, do mais barato ao mais estrutural:

1. **Trocar o rótulo das moedas para "Gorjetas"** (`currency.coins` + `ui.hud.coins`; 18 frases em
   pt-BR que falam de moeda/gorjeta (contadas no dicionário, não estimadas), incluindo as conquistas de "caixa"). A regra de payout *já é*
   gorjeta (`orderBaseTip`, `perfectTipBonus`, `speedBonus`, `customerTipMult`), a missão diária já diz
   "gorjetas", e o `coins` interno fica intacto — zero schema, zero save, zero vetor. Bônus: separa as
   duas moedas na cabeça do jogador — gorjeta é o que o cliente dá, brasa é o que a casa guarda.
2. **Consertar os ids antes de existir loja.** `brasa.coins.small.v1` *entrega Brasas* — enquanto o
   produto não está no Play Console, renomear para `brasa.embers.*.v1` é de graça; depois é cicatriz
   permanente ("product ids must match Play Console exactly").
3. **Dar pia às Brasas — e a pia é o booster.** `buyUpgrade` já aceita `currency: "embers"`, os
   boosters já são concedidos por três caminhos e não fazem nada, e `applyTurnResult` já é o lugar onde
   a bolsa do turno entra na meta (é exatamente o port que está na fila). então o fecho natural é:
   `tip_2x` / `xp_2x` ganham efeito, a **comanda entra como booster** (`fila_2x`, 4 pedidos, 2/dia),
   e ela é comprável com o mesmo preço em Brasas que o vídeo concede de graça — assim o IAP compra
   *conveniência e volume*, não poder, e a escada do jogador gratuito continua sendo a escada medida.
   Numa frase: **o vídeo dá a comanda; a brasa dá a comanda sem esperar; a grelha dá a comanda grande.**
   E se um dia as Brasas precisarem de uma pia maior, o campo que falta é `costEmbers` na evolução — já
   existe o lugar na mesa (`CostEmbers` no C# devolve 0 hoje), e ele é *adicional* ao custo em moedas
   para não mexer em `churrasqueiraUnlockPacingTurns` por trás da régua.

## 5. Guardas que isto exige (senão vira enfeite)

* `applyTurnResult` precisa carregar boosters (estado + expiração em **pedidos**, não em segundos de
  relógio) e o ledger já tem `source`, que é onde a distinção gorjeta/brasa fica auditável. É o mesmo
  commit do port que estava na fila: decidir antes de escrever custa um parágrafo, decidir depois custa
  um schema de save.
* Ferramenta de fileira entra no `tick` do sim **antes** da política e é vetorizável: `TurnSimulation`
  C#/TS têm de divergir zero — os 12 vetores de turno param de bater se o `zone.heat` for mutado em
  ordem diferente. Isso é teste, não opinião.
* `ads.json.rewardedPlacements` ganha `comanda_rush`; `double_turn` (6/dia, que dobra o prêmio de um turno) passa a
  ser **excludente** com a comanda no mesmo resultado de turno, senão os dois juntos valem mais que o
  teto que a banda de renda autoriza.
* Se a comanda existir, os alvos `dailyCoinIncomeAtLevel` precisam de uma nota nova dizendo que são do
  jogador *sem* buff — hoje eles já são isso por construção, e a tentação de "justificar +35 %" relendo
  a banda é o jeito certo de perder a escada.

## 6. As decisões (com o que cada uma custa)

1. **Comanda**: fila 2× por 4 pedidos, 2/dia, `double_turn` excluído no mesmo resultado — *recomendado*;
   ou o "5 min" literal (+17 % de renda/dia, ★ intacto, L1 quase não sente); ou fila + pedido em dobro
   (medido: 18-24 % de perdido, turnos perdidos, não recomendo).
2. **Soprador**: entra como troca carvão→calor com força caindo com o calor da fileira, ou não entra.
   Vendê-lo como "boost de calor" está medido como perda (−2 a −10 % de moeda, +2 a +8 pp de queimado).
3. **Garrafa**: entra como resgate por fileira com gatilho escrito em dado (0,80 da janela medido), e
   sem preço em poder. Ela também é a resposta do jogo para o `unburn_plate` pago — decidir os dois
   juntos.
4. **Moeda**: rotular `coins` de "Gorjetas" (13 frases, zero risco), consertar `brasa.coins.*` →
   `brasa.embers.*` antes da loja, e dar pia às Brasas via boosters (não via nome "carvões").
