# A-06.4 — fechamento econômico após rebalanceamento autorizado

**2026-09-27 · concluído e validado localmente: campanha ativa1500 =18/18, exit0.**
A-06.5 **não foi iniciada**. Branch `arena/01a0e099-game-churrasqueiro`; fetch confirmou
`origin/main=e50ce1523fa3d04119dc454e3edb050070641c10`. Patch anterior preservado.
Sem commit/push/PR/merge, CI remoto, arte nova, SDK, porta C#/Unity ou dispositivo.

## Autorização e diagnóstico anterior

O dono rejeitou avançar mantendo15/18. Reproduzimos o problema em
[red-long.log](red-long.log), exit1: Rede881, L50=183.646, spend47,8%.
[diagnosis.json](diagnosis.json): todas27 trilhas já maximizadas, gasto10.873.220 versus
renda22.748.950. Apenas mudar ordem de compras não elimina o excesso de renda acumulada.

Diante do conflito com a proibição anterior de retuning, o dono escolheu explicitamente
**`late_income` — Rebalancear a renda tardia**, preservando preços, compras históricas,
FTUE, regras offline e metas. Não escolheu novos gastos. Este é um **rebalanceamento
intencional autorizado**, não uma suposta correção de ledger nem ajuste exclusivo do bot.

## Mudança de contrato implementada

`economy.json` v14 → `reward.activeCoinMultiplierByRestaurant`:

| Restaurante | Fator sobre as moedas de cada prato |
|---|---:|
| 0–3: Quintal até Bairro | 1,00× — intactos |
| 4: Premium | 0,85× |
| 5: Festival | 0,62× |
| 6: Rede Nacional | 0,48× |

- `TurnSimulation.completeServe` passa o restaurante real para `scoreItem`. O fator é
  aplicado **uma vez, antes do arredondamento final**, após qualidade/gorjetas/combo/VIP.
  Serviço manual e automático compartilham esse caminho, usado também pelo browser.
- Não há débito/taxa na carteira, consumo fictício, clamp do saldo, gasto novo ou alteração
  de compras. Não se reduz XP, qualidade, progresso, cap de equipe ou renda offline.
- Ingredientes mantêm valor-base/XP; preços/unlocks de restaurantes, grelhas e upgrades,
  crescimento/máximos/moedas, bônus de fase/nível/fim de turno e todas as metas preservados.
  Comparação contra a base: [contract-review.json](contract-review.json).
- Forma preservada: combo/perfeito/gorjetas continuam aumentando pagamento; queimado zero.
  O coeficiente pertence ao restaurante, não ao nível do jogador: ganhar XP não diminui
  a recompensa do mesmo prato no mesmo restaurante. Não há distinção bot/jogador.
- UI Home informa o percentual de receita de pratos e que XP/fase/offline não mudam.
  Captura53 inspecionada visualmente; UI avançada continua fixture, não prova da campanha
  natural completa do browser. Metaprogressão/XP ativo legado do browser continuam F10.

## Resultado comparável

Seed20260917,dt1/12,1500 turnos,UTC2026-09-21,12 turnos/dia; VIP natural,
**sem rewarded e sem renda offline**. [green-long.log](green-long.log) e
[green-long-repeat.log](green-long-repeat.log) são byte-idênticos: **18/18, exit0**.

| Critério que falhava | Antes | Depois | Meta original |
|---|---:|---:|---:|
| Rede Nacional |881 |**1130** |950–1450 |
| Renda diária L50 |183.646 |**123.527** |98.000–152.000 |
| Gasto/renda |47,80% |**74,07%** |70–99% |

Todos os demais15 critérios também passam. Restaurantes42/96/168/277/422/1130;
grelhas11/43/87. Renda L5/L15/L30 **10.614/39.317/114.415**, iguais ao pré-rebalanceamento.
Curva autoral sem compras: skill.55 →45,6% perfeito, inalterada.

