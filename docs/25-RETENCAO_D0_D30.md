# 25 · Retenção D0 → D30, e os ajustes que saíram da medição

> Este documento decide (o dono delegou: *"tome as melhores decisões pensando na maior capacidade de
> retenção associado à monetização"*) e registra o que já foi aplicado. Os números vêm do repositório,
> não debenchmark de mercado: `npm run sim` (60 turnos) e `sim:long` (1 500), `npm run check-shots`
> (funil do FTUE real), `tools/studio/probe-monetization.ts` (as ideias da `docs/24`) e a função de
> renda offline do próprio jogo. Onde falta medição, está escrito que falta.

## 1. O funil de D0, minuto a minuto (medido)

| momento | o que acontece | estado antes → depois desta turnada |
|---|---|---|
| 0 s | `first_open` → FTUE | intacto: primeiro PERFEITO em **16,1 s**, tutorial completo em **32,9 s**, primeiro upgrade comprado em **38,3 s**, 0 erros de toque (`check-shots`) |
| ~1,5-3,5 min | turnos 1-2 (turno médio = **105,4 s**) | intacto |
| turno 3 | **primeira grelha comprada** (`ze_da_esquina`; banda 4-12) | intacto — é o pico do D0 |
| turno 4 | pacote de R$ 9,90 oferecido | **caía no bolso vazio**: o gastador guloso fecha 60 turnos com 1 380 de 106 750 ganhos. Agora: turno **7** |
| turnos 5-6 | primeiro intersticial elegível | **podia cair dentro do D0** (suprimia só 2 sessões; D0 = 3-4 sessões). Agora: 3 sessões |
| turno 7 | segunda grelha (`grelha_de_praca`) | agora também é onde a oferta aparece |
| turnos 8-12 | **vácuo**: nada novo para comprar até o turno 19, nenhuma tela nova até 32 | é o calcanhar do D0 — ver §4 |
| fim da sessão | promessa do "amanhã" = renda offline | **quebrada no topo da escada**, ver §3.1 |

Duas coisas boas que já estavam e não mexi: a diária de 7 dias entrega **conteúdo** no dia 2
(`queijo_coalho`, um ingrediente novo — puxar D1 com conteúdo em vez de com moeda é o certo) e as 3
missões diárias valem ~1 700 no D0/D1, ≈ 15 % da renda ativa medida do L5 (banda 9 000-14 000) — o
suficiente para serem um motivo, não o suficiente para virarem trabalho. **Ficar onde estavam foi
decisão, não omissão.**

## 2. O que a escada promete em cada horizonte (medido em 1 500 turnos)

| | gatilhos reais | nota |
|---|---|---|
| D0 | grelhas nos turnos **3** e **7**; FTUE + 1 upgrade | dois picos e um platô de 5 turnos |
| D1 (turnos ~13-24) | **19** = terceira grelha (`espeto_do_neno`), banda 12-32 | o jogador volta e compra em ~1 sessão ✓ |
| D2 (~36 turnos) | tela nova em **32**; grelha em **50** | a segunda tela chega no dia 3 — um dia depois do degrau |
| D7 (~84) | grelha **61**, tela **91**, grelha **95** | ritmo de ~1 compra/semana ✓ |
| D14-D30 (168-360) | grelhas **184**/**309**, telas **148**/**248**, coleção 47, rotas, passe | horizontal por design (`_incomePlateauNote`) |
| D30+ (474-1 500) | telas **474**/**1 328**, grelha **509**, L80 | cauda longa, decididamente atrás do horizonte medido |

Renda ativa **platô em ~96 700/dia do L30 ao L50** — é escolha documentada (progressão horizontal).
Toda a análise abaixo sai daí: qualquer curva *passiva* que continue crescendo depois desse ponto não
dá progressão, dá número.

## 3. Os três furos encontrados (e o que foi feito)

### 3.1 A noite offline pagava mais que jogar — e parava de dar XP no topo

Medido com a função do jogo (`computeOfflineEarnings`, gerente no máximo, cap de 8 h):

| tela | moeda/8 h antes | dias de renda ativa | XP antes | agora (moeda / dias / XP) |
|---|---|---|---|---|
| `festival` | 173 376 | 1,79 | 7 430 | 140 352 / 1,45 / 7 430 |
| `rede_nacional` | 355 008 | 3,67 | 13 210 | 148 608 / 1,54 / 13 210 |
| `cais_das_brases` | 710 016 | 7,34 | **0** | 153 562 / 1,59 / 14 035 |
| `quiosque_da_orla` | 1 420 032 | 14,68 | **0** | 158 515 / 1,64 / 14 861 |
| `cozinha_do_campeao` | 2 840 064 | **29,37** | **0** | 163 469 / 1,69 / 15 686 |

Dois defeitos, um em cada direção. As moedas: a curva foi estendida para as 10 telas **dobrando**
(430 → 860 → 1 720 → 3 440/min), herdando a razão da tabela antiga de 7 valores enquanto a renda ativa
tinha sido achatada de propósito — resultado: uma noite no topo valia 17 a 29 dias de jogo, ou seja,
**a jogada ótima era não jogar**, e "voltar amanhã" deixava de ser decisão para virar loteria. O XP: a
tabela parava no índice 6 e a leitura usa `?? 0`, então cais/orla/campeão recebiam moeda e **zero
progresso** por noite — sem erro, sem aviso, sem rastro.

Corrigido em `economy.json.idle` (`coins: … 170/180/186/192/198`, `xp: … 17/18/19`), com a regra
escrita como guarda em `economy.test.ts`: *nenhuma noite de 8 h paga mais de 1,75 dia da renda ativa
daquela tela*, com os âncoras lidos das próprias bandas de `targets.dailyCoinIncomeAtLevel` — mais um
teste de forma (uma linha por restaurante, monotônico, e "onde há moeda há XP", que é o que impede o
`?? 0` de engolir a tabela de novo). `npm run sim`: **all 24 balance targets met** depois da mudança, e
os vetores `econ.offline` foram regenerados (a CI confere os dois lados).

Sem efeito colateral na escada: o simulador não acumula offline, então `churrasqueiraUnlockPacing` e
`restaurantUnlockPacing` não se moveram — o que mudou é o que o jogador recebe *por não jogar*, que é
exatamente onde a retenção de D7+ morre ou vive.

### 3.2 O D0 pedia atenção cedo demais, e vendia no momento errado

`skipFirstSessions` 2 → **3** (D0 = 3-4 sessões medidas) e `starterPackShownAfterTurns` 4 → **7** (depois
da segunda grelha, na janela entre a segunda compra e o próximo desejo, não no bolso vazio do gasto
recente). Ambos viraram asserções em `monetization.test.ts` com a medição citada, para que a próxima
re-afinação da escada não desfaça por acidente.

### 3.3 A moeda mole mentia sobre o que é

A regra de payout **é** gorjeta (`orderBaseTip`, `perfectTipBonus`, `speedBonus`, `customerTipMult`,
`docs/06` §8) e a missão já dizia "gorjetas" — mas o rótulo na cara do jogador era "Moedas". 15 strings
pt-BR renomeadas para **Gorjetas**; a chave de dado continua `coins` (251 ocorrências em dados, zero
schema, zero save, zero vetor). Isso separa as duas moedas na cabeça de quem joga: **gorjeta é o que o
cliente dá, brasa é o que a casa guarda** — e é a condição para a pia da moeda premium fazer sentido.

## 4. As decisões, tomadas

**D1 · A comanda entra, mas como a medição deixou claro: fila, não prato.** Booster de **4 pedidos**
(não 300 s de relógio), **2/dia**, dobrando a *chegada* (`spawnInterval ÷ 2`) e não o tamanho do
pedido — porque fila+pedido juntos mediram 18-24 % de clientes perdidos e ★ 1,4-1,6, e a fila sozinha
rendeu +26 % (L1) a +91 % (meio da escada) com o perdido parado. Grito de D0: **a primeira comanda é
dada no fim do FTUE, sem pedir vídeo** — é o jeito mais barato de fazer o jogador *sentir* a grelha
nova pagando (compra no turno 3, buff no turno 4: a fila dobra e o plateu de vácuo do §1 deixa de
existir). Repetição = vídeo (`comanda_rush`, 2/dia); impaciência = **6 Brasas** por comanda extra.
Custo: precisa de `boosters.json` + `applyTurnResult`, então ela entra **junto** do port que já estava
na fila — não antes, para não criar dívida de C#.

**D2 · `double_turn` 6 → 3/dia e excludente com a comanda no mesmo resultado.** Dois botões de "2×" na
tela de resultado se canibalizam, e o teto diário deixa de existir. **Não apliquei o 3/dia agora**:
enquanto a comanda não existe, cortar o `double_turn` é tirar monetização sem dar nada em troca. A
redução entra no mesmo commit da D1.

**D3 · Soprador e garrafa entram como decisão, não como poder — depois do port.** Medido: +35 % de
calor *custa* dinheiro (−2 a −10 %) e queima mais (+2 a +8 pp), porque a 1,70 a janela de perfeição tem
0,3 s e 1 s de sopro atravessa 110 % dela; a água não aumenta renda (0 %) e devolve +3 pp de perfeição,
com valor dependentemente ligado ao gatilho (a 0,96 da janela ela nunca dispara; a 0,80, 15,8
usos/turno). Então: ar = converte carvão em calor com a força *caindo* conforme a fileira já está
quente (auto-limitado, útil na grelha inicial, inofensivo no topo); água = converte tempo em controle.
Por fileira, como você quis — e só é jogável porque a régua de arte garante boca ≥ 60 px por fileira.
**Nada das duas coisas é vendida**: item cosmético, no máximo. Como as duas mexem no `tick` que o C#
acaba de espelhar (162 checks), entram com vetores próprios logo depois do port da economia, não antes.

**D4 · Brasas: pia recorrente, não nome novo.** Corrijo o que escrevi em `docs/24` ("zero pia" — a pia
existe e eu não a tinha contado): `cosmeticTracks` cobra **2 710 Brasas** no catálogo inteiro (5 tracks ×
4 níveis) e o reroll de missão diária cobra 5 (1 grátis/dia). O problema é o tamanho: a torneira rende
~5 Brasas/dia (missões 2 + bônus + 1 por missão + 2,1 da diária) mais 1 072 do catálogo de conquistas,
então **o pacote grande (1 200 Brasas por R$ 39,90) não tem o que comprar em 8 meses de jogo**. Daí a
ordem: (i) comanda a 6 Brasas como pia *recorrente* (D1 acima); (ii) a escada de grelhas pode ganhar
`costEmbers` *adicional* nas evoluções de topo quando o ledger de Brasas estiver no C#; (iii) "carvões"
como nome da moeda **não entra** — a palavra é do combustível (`ui.hud.charcoal`, "Carvão acabando!", os
três tipos do modal) e o `Brasas` já é título, moeda e fantasia ao mesmo tempo.

## 5. O que fica faltando medir (e não é pouco)

1. **O vácuo dos turnos 8-12** é hoje a maior alavanca de D0 não resolvida. A alavanca existe e é
   testável em uma rodada: baixar o `costCoins` do `espeto_do_neno` (banda 12-32, medido 19) para ele
   cair ~13 e ver se `restaurantUnlockPacing` continua dentro das bandas. **Não fiz** porque mover o
   terceiro degrau empurra toda a cauda (50/61/95/184/309/509) e isso é re-escrever a escada medida por
   um ganho que eu ainda não separei do ruído — na próxima turnada eu rodo os dois lados e trago a
   tabela.
2. `churn_risk_signal` existe na taxonomia com o `trigger` "heuristic risk detected" — **a heurística
   não está escrita em lugar nenhum**, então hoje o jogo declara o KPI (D1/D3/D7/D14/D30, LTV D7/D30/D90)
   e não tem o sinal que o antecipa. Proposta para o commit do `SaveSystem`: sinal =
   `sessões_perdidas ≥ 2 && grelha_pendente ≤ 1 degrau && (brasas > preço_da_comanda || gorjetas > 2× custo_da_grelha)`
   — os dois ramos são "tem estoque parado", que é o que a curva do §3.1 ensinou a olhar.
3. O ledger de faucet/sink do simulador só soma `coins` (`if (e.currency !== 'coins') continue`) — por
   isso a pia das Brasas só apareceu quando fui olhar o dado à mão. Extender o relatório para as duas
   moedas é o que torna a D4 auditável na CI em vez de na memória de quem escreveu este parágrafo.
4. Nenhum número deste documento é previsão de coeficiente de retenção. O que ele é: as fricções que
   foram removidas, medidas no motor do próprio jogo, e o instrumento que diz se elas se traduzem em
   `d1_return` (o funil de `analytics.json` já tem a etapa; falta o jogo publicado para responder).
