# A-06.3 — equipe e Bandeja validadas localmente

**2026-09-27 · branch `arena/01a0e099-game-churrasqueiro` · base `e50ce15`.**
Contrato aprovado: [design-proposal §4.5](../design-proposal.md), [decisions](../decisions.md).
**24 trilhas integradas / 3 pendentes:** Caixa, Gerente e Logística aguardam **A-06.4/offline**.
Este checkpoint não fecha A-06 inteiro, a economia global ou a porta C#.

## Implementação e limites

`StaffRuntime` acompanha o turno real. UI e bot não simulam benefícios: os funcionários
chamam as mesmas operações legais de virada, admissão prep e serviço. Não escolhem/movem
zonas, não calculam o instante ótimo e não garantem perfeito ou imunidade à queima.

- **Garçom:** níveis1–5 com coberturas20/40/50/50/50%. Porção boa/perfeita, ou prep pronta,
  correspondente a linha aberta de cliente aguardando **mais de1,5s**. Cliente mais antigo,
  depois menor ID de alimento; revalidação antes de servir. Intervalo1,5s entre viagens
  bem-sucedidas; uma porção, ou até duas no nível5, sempre dentro do crédito restante.
- **Bandeja:** `1,5 / (1 + .10 × nível)` segundos por viagem; máximo1s. Requer Garçom;
  não altera serviço manual, cobertura, qualidade ou reação do bot.
- Gorjeta automática +5% nos níveis2–3, +10% nos4–5; substitui, não acumula. O termo de
  gorjeta já bonificado é multiplicado por1,05/1,10; receita-base e XP não são multiplicados.
  Arredondamento continua no fim do score. Serviço manual não recebe esse adicional.
- Garçom3+ prevê **risco de queima em aproximadamente1s** pelo calor atual, lado/carryover,
  receita e velocidade. Aviso visual por porção; calor zero remove a previsão. Mudança de
  zona/carvão altera a previsão. O aviso não salva o alimento; teste e captura mostram queima real.
- **Auxiliar:** cadências6/4,5/3,5/3/2,5s, chances20/40/60/80/100%. RNG independente
  `seed ^ 0xa063`. Só receitas prep, demanda aberta mais antiga ainda não coberta por porção
  em preparo/pronta. Checa estoque e vaga; falha não cobra nem produz receita errada.
  Nível3+ adiciona exatamente **uma vaga real**, inclusive11ª com restaurante6/Tábua5.
  Faca acelera a porção real; pronta ocupa vaga. Não serve nem repõe estoque/carvão escondido.
- **Churrasqueiro:** cadências5/4/3/2,5/2s, coberturas20/30/40/50/60%. Uma virada automática
  por porção ainda não virada, após o **mesmo sinal público** usado pela UI. Mais antiga
  elegível primeiro, sem otimização de score. Costela/cupim continuam sides2 + flipNeeded.

**Cap real por turno:** no máximo `floor(cobertura × porções distintas elegíveis)` ações
bem-sucedidas. IDs observados uma vez; serviço/virada manual também entram no denominador,
se atingiram a condição. Cruas, queimadas, tentativas falhas e frames repetidos não criam
crédito. Perder/descarregar o alvo não gasta crédito. Um primeiro elegível não arredonda
50%/60% para100%. Timers executam no máximo uma oportunidade/viagem por atualização, sem
rajadas após lag; Garçom5 ainda respeita máximo2 e orçamento. Histórico não foi apagado.

A coleta de elegibilidade roda antes de ações manuais/enfileiradas e no passo físico.
O bot continua podendo agir; revalidações evitam serviço duplo e orçamento falso. O FTUE
explicitamente ensina ações manuais (`staffEnabled:false`), sem automação tomar o gesto.
Gates de restaurante/receita também limitam o runtime de níveis históricos fora de contexto.

## Red → green, UI e dados

- [red-rules.log](red-rules.log): **20 falhas** com regras antigas, ações ausentes.
  Cinco fixtures de virada foram depois ajustadas para respeitar o cooldown manual já
  existente e exigir sucesso da virada manual; não se alterou cooldown para fazê-las passar.
