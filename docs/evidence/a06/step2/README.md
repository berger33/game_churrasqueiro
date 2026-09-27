# A-06.2 — recursos implementados e validados localmente

**2026-09-27 · branch `arena/01a0e099-game-churrasqueiro` · base `e50ce15`.**
Contrato aprovado em [design-proposal](../design-proposal.md) e [decisions](../decisions.md).
Este checkpoint fecha **recursos**, não A-06 inteiro nem o aceite econômico. Próximo: **A-06.3, equipe/Bandeja**.

## Entrega

- **20 trilhas integradas / 7 pendentes**. Estabilidade, Qualidade, Auto-carvão e Balcão
  agora têm consumidores reais e compras liberadas no mesmo resolvedor UI/serviço/bot.
  Pendentes: `tray`, `garcom`, `auxiliar`, `churrasqueiro`, `caixa`, `gerente`, `imperio_logistica`.
- Carvão ativo: `q = max(curva, min(1, .62 + .05 × qualidade))`;
  eficiência final `q + .04 × estabilidade × (1-q)`. Máximos6/6: **.9392** no fim do saco.
  O mínimo vem da curva autoral, atualmente.62. Nenhum bônus de duração ou imunidade à queima.
  `restaurant.grill.heatStability` legado permanece separado, sem inventar consumidor; A-13/F5 aberto.
- **Sem calor com carvão esgotado ou durante reposição**. Um único temporizador real de2,2s;
  ticks que atravessam término/esgotamento cozinham somente sua parcela com combustível.
  Reposição manual e automática usam `startCharcoalRefill`; nenhuma cobrança.
- Auto: primeira atualização que alcança22% restante, **uma tentativa por saco**,33/66/99%.
  RNG próprio `seed ^ 0xc0a1`, separado de pedidos/VIP. Saco carregado abaixo do limiar
  tenta uma vez se não marcado; fracasso não rerrola; novo saco só após concluir reposição.
  Colisão manual/automática não inicia dois ciclos.99% continua podendo falhar.
- **Estoque por ingrediente elegível**, inicia cheio:6+Balcão, máximo11.
  `rawStockPerTurn` foi renomeado para `rawStockCapacityPerIngredient`: é capacidade de
  reserva reabastecível, não cota total por turno. Débito só na admissão válida em grelha/prep.
  Mover/virar não debita; cancelar antes da admissão não cobra; queimar/descartar depois não devolve.
  Estoque zero bloqueia nova admissão, com contador/mensagem; não filtra pedidos.
- **Repor estoque** explícito, grátis,3s, todas as reservas, uma operação por vez; permite
  começar cedo. Preparo/cocção/paciência continuam. Sem prêmio por sobras, refill oculto ou premium.
  Bot usa a mesma ação quando demanda não tem estoque. Grelha cheia não cria raws órfãos;
  cancelamento/soltura inválida da UI também limpa porções ainda não admitidas.
- UI: contadores nos ingredientes, dois controles separados de48px, tempo/estado/gratuidade,
  feedback de falta/reposição automática. Aviso de carvão baixo não sobrescreve reposição em curso.
  FTUE conserva percurso guiado; controle explícito de estoque também fica disponível se faltar
  durante tutorial, sem reposição automática escondida.

## Evidência red → green

- [red-rules.log](red-rules.log): **14 falhas** antes das correções, incluindo fórmula,
  APIs de estoque ausentes, admissão ilimitada e **40 raws órfãos** no bot com grelha cheia.
  Imports/IDs eram válidos. Após estoque finito, fixture de grelha cheia passou a usar ingredientes
  distintos e exige sucesso de cada admissão; não confundir sua própria falta de estoque com vaga cheia.
- [red-ui.log](red-ui.log): interface sem os controles de estoque, após passar pelos cenários anteriores.
  [red-purchases.log](red-purchases.log): quatro compras ainda bloqueadas **antes de ativar o registro**.
  [red-auto-feedback.log](red-auto-feedback.log): confirmação automática sobrescrita pelo aviso de falta.
- [red-catalog-labels.log](red-catalog-labels.log): labels dinâmicos das novas trilhas faltavam;
  regressão agora exige texto pt-BR para todo efeito ativo. Chaves/opções pendentes não viram
  promessa ativa.
- **36 testes de recursos**: efeitos em cocção de verdade; níveis1/3/6; probabilidades33/66/99
  nos dois lados do limiar; falha sem rerrolagem em diferentes dt; sack já marcado; RNG isolado;
  fronteiras2+0,2s/2,9+0,1s; bot/stock por ingrediente; controles de índices inválidos já protegidos.
  [boundary-controls.log](boundary-controls.log) é controle **verde**, não alegação de novo defeito.
  [green-rules.log](green-rules.log): recursos + compras compartilhadas, **108 PASS**.
- Fixtures A-03 de10 vagas passaram a ter Balcão5 (11 unidades); fixture A-04 preenche zonas
  originais com ingredientes distintos. Mantidas todas as exigências de capacidade e serviço,
  agora com admissões legais. Teste A-08 continua permitindo mover prato queimado sem novo débito.
- Ponteiro real: compra as quatro trilhas pelo preço cotado e reabre preservando níveis;
  cancelamento sobre grelha não admite; seis colocações/descartes esgotam ingrediente;
  tentativa vazia não cria órfão; mensagem visível;3s completos, clique repetido não reinicia;
  carteira intacta; auto natural pelo tempo da partida, calor zero nas quatro zonas e colisão manual.
  Prep cheio preserva a11ª unidade; descarte não reembolsa. Capturas43–46 em `prototype/shots/`
  (ignoradas/regeneráveis);46 confirma feedback automático, não apenas um campo de debug.