| Acumulado1500 | Antes | Depois |
|---|---:|---:|
| Renda |22.748.950 |**14.679.360** |
| Gasto |10.873.220 |**10.873.220** |
| Saldo |11.875.730 |**3.806.140** |

Queda8.069.590 na renda/saldo, **35,47%** da renda anterior; não houve aumento de gasto.
Todas27 trilhas maximizadas, mesmos6.358.620 de upgrades. Dados completos/faucets/sinks:
[economy-comparison.json](economy-comparison.json), reproduzível com
`node --experimental-strip-types tools/studio/late-income-report.ts`.

**Consequências expostas:** média por turno Premium10.708, Festival10.679, Rede10.263.
A curva tardia agora é aproximadamente um platô, não crescimento ilimitado por tier;
avançar estabelecimento não promete aumentar receita por prato. Festival chega422 em
vez de430: renda menor muda a cronologia de upgrades/reserva do bot; não alegamos atraso
monotônico de todos os unlocks. Perfeitos42,17%, queimados.0771%, perdidos2,151%,
duração169,645s; VIP244/240. Staff61.265 serviços/27.978 viradas/76 preparos, caps mantidos.

**Sensibilidade adicional:** seeds20260918 e20260919 também **18/18**, sem trocar curva,
alvos ou dt: Rede1130/1129; L50=122.775/122.449; spend74,10%/74,12%.
[seed-sensitivity.json](seed-sensitivity.json). Não é promessa de todos os perfis/retention.

## Regressões e validação

- [red-tests.log](red-tests.log):10 falhas/6 passes antes da curva (inclui campanha longa).
  [candidate-1.log](candidate-1.log):primeira curva ensaiada já passa18/18; não houve
  busca que mudasse seed/alvos para escolher um resultado favorável.
- **672 testes/29 arquivos;14/15 gates locais**, [green-gates.log](green-gates.log).
  C# **SKIP** por falta de dotnet — não PASS. DTO/schema/cópias gerados, não regras C#.
- Novo `economy-long.test.ts` faz a campanha1500 integrar o `npm test` e portanto os gates.
  Exige todos18 critérios, zero offline e conservação renda−gasto=carteira. O sim curto
  continua existindo, mas sozinho não pode mais ocultar essas falhas tardias.
-22 testes novos de curva/runtime/validação/arredondamento/XP/carteira, incluindo serviço
  real. Quatro expectativas de gorjeta do Garçom agora passam o restaurante real ao
  scorer; asserções de bônus só na gorjeta e claim único não foram relaxadas.
- **157+44 vetores**, regeneração explícita em [generation.log](generation.log), revisão
  em [vector-review.json](vector-review.json).116 vetores anteriores intactos;27 turnos
  tardios mudam **somente moedas** (e moedas de pratos VIP quando presentes). XP, qualidade,
  tempos, contadores, recursos, staff e inputs intactos.14 novos casos de scoring cobrem
  sete restaurantes × manual/automáticoVIP.13 vetores econômicos/offline antigos intactos;
 44 FTUE byte-idênticos. Nenhuma drift aceita sem verificar quais campos mudaram.
- **53 capturas**, incluindo Home com percentual e provas prévias de offline/storage/claim.
  FTUE16,1/32,9/38,3s,0 misses,136 moedas. pt-BR613 chaves, en/es135 cada (22,0% fallback).
- Cenário separado de ausências reexecutado:
  [absence-economy.json](absence-economy.json) **byte-idêntico ao A-06.4 anterior**.
  Coleta, XP, cap8h, snapshots, Caixa e composição aditiva2,18× preservados.

## Limites e estado seguinte

A-06.4 tem agora integração funcional e seus critérios econômicos locais validados.
**Não iniciamos A-06.5.** A revisão final das27 trilhas e F4 global continuam etapas
separadas. Não extrapolar estes18 critérios para aprovação de retenção, toda a economia
offline, todas as cohorts, SDKs, paridade C#, Unity ou publicação. Antifraude local,
turno persistente e dívida F10 permanecem conforme relatório funcional anterior.