- [red-ui.log](red-ui.log): ausência de status/UI de equipe. A primeira tentativa do harness
  chegou ao limite de memória nativa ao carregar mais um bundle; isso não foi contado como
  red funcional. O red registrado foi reproduzido depois de corrigir o cache de imagens.
- [red-purchases.log](red-purchases.log): quatro compras ainda bloqueadas antes da promoção;
  [red-data.log](red-data.log): cinco cópias inválidas de dados antes da validação adicional.
- **54 testes de equipe**: todos os níveis, floors em amostras1–10, serviço natural de prep,
  FIFO/espera estrita, serviço no ponto bom (não espera perfeito), gorjeta manual/automática,
  termo de gorjeta/XP, concorrência com serviço enfileirado, descarte/alvo obsoleto, RNG separado,
  stock0/vaga cheia/cadência/lag, Faca/Tábua/vaga11, aviso e queima, histórico/gates/compras.
  [green-rules.log](green-rules.log): equipe+compras+recursos, **158 PASS**.
- Ponteiros compram as quatro trilhas pelo preço compartilhado e reabrem preservando níveis.
  O fixture antigo de fila manual é isolado da equipe **após** verificar a persistência;
  não se apagou progressão no jogo. Caixa substitui Garçom como exemplo pendente.
- Capturas **47–49**: colocação manual de duas linguiças; uma virada automática com
  orçamento1/2, nenhuma mudança de zona; sobreposição manual; Garçom pagando serviço real,
  Auxiliar iniciando prep real e4ª vaga; Bandeja máxima1s; aviso antes de queima efetiva.
  Ordens vêm do fluxo normal com seed fixa, fixture avançado/player12/pressão controlada;
  não é prova de progressão natural completa da UI. Capturas ignoradas/regeneráveis.
- UI mostra ações/status da equipe e alerta por porção. Textos não prometem mais que os
  consumidores: Auxiliar não repõe carvão; Churrasqueiro não move zonas nem impede queima;
  Bandeja acelera viagens, não aumenta quantidade por viagem.

**Harness de imagens:** `shoot.mjs` agora compartilha pixels decodificados imutáveis por URL
entre fixtures de relaunch, como um cache de imagem do navegador. Todos os244 sprites ainda
usam o decoder real e rasterização nativa; sem novo asset, mock de pixels, redução de casos,
aumento de timeout ou relaxamento do orçamento60s.49 capturas permanecem verificadas.

Dados: employees2→3 dá campos numéricos às regras aprovadas; grill5→6 publica o sinal.55.
O sinal conserva o valor anterior do FTUE e tem teste de igualdade. Schemas, DTOs de dados
Employees/Grill e cópias Assets/Data regenerados. **Nenhuma regra C# portada.**
[contract-review.json](contract-review.json): custos/moedas/crescimento/máximos/deltas das27
trilhas, unlocks/níveis/coberturas dos funcionários preservados. Não houve retuning de preços.

## Gates, vetores, save