## Gates, vetores e contratos

**565 testes / 25 arquivos;14/15 gates locais, C# SKIP;46 capturas;127+44 vetores.**
[green-gates.log](green-gates.log). FTUE: primeiro perfeito16,1s, completo32,9s, compra38,3s,
zero misses,136 moedas. Prep, costela/cupim, quarta zona, VIP, catálogo27 e fila paginada preservados.

Regeneração **explícita**, não aceitação cega de drift:
-48 cooking +32 scoring intactos;5/6 economia intactos; `econ.effectiveHeat` muda **só emt=1**
  para zero nas três zonas (antes havia calor sem combustível).
-28/35 turnos antigos intactos;7 mudam por estoque/reabastecimento/agendamento do bot.
  [vector-review.json](vector-review.json) contém antes/depois; [vector-counterfactual.json](vector-counterfactual.json)
  reproduz **todos os sete resultados antigos exatamente** ao remover somente a escassez em
  um probe separado. Não foi necessário reintroduzir órfãos, mexer em preços ou recompensas.
-6 turnos novos de250s: controle/estabilidade/qualidade/auto/Balcão/combinados, incluindo
  tentativas/sucessos e estoques finais. FTUE44 **byte-idêntico** ao checkpoint anterior.

Dados: grill4→5 adiciona `{stock:{basePerIngredient:6,refillTimeSec:3}}`; upgrades3→4 renomeia
stat do Balcão, sem alterar ID, moeda, custo, crescimento, delta ou máximo de nenhuma trilha.
Comparação das27 tabelas com a base em [contract-review.json](contract-review.json).
Schemas, cópias Assets/Data/manifest e DTO de dados Grill regenerados; **nenhuma regra C# portada**.
`Rules.cs` ainda não possui o corte de calor no esgotamento: a paridade desse vetor está pendente,
além dos41 turnos +5 casos econômicos sem port. Não inferir CI verde pela geração de DTO.

**Save review:** referência continua v4/CRC; browser continua `churrasco_meta_v2`.
Níveis/carteiras/contadores históricos preservados, sem reembolso, reset ou recibos inventados.
IDs das trilhas não mudaram. Estoques, débito por identidade, timers e flag de tentativa são
**runtime do turno**, não novos campos persistidos. O jogo ainda não retoma um turno salvo:
prova de runtime já abaixo do limiar não é prova de restauração persistente de partida.
Nenhuma migração de save exigida; reabrir UI valida progressão, não serialização de alimentos.

## Economia comparável — ainda reprovada

Seed20260917,1.500 turnos,dt1/12,12 turnos/dia, UTC2026-09-21; VIP natural, sem rewarded/sem offline.
[green-long.log](green-long.log), repetição [green-long-repeat.log](green-long-repeat.log),
[diff vazio](long-repeat.diff), [economy-comparison.json](economy-comparison.json).

| Métrica | A-06.1 | A-06.2 |
|---|---:|---:|
| Renda |24.859.245|24.816.326|
| Gasto |8.057.440|8.089.550|
| Saldo |16.801.805|16.726.776|
| Spend |.3241224744|.3259769395|
| Rede Nacional |664|670|
| Renda diária L50 |208.316|210.171|
| Perfect / burned / perdidos |75,6% /0,1% /3,3%|75,4% /0,1% /3,2%|
| VIP chegados / servidos |244 /231|244 /232|

**15/18, exit1**, igual na repetição. Falham rede670 vs950–1450, L50=210.171 vs98.000–152.000,
spend.326 vs.70–.99. Unlocks42/95/162/256/403/670; grills11/43/84; nível80/rest6/Fornalha3;
duração média174,7s. Renda diária L5/L15/L30:10.614/37.358/115.079. Conquistas VIP16.000.

Gasto adicional **32.110** é exatamente o custo máximo comprado das quatro trilhas novas:
Estabilidade7.850, Qualidade9.570, Auto7.810, Balcão6.880.20 ativas maximizadas somam3.574.950;
7 pendentes somam2.783.670; todas27 continuam6.358.620. Ledger verificado por trilha; pendentes0.
Renda−42.919/saldo−75.029 misturam recursos e cronologia de progressão, não ganho causal individual.
Nenhum preço/recompensa/tempo preexistente/meta foi retunado. Offline0 não é aprovação de A-06.4.

## Reprodução e parada

```sh
npx vitest run tools/studio/test/resources.test.ts tools/studio/test/upgrades.test.ts
npm run gates
npm run sim:long  # exit1 conhecido, 3 alvos econômicos fora da faixa
node --experimental-strip-types tools/studio/resource-vector-review.ts
node --experimental-strip-types tools/studio/upgrade-step2-report.ts
node --experimental-strip-types tools/studio/upgrade-audit.ts
```

Parar aqui. Próximo **A-06.3** conforme contrato já aprovado: Garçom/Auxiliar/Churrasqueiro/Bandeja,
ações reais e caps estritos. A-06.4 offline, A-06.5 revisão27, F4/economia, A-13/F5 e F10 continuam
abertos. Sem commit/push/PR/merge, arte nova, publicação, Unity ou validação em dispositivo.