**615 testes / 26 arquivos;14/15 gates locais (C# SKIP);49 capturas;136+44 vetores.**
[green-gates.log](green-gates.log). FTUE16,1s/32,9s/38,3s,0 misses,136 moedas; prep, quarta
zona, VIP, recursos e catálogo/fila anteriores preservados.

Regeneração explícita em [vector-review.json](vector-review.json): **todos os127 vetores
anteriores intactos** (48 cooking,32 scoring,6 economia,41 turnos);44 FTUE **byte-idênticos**.
Mudam metadados grill6/employees3 e entram9 turnos com métricas reais de staff:

| Caso | Moedas | Serviços auto / elegíveis | Viradas auto / elegíveis | Prep auto |
|---|---:|---:|---:|---:|
| Controle |11.593|0/0|0/0|0|
| Garçom1 |12.059|28/143|0/0|0|
| Garçom3 |11.329|68/137|0/0|0|
| Garçom5 |11.409|68/137|0/0|0|
| Garçom3+Bandeja5 |11.794|68/136|0/0|0|
| Auxiliar5, seis pedidos prep/sem bot |25|0/0|0/0|4|
| Churrasqueiro5 |11.593|0/0|29/128|0|
| Equipe combinada, com bot |11.871|68/136|36/128|0|
| Auxiliar5+Garçom5+Bandeja5, prep/sem bot |74|3/6|0/0|6|

25 moedas no controle de Auxiliar são bônus de fim de turno já existente, **não receita de
serviço fictício**: zero pratos servidos. O bot costuma admitir prep antes da oportunidade
do Auxiliar; por isso algumas amostras combinadas não o acionam. Probes sem bot e campanha
comprovam seu consumidor. Mais automação não garante maior renda/qualidade em todo cenário.

Savev4/CRC e browser `churrasco_meta_v2` sem mudança de shape/migração. IDs e níveis históricos
preservados, sem reembolso. Orçamentos, timers, RNG de Auxiliar, chegadas e elegibilidade são
runtime; não se implementou retomada persistente de turno nem coleta offline. A-06.4 deve
usar ledger próprio, não simular ações de equipe no período ausente.

C# permanece **SKIP sem dotnet**.50 turnos+5 casos econômicos não portados; divergência de
calor esgotado já registrada em A-06.2; equipe/gorjeta automática também aguardam porta.
Gerar DTO não prova paridade, compilação ou execução Unity/Android. Nenhum CI remoto desta entrega.

## Campanha comparável — ainda15/18

Seed20260917,1.500 turnos,dt1/12,12 turnos/dia, UTC2026-09-21; VIP natural, sem rewarded/offline.
[green-long.log](green-long.log) / [repetição](green-long-repeat.log) / [diff vazio](long-repeat.diff),
[economy-comparison.json](economy-comparison.json), [after-audit.json](after-audit.json).

| Métrica | A-06.2 | A-06.3 |
|---|---:|---:|
| Renda |24.816.326|23.263.609|
| Gasto |8.089.550|8.468.130|
| Saldo |16.726.776|14.795.479|
| Spend |.3259769395|.3640075794|
| Rede Nacional |670|729|
| Renda diária L50 |210.171|189.197|
| Perfect / burned / perdidos |75,4% /0,1% /3,2%|42,2% /0,1% /2,3%|
| VIP chegados / servidos |244 /232|244 /238|

**15/18, exit1**, repetido byte a byte. Fora das faixas: rede729 vs950–1450,
L50=189.197 vs98.000–152.000, spend.364 vs.70–.99. Unlocks42/96/168/272/422/729;
grills11/43/87; L80/rest6/Fornalha3; duração173,7s. L5/L15/L30:10.614/39.317/114.899.
Curva autoral sem compras conserva45,6% perfeitos no skill.55; não confundir com campanha equipada.

Equipe na campanha: **64.715 serviços /130.902 elegíveis**, **29.630 viradas /132.459 elegíveis**,
**147 preparos**. O relatório verifica caps em cada turno, não só uma média agregada.
A queda de perfeitos é compatível com servir a partir de **bom**, sem esperar centro da janela;
não mudamos essa regra aprovada para melhorar economia. A renda mistura isso com progressão,
recursos e composição de pedidos; não é estimativa causal por trilha.

Gasto adicional **378.580** é exatamente Garçom60.800 + Auxiliar102.130 + Churrasqueiro211.210
+ Bandeja4.440, todos maximizados.24 ativas somam3.953.530;3 pendentes2.405.090; todas27
continuam6.358.620. Pendentes não receberam compras; níveis antigos não foram reembolsados.
Renda−1.552.717/saldo−1.931.297 vs A-06.2. F4/economia continua reprovada; offline não foi inventado.

## Reprodução / parada

```sh
npx vitest run tools/studio/test/staff.test.ts tools/studio/test/upgrades.test.ts tools/studio/test/resources.test.ts
npm run gates
npm run sim:long  # exit1 conhecido, três alvos fora da faixa
node --experimental-strip-types tools/studio/upgrade-step3-report.ts
node --experimental-strip-types tools/studio/upgrade-audit.ts
```

Parar neste checkpoint. Próximo **A-06.4**, offline no índice3, Caixa/Gerente/Logística,
âncora/ledger/claims reais, conforme contrato já aprovado; depois A-06.5/revisão27 e F4.
Gerente: missão/desconto/VIP seguem backlog. Sem commit/push/PR/merge, arte nova, publicação,
SDK real, porta de regras C# ou validação em dispositivo.
