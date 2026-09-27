# Prompt completo de retomada — após A-06.4 local (2026-09-27 UTC)

> **Fechamento econômico revalidado (2026-09-27):18/18, exit0.** Após autorização
> explícita `late_income`, renda tardia ajustada no runtime, mantendo preços, histórico,
> FTUE, offline e todas as metas.672 testes,53 capturas,157+44 vetores; C# SKIP.
> A-06.5 **não foi iniciada**. Registro anterior abaixo é histórico; relatório vigente:
> [evidence/a06/step4/reopened/README.md](evidence/a06/step4/reopened/README.md).

Copie este documento para iniciar a próxima sessão. Base verificada: PR #14 MERGED,
`origin/main` em `e50ce1523fa3d04119dc454e3edb050070641c10`, CI do merge verde.
Nesta sessão `arena/01a0e099-game-churrasqueiro`, A-03/A-04/A-05/A-06.1–4 foram implementados/validados localmente,
**sem push, PR, CI remoto ou merge desta entrega**. Confira o Git real e preserve mudanças
não commitadas antes de continuar. Histórico no plano §9.14–9.22 e `docs/evidence/a03/` / `a04/` / `a05/` / `a06/step4/`.

---

## A-06.4 — fechamento econômico autorizado (vigente)

- O dono exigiu resolver as3 falhas antes de A-06.5 e escolheu explicitamente
  **`late_income`**: rebalancear renda tardia, preservando preços, histórico, FTUE,
  offline e metas. Não confundir com autorização para novos gastos ou tuning futuro.
- `economy14`: moedas por prato ×1 nos restaurantes0–3, ×.85 no4, ×.62 no5, ×.48 no6.
  Mesmo scorer no runtime manual/automático/VIP/browser, arredondamento único. Não reduz
  XP ou saldo já ganho; não muda bônus de fase/nível, preços, unlocks, limites ou metas.
- **1500 turnos ativos:18/18, exit0**, duas execuções byte-idênticas. Rede1130 (950–1450),
  rendaL50=123.527 (98.000–152.000), spend74,07% (70–99%). Seeds extras20260918/19 também18/18.
  Renda14.679.360/gasto10.873.220/saldo3.806.140;**27 trilhas** maximizadas.
  Gasto inalterado, renda−8.069.590. Receita tardia por turno vira platô, não crescimento
  garantido a cada restaurante. Campanha sem rewarded/offline, agenda ausente separada intacta.
- **672 testes/29 arquivos;14/15 gates (C# SKIP);53 capturas;157+44 vetores.** Novo teste
  de1500 turnos dentro de `npm test` impede que gates curtos escondam novamente esses desvios.
  116 vetores antigos intactos;27 mudam apenas moedas;14 novos de scoring.44 FTUE byte-idênticos.
  FTUE16,1/32,9/38,3s/0 misses/136 moedas. UI mostra a taxa; sem porta de regras C#/Unity.
- Relatório vigente: **[evidence/a06/step4/reopened/README.md](evidence/a06/step4/reopened/README.md)**.
  **A-06.5 não iniciada.** A-06.4 funcional e estes critérios econômicos locais validados;
  revisão das27/F4 global ainda separadas. Sem push/PR/merge/arte/SDK/dispositivo/publicação.

## A-06.4 — integração offline antes do rebalanceamento (histórico)

- **27 trilhas integradas**, incluindo Caixa/Gerente/Logística. Âncora real e snapshot
  por ausência; restaurante3, cap8h acumulado, rampa20min, multiplicador aditivo até2,18×.
  Caixa antecipa2/4/6/8h no retorno; resto manual conservado. Cooldown30min entre novos
  lotes, não entre parcelas. High-water, ID/claims e migração sem renda histórica.
- Browser pausa turno oculto/retorno pendente, persiste carteira+XP+claim em um JSON antes
  de publicar estado, preserva parcela ao fechar/recarregar e mostra anúncio indisponível.
  Storage-fault/retry e reabertura pelo Home exercitados por ponteiro. Save5; economy13,
  employees4; schemas/DTOs/cópias sincronizados, **não porta de regras C#**.
- **649 testes/27 arquivos;14/15 gates, C# SKIP;52 capturas;143+44 vetores.**135 casos antigos
  intactos,1 expandido,7 novos de ledger;44 FTUE byte-idênticos. FTUE0 misses/136 moedas.
  Preços/moedas/crescimentos/máximos/deltas e níveis históricos preservados.
- Campanha1500 natural **sem offline**:15/18, exit1, repetição idêntica. Renda22.748.950,
  gasto10.873.220, saldo11.875.730. Falham Rede881, rendaL50=183.646, spend.4779657962.
  Sinks novos2.405.090, nenhum retuning. Ausências medidas em24 fixtures separadas com
  agenda explícita, não usadas para tornar a campanha verde.
- Gerente só18% offline/nível; missões/descontos/VIP+2pp backlog. Browser não é servidor
  antifraude. XP offline compartilha o caminho do sim-core; XP ativo legado do browser e
  metaprogressão completa continuam dívida F10. Nenhuma prova de Unity/dispositivo/SDK.
- Evidência **[evidence/a06/step4/README.md](evidence/a06/step4/README.md)**.
  Próximo **A-06.5**, revisão final das27 trilhas/contratos e consolidação dos desvios.
  A-06/F4 ainda abertos; sem commit/push/PR/merge/CI remoto/arte nova.

## 1. Missão e regras obrigatórias

Você está no repositório **`berger33/game_churrasqueiro`**, jogo **CHURRASCO! O Mestre da
Brasa**, Android portrait, Unity 6 LTS como destino. Hoje existe uma referência TS e
protótipo web; **ainda não existe um jogo Unity publicável**.

**Seu próximo trabalho é F3/A-06.5: revisão final das27 trilhas/contratos. A-06.1–4
estão concluídos localmente; contrato mecânico/histórico já aprovados, não perguntar de novo.**
A-03/A-04/A-05 estão funcionais localmente. Não refaça A-01–A-05 nem reabra suas decisões.
Sem arte nova, porta de regras C# ou Unity.

1. Trabalhe **somente na branch atribuída à nova sessão**. Não reutilize/recrie a branch
   de uma sessão anterior; este checkpoint foi feito em `arena/01a0e099-game-churrasqueiro`.
   Não troque/crie branches se a plataforma fixa a branch da sessão.
2. Leia integralmente README, docs/18, docs/22, docs/23-AUDITORIA, docs/23-PLANO e este
   handoff. Consulte os documentos de regras/economia/UX conforme os contratos envolvidos.
3. Reproduza o defeito e crie regressão que falha **antes** de corrigi-lo. Referência TS
   e dados primeiro; não portar defeitos para C#.
4. Não retune preços, recompensas, tempos ou limites apenas para deixar guardrails verdes.
   Não enfraqueça schemas/testes/gates nem aceite vetores só porque foram regenerados.
5. Preserve o FTUE determinístico, os desbloqueios A-02 e as decisões de produto abaixo.
6. Mantenha código, testes, docs e evidências sincronizados; preserve o histórico do plano,
   distinguindo concluído, em curso, bloqueado e pendente. Um checkpoint por vez.
7. A autorização de merge anterior vale **somente para PR #14**. Mudanças da nova sessão
   precisam de nova autorização antes de merge. Nenhum merge automático de PR #7/#8.
8. Sem credenciais reais no Git/chat; sem `npm audit fix --force` sem revisão de major.
   Publicação e testes de dispositivo exigem artefatos/brutos reais, não alegações.

## 2. Git, PRs e limpeza acordada

- Base já integrada: **PR #14**, F1 + F2 + A-01 + A-02:
  https://github.com/berger33/game_churrasqueiro/pull/14
- A-03/A-04/A-05: mudanças locais desta sessão, ainda sem PR/push/CI remoto. Não alegar que
  estejam em `main` antes de conferir o Git. CI da base: run36287025604 em e50ce15.
- A arte anterior entrou pelo PR #13; merge base conhecido:
  `4fe4f4ff20b11cfd625b0f65f7c4944701e373b9`.
- Cabeça funcional/documental antes deste fechamento: `7a591f3`.
  A-02: `8d6fbde` código/testes/vetores; `44ccf11` docs/evidências; `7a591f3` CI.
- O dono escolheu **apagar apenas branches integradas e preservar os PRs #7 e #8**.
  Não fechar nem apagar essas duas branches sem nova decisão/revisão:
  - PR #7: `arena/01a0daed-game-churrasqueiro`, SHA
    `1874270c0464c24e659e5edac9a0a03b00569d37`.
    Progressão/brasas, carvão e paridade econômica C#: conteúdo ainda não revisado.
  - PR #8: `arena/01a0de76-game-churrasqueiro`, SHA
    `021cc2f2718cfff451659409432f1431c2318a5d`.
    Propostas antigas de arte/grelhas: comparar com os assets já aprovados.
- Limpeza autorizada após conferir os merges: branches dos PRs #12
  (`arena/01a0dfd3-game-churrasqueiro`), #13 (`arena/01a0e001-game-churrasqueiro`) e #14.
  `main` e branches #7/#8 devem permanecer. A branch local da sessão anterior pode continuar
  existindo naquele workspace; não confundir com branch remota preservada.

### Antes de editar

- `git status`, identificar branch da sessão, `git fetch origin --prune`.
- Usar `gh` para confirmar **PR #14 MERGED**, SHA do merge, CI e ancestralidade em
  `origin/main`/base da nova sessão. A-03/A-04/A-05 podem estar só no working tree: preserve-os.
  Se houver divergência, relate; não suponha que este handoff substitui o estado real.
- Conferir PRs #7/#8 ainda abertos e branches preservadas. Usar `git` para operações
  locais e `gh` para PRs/checks; nunca pedir tokens/senhas.
- Registrar baseline e diferenças em relação aos números abaixo.

## 3. O que já está feito

### Arte e F1 — concluídos

- Todos os 33 assets pendentes foram substituídos/aprovados nos lotes 08–11.
- Registro: **244 approved, 0 pending, 1 superseded**; runtime **244 sprites /3,98 MB WebP**.
  Cobertura: 16 comidas, 7 fundos, clientes, grills, ícones e arte de metajogo.
- `check-art-registry` integrado aos 15 gates: masters/CSV/lotes/manifest/runtime,
  sem órfãos, approved-only e baseline nominal de **244 IDs protegidos**.
  **52 testes**, incluindo 46 negativos. Não regenerar esse baseline para esconder remoções.
- Aprovar/embarcar assets **não implementou** coleção, eventos, loja, passe, mapa etc.
- Nenhum novo lote de arte é necessário para o próximo checkpoint.

### F2 — A-07/A-08/A-09 corrigidos

- **A-07:** `restaurantsUnlocked` começa em1, passa por2..7, atribui index+1 sem acumular.
  Saves v1/v2/v3 normalizados **depois de validar o CRC original**, sem mudar shape/v3,
  carteiras/conquistas nem outros contadores. Commit `5803806`.
- **A-08:** queimado contado uma única vez na transição onBurn; não duplicar ao servir
  ou descartar. Não inventar correção de histórico sem diário por item. `f2958d6`.
- **A-09:** `result()` puro/idempotente, bônus e arredondamento no retorno, eventos e
  counters independentes; leitura no meio do turno não modifica/congela a simulação.
  Regressões 745→842 e FTUE86→127 eliminadas. `02e7f61`.
- Limites: save não serializa turno ativo; `applyTurnResult`/carteira continua responsabilidade
  de concessão **uma vez** pelo chamador, não existe ledger idempotente de resgates.

### F3/A-01 — funcional corrigido; aceite econômico global pendente

- **Decisão explícita do dono:** costela/cupim mantêm **`sides:2`, `flipNeeded:true`**.
  A recomendação de `sides:1` foi **rejeitada**. Não pedir essa decisão novamente.
- Ingredients v6; validador TS protege receita grill multi-face; bot já consome o flag.
  Sem tuning de fórmulas, calor, tempos, janelas ou preços.
- Testes de janelas reais em três zonas, cru→queimado sem virar e bot nos restaurantes3–6.
- UI: bancada paginada de8, dica contextual espera dourar, hit-test seleciona o prato
  mais próximo entre alvos sobrepostos sem encolher área. C-06 só parcialmente resolvido.
- Oito vetores avançados adicionados; curva complementar com8 seeds por skill/tier.
  Evidências completas em **`docs/evidence/a01/`**. Implementação `579c846`.

### F3/A-02 — funcional corrigido

- **`TurnConfig.playerLevel` obrigatório**, inteiro positivo, separado de `levelId/index`.
  Snapshot no começo do turno; catálogo exige **nível E restaurante**.
- Pedidos naturais/roteirizados, estoque canônico, bot e UI respeitam esse catálogo.
  Config sem menu falha; unusualOnly só sorteado com receita elegível não comum;
  forçar cliente sem menu gera erro, não pedido vazio/conteúdo bloqueado.
- Callers: progressão p.level antes do crédito; protótipo meta.level; FTUE1.
  Curva skill começa com `newPlayerState` por skill e acumula XP real via regra,
  sem compras/upgrades. Nunca inferir nível do jogador pelo índice da campanha.
- Fixtures de mecânica isolada usam44 explicitamente; **não existe fallback44 de produção**.
- 50 regressões novas +2 wiring; teste de validação existente fortalecido.
  UI real nos níveis1/5/6/7: queijo aparece/é arrastável exatamente6, sem hitbox fantasma.
- A-02 não alterou dados, schemas, Assets/Data, savev3 ou tipos C# gerados.
  Relatório expõe nível/restaurante reais, catálogo e ingredientes efetivamente pedidos.
- Evidências: **`docs/evidence/a02/`**, inclusive red-rules/data/wiring/UI, logs longos,
  `vector-review.json` e `progression-sample.json` (60 turnos/XP/pedidos).

### F3/A-03 — funcional corrigido localmente, CI do patch pendente

- Estoque prep inerte até `startPrep`, vagas por restaurante+tábua; faca reduz duração
  `prepSec / prepSpeedMult`. Pronto segura a vaga até servir/descartar, inclusive no drag.
- API de turno rejeita prep na grelha, serviço prematuro/duplicado/pedido errado. Apenas
  porções admitidas avançam, sem fila invisível. `auxiliar` ainda não automatiza preparo.
- UI nível12+ permite toque (primeira vaga) ou drag (vaga escolhida), progresso/PRONTO,
  arrastar ao pedido, descartar na bancada e cancelar sem consumir. Até10 vagas paginadas;
  desenho/hitboxes compartilham geometria>=48. Seis textos pt/en/es, arte/áudio existentes.
- 18 testes novos + teste antigo prep exige início explícito. Red15/16 regras,2/2 layout,
  bundle antigo falha no12. Pedido misto/paciência/combo/recompensas em regra; UI serve
  pedido natural via ponteiro, cobre11/12/13, capacidade/cancelamento/descarte/vizinhos.
- Bot chama estação, mas mantém uma porção ativa por ingrediente; não mede ganho marginal
  de vagas extras. A-06 precisa reavaliar tábua/sinks. A-15 de grelha continua aberto.
- 106+44 vetores e levels intactos. Primitivas genéricas `cooking.ts`/C# não mudaram;
  antigo fixture sintético `flip.vinagrete` não representa ação legal de turno.
- Evidências red/green/base/limites: **`docs/evidence/a03/`**. Novas capturas20–24
  regeneráveis via `check-shots`, ignoradas no Git. Sem C#/Unity/arte nova/retuning.

### F3/A-04 — funcional corrigido localmente, decisões ENCERRADAS

- Dono escolheu implementar4 zonas, **exigir Fornalha E Premium**, e **média extra1×**.
  Rejeitou ampliar qualquer equipamento. Não perguntar novamente nem implementar unlock
  universal. Fornalha nas3 evoluções ganha4 no restaurante4+; antes fica3. Outros1/2/3.
- `grill`v4 adiciona `medium_extra` com `auxiliaryOf:medium`; `churrasqueiras`v2 só declara
  `restaurantExpansion:{restaurantIndex:4,zoneCount:4}` na Fornalha. Default avançado tem4.
- Perfil primário/IDs/calor/bonus não mudam. Extra recebe bônus da média; base evo3
  0,891/1,62/1,70/1,62. Teto1,7 é base equipada, não clamp do calor com upgrades/carvão.
- Contagem resolvida antes da criação/patch. Construtor rejeita inválidos; genérico2 zonas
  agora é baixa/alta, alinhado ao equipado. Validação protege expansão/fonte/marca auxiliar.
- Home/HUD/arte/drop/hitbox compartilham4 reais, rótulos localizados; sprite aprovado
  permanece, sem lote novo. Ponteiro coloca/move/vira/serve pedido natural na quarta.
- 42 regressões novas;41 regras/dados e1 caller sim. `LevelOutcome.grillSnapshot` expõe
  contexto real/ocupação após política. Casos negativos usam `structuredClone(db)` pois
  `loadDatabase` é cacheado; não contaminar testes seguintes.
- 2 schemas/2 tabelas Assets/Data+manifest/2 DTOs C# regenerados e revisados. **Sem porta
  de regras C#**; consumo de auxiliar/expansão ainda deve ser feito em F8.
- 106+44 vetores:8 avançados ganham contagem/calores,3 resultados skill.55/rest4–6 mudam,
  demais payloads e FTUE idênticos. Gerador usa as zonas reais do restaurante1 fixado,
  não uma quarta inválida nesse fixture. Levels sem diff. `vector-review.json` descreve tudo.
- Evidências completas em **`docs/evidence/a04/`**, incluindo29 PNGs regeneráveis,
  probe128 turnos avançados antes/depois e amostra de hardware no sim1500.

### F3/A-05 — funcional corrigido localmente, decisões ENCERRADAS

- Dono escolheu **por chegada**, **2 visitas/dia compartilhadas**, **UTC**, **chamado
  simulado explícito na Home**. Não perguntar novamente. Chance explícita do nível manda;
  zero bloqueia natural, ausente usa6%. Fim de semana +4pp só sobre base positiva.
  Restaurante inicial bloqueado; fonte não muda recompensa/menu/tolerância.
- `vip.ts` consome events/ads/achievements. RNG VIP separado (`seed ^ 0x71f5`), só quando
  elegível/com vaga/cota. Reserva prioritária ocupa cota até chegar, inclusive no dia seguinte.
  Não expira recompensa já concedida; TTL1h é da oferta/callback. Cooldown60min/placement
  respeitados; cancelamento/duplicata não concedem. Perder cliente/abandonar turno não devolve
  visita. Chamadas diretas/roteiro VIP não podem burlar ledger.
- Save de referência **v4**, `player.vip`: migração preserva carteira/FTUE/CRC. Ledger
  ausente v3 é novo; ausente/inválido v4 bloqueia VIP, não zera carteira. Browser mantém
  `churrasco_meta_v2` com campo novo, **não usa envelope CRC**. Clock rollback não reseta
  cota; sem servidor/antifraude contra editar storage ou adiantar relógio repetidamente.
- `vipServed` conta pedido inteiro uma vez. Só conquistas com stat vipServed (VIP1/25)
  têm consumidor; recompensas originais1000+3/15000+30. **Claims em player.vip devem ser
  consultados/migrados pelo futuro avaliador geral para não pagar de novo**. B-08 aberto.
- UI por ponteiro cancela/conclui/reserva/reabre/cozinha/vira/serve e confirma progressos.
  Usa áudio/retrato aprovados; analytics locais vip_arrival/vip_served + rewarded_*
  network prototype_test. Não há anúncio/cobrança reais nem prova de áudio em dispositivo.
- 44 testes novos red→green, caller real compartilha ledger/clock/chance; validação de
  configs, fronteiras, migração e idempotência. Sim longo default **sem rewarded**; snapshots
  expõem visitas, fontes, quota, moedas de pratos. `vip-report.ts` compara3 campanhas e864
  turnos de skill; A-04 é reproduzido exatamente com VIP desativado.
- 114+44 vetores:20 resultados antigos iguais+2 counters zero;8 novos casos VIP com
  ledger/UTC/cota/fontes explícitos.44 payloads FTUE iguais, só metadata analytics5→6.
  Versões customers/events/ads/achievements registradas. Schema/tabela analytics+manifest
  sincronizados; gerador C# sem novo diff. **Nenhuma regra/save C# portada.**
- Evidências em **docs/evidence/a05/**, capturas30–37 ignoradas/regeneráveis. LiveOps
  completo, demais modificadores/banners reais, sistema geral de conquistas e SDKs pendentes.

### F3/A-06.1–2 — compras, efeitos diretos e recursos (histórico)

Ler **evidence/a06/step2/README.md** e contrato/decisões.20 ativas/7 pendentes; catálogo27,
preços/gates UI/serviço/bot comuns, níveis antigos preservados sem reembolso. Capacidade/Mesas
somam à base; Mestria só gorjeta, Clientela paciência. Recursos agora reais: qualidade/piso,
estabilidade/recuperação, uma tentativa automática33/66/99% a22% por saco, RNG separado;
calor zero na falta/reposição2,2s. Estoque6+Balcão por ingrediente, débito só admissão,
reposição explícita3s grátis com jogo continuando. Bot compartilha ação e não cria órfãos.

Savev4/CRC sem migração; browser raw metakeyv2 mantém níveis/purchaseCounters, não inventa
recibos. Reservas/timers/flag de saco são runtime; não existe retomada persistente de turno.
Dados grill5/upgrades4; apenas novo bloco stock/rename de stat, preços/máximos intocados.
Schemas/DTO Grill/cópias gerados não constituem porta de regras C#. Legado heatStability
continua dívida A-13/F5. A-06.3/4/5, F4 e F10 seguem pendentes.

### F3/A-06.3 — equipe/Bandeja entregues localmente (vigente)

Ler **evidence/a06/step3/README.md** e contrato §4.5.24 ativas/3 pendentes offline.
`StaffRuntime` usa operações reais: Garçom serve desde bom/prep pronta, cliente>1,5s,
FIFO cliente/porção;1,5s por viagem/Bandeja reduz a1s; nível5 até2 porções. Gorjeta auto5/10%
só no termo de gorjeta, não receita-base/XP. Aviso3+ de queima em~1s pela física corrente,
sem salvamento. Auxiliar só demanda prep não coberta, chance/cadência da tabela, estoque/vaga,
RNG próprio e uma vaga extra3+. Churrasqueiro só sinal público.55, nunca zona/perfect timing.

Caps `floor(cobertura × elegíveis distintos)` por turno, incluindo manual; nada de frames,
crus/queimados ou falhas gerando crédito. Sem catch-up em rajadas. UI mostra ações/caps/alerta,
pointer compra/reabre e prova ações reais. FTUE explicitamente manual. Stock/refill A-06.2
preservados; Auxiliar não repõe estoque/carvão ocultamente. No sim:64.715 serviços,29.630
viradas,147 preparos; caps conferidos por turno. Perfeitos caem42,2%, não retunamos para esconder.

employees3/grill6, schemas/DTOs/cópias gerados, nenhuma regra C# portada. Savev4/CRC/browser
meta v2 mantidos, níveis sem reset/reembolso; chegada, budgets, timers e RNG são runtime,
não retomada persistida nem sistema offline. Harness compartilha pixels nativos imutáveis
por URL entre relaunches;49 casos mantidos, mesmo decoder real e orçamento60s.

## 4. Baseline de testes e limitações

- Ambiente verificado: **Node22.22.3/npm10.9.8**; projeto exige Node>=22.
- Checkpoint histórico A-06.3: **615 testes passando**,26 arquivos; **14/15 gates locais** (C# SKIP sem dotnet).
- **CI remoto deste patch pendente.** CI da base não prova o código novo. C# ainda diverge
  em carvão esgotado e não tem equipe/gorjeta automática;50 turnos+5 casos econômicos sem
  port. Nenhuma porta de regra nesta etapa; DTO gerado é somente contrato de dados.
- **136 vetores +44 FTUE**, principal formatov2. Todos127 payloads anteriores intactos;
  9 turnos novos com métricas de staff, versões grill6/employees3.44 FTUE byte-idênticos.
  Review em `evidence/a06/step3/vector-review.json`; não regenerar para esconder drift.
- **49 screenshots**,244 sprites; FTUE16,1/32,9/38,3s/zero misses/136 moedas.
  Ponteiro compra/reabre equipe, vira1/2 sem mover, combina gesto manual, inicia prep na vaga
  real, paga serviço e avisa risco antes da queima. Anteriores recursos/fila/VIP preservados.
  Fixtures avançadas não provam metaprogressão natural completa ou dispositivo.
- Apenas60 níveis autorais (restaurantes0/1); não confundir o endless headless com fluxo
  avançado de campanha já implementado na UI.
- Não há `Packages/`, `ProjectSettings/`, cenas/prefabs, APK/AAB ou validação física Unity.
- npm audit: **5 vulnerabilidades (1 crítica,1 alta,3 moderadas)** na cadeia tooling
  Vitest/Vite/vite-node/mocker/esbuild transitivo. Major sugerida precisa de revisão F6.
- Actions checkout/setup-node/setup-dotnet v4: aviso Node20 forçado para24; runner
  ubuntu-latest anuncia Ubuntu26 a partir de19/10/2026. Projeto continua Node22.
- Nightly manual foi negado403 pela permissão da integração. Evidência do sim longo é
  **local**, repetida/idêntica; não inventar run remoto. Não pedir credenciais.

## 5. Economia conhecida — NÃO estabilizada

Seed20260917,1.500 turnos,dt1/12,12 turnos/dia,UTC2026-09-21; natural sem rewarded/offline;
L80/rest6/Fornalha3. **evidence/a06/step3/economy-comparison.json**.

| Métrica | A-06.2 | A-06.3 histórico |
|---|---:|---:|
| Renda |24.816.326|23.263.609|
| Gasto |8.089.550|8.468.130|
| Saldo |16.726.776|14.795.479|
| Spend |.3259769395|**.3640075794 — falha**|
| Perfect/burned/perdidos |75,4%/0,1%/3,2%|42,2%/0,1%/2,3%|
| Restaurantes |42/95/162/256/403/670|42/96/168/272/422/**729**|
| Grills |11/43/84|11/43/87|
| Renda diária L5/L15/L30/L50 |10.614/37.358/115.079/210.171|10.614/39.317/114.899/**189.197**|

**15/18, exit1**, repetição byte-idêntica. Falham rede729 vs950–1450, L50=189.197
vs98.000–152.000, spend.364 vs.70–.99. Novas trilhas gastaram378.580 (capacidade exata).
24 ativas maximizadas somam3.953.530;3 bloqueadas2.405.090;27 seguem6.358.620. Renda−1.552.717,
saldo−1.931.297. Serviço desde bom explica a direção da queda de perfeitos; valores agregados
misturam ações/progressão, não causalidade por trilha. Não esperar perfeito para maquiar renda.
VIP244/238, conquistas16.000; duração173,7s. Sem renda offline fictícia na campanha.
Caps por turno verificados:64.715/130.902 serviços,29.630/132.459 viradas,147 preparos.
Auxiliar disputa demanda com bot, por isso aciona pouco; controles sem bot provam consumo.
Curva autoral sem compras45,6% no skill.55. Sim curto ainda PASS/skip em metas não alcançáveis
(dívida F5); F4 só após A-06 completo. Não afrouxar alvos ou retunar preços.

## 6. Próximo passo concreto — A-06.5/revisão final das27 trilhas

**A-06.0–4 concluídos localmente.** Ler contrato aprovado, decisões e
`docs/evidence/a06/step4/README.md`. Não sobrescrever evidência histórica.

1. Conferir Git real e preservar todo o patch. Não publicar/portar regras C#/Unity.
2. Revisar mapa final das27 trilhas: preço/moeda/unlock/nível → consumidor real → teste,
   incluindo contratos de dados, UI por ponteiro, compra/persistência e histórico preservado.
3. Distinguir ativação funcional de aceite econômico. Campanha ativa1500 sem rewarded/offline
   agora passa18/18 após rebalanceamento autorizado (§vigente acima); preservar curva/metas
   e usar o cenário separado de ausências, não injetar renda na campanha ativa.
4. Rever docs/promessas de funcionários: Gerente somente18% offline; extras backlog. Não
   ampliar escopo nem reabrir virada/quarta zona/VIP/offline3. Preservar FTUE/recursos/caps.
5. Se surgir defeito, reproduzir e escrever red antes de corrigir; revisão de vetores explícita.
   Sem retuning de preços/recompensas/tempos/metas para tornar guardrails verdes.
6. Expor limites: storage/relógio local não é autoridade; C# SKIP não é PASS; UI avançada usa
   fixture; XP ativo legado do browser e metaprogressão seguem F10. Offline usa XP do core.
7. Executar gates e sim:long, consolidar docs18/23/24 e evidências. A-06.5 não encerra F4
   automaticamente nem autoriza merge, arte, SDK ou porta.

## 7. Tudo que ainda falta, na ordem vigente

A auditoria tem47 achados originais (9 altos,19 médios,19 baixos). F2 está corrigida;
A-01–A-05 funcionais, economia global pendente; **A-06 ainda aberto**.
Plano autoritativo: `docs/23-PLANO_IMPLEMENTACAO.md` §9 (não usar a ordem histórica antiga).

1. **F3/A-03 concluído localmente:** conferir preservação do patch e CI quando enviado;
   não refazer o fluxo. Ver seção3 e evidence/a03.
2. **F3/A-04 concluído localmente:** decisões Fornalha E Premium/média extra1× já
   confirmadas e implementadas; não refazer. Manter a limitação medida do sim visível.
3. **F3/A-05 concluído localmente:** decisões aplicadas e evidência em evidence/a05.
   Não refazer. Manter quota/reserva/savev4/claims VIP e limites de antifraude/SDK visíveis.
4. **A-06 —27 trilhas:** consumidores implementados em A-06.1–4; falta revisão final
   A-06.5 (§6), preservando níveis sem reembolso. Revalidar sinks/spend sem aumentar
   preços só para voltar ao verde.
5. **F4 — revalidação global:** após A-06, revisar dados/levels/vetores, guardrails,
   economia e decisões de design. Publicar renda/unlocks/spend/perfect/burned/lost,
   duração/grills, com logs brutos. Os3 desvios da campanha de referência foram resolvidos
   em A-06.4; isso não aprova automaticamente todos os demais cenários econômicos.
6. **F5 — dívida média/baixa e contratos:** triagem completa da auditoria (19+19).
   Priorizar carvão; ledger de brasas; offline; deriveStats/clamps; burned com overrides;
   vazamento do bot; streak/dia de graça; campos mortos; gating de funcionários;
   descrições/l10n; avaliadores de missões/conquistas; level-up; guardrails ignorados;
   divergência de levels commitados; skips de C#. Testes negativos por item e registro
   explícito do que fica para serviços/dispositivo. Confirmar escolhas de streak/offline.
7. **F6 — tooling/security isolados:** revisar releases de Vitest/Vite/esbuild e Node,
   atualizar majors conscientemente, audit antes/depois e suíte completa/sim/render/C#.
   Separar de mudanças de gameplay. Sem force-fix; revisar actions/runner também.
8. **F7 — PRs #7/#8 preservados:** revisar por tema contra main, classificar
   útil/obsoleto/conflitante, extrair/reimplementar seletivamente com testes.
   Não fazer merge direto; fechar/apagar somente após revisão/decisão registrada.
9. **F8 — C# completo:** só com TS/dados/economia estabilizados. Portar TurnSimulation,
   EconomyRules, SaveSystem v4/migrações e cola completa TutorialTurn. Cobrir os35 turnos
   +5 econômicos, regressões F2/A-01/A-02 e futuros fixes. netstandard2.1/C#9,
   warnings=erros, **zero not ported**, não apenas os139 checks existentes.
10. **F9 — Unity6 LTS:** criar Packages/ProjectSettings/assemblies/scenes/prefabs/.meta;
    importer do manifesto/AssetPostprocessor/atlases; GrillView/FoodView/CustomerCardView/
    TurnFlow; input/UI/áudio/save/l10n. Turno completo no Editor e60FPS em Android físico.
11. **F10 — meta, localização e acessibilidade:** coleção/missões/conquistas/eventos/
    loja/passe/rota e progressão real; en-US/es-419 além dos123/572 keys (21,5%, fallback);
    texto/contraste/ponto sem depender de cor/redução de movimento/toque/telas pequenas.
12. **F11 — serviços:** SDKs reais Firebase/Crashlytics/RemoteConfig, UMP/consentimento,
    ads/billing com projetos/IDs de teste, caps/cooldowns, recibos/restauração/offline,
    LGPD/Data Safety. Serviços atuais são stubs; não foram validados no Unity real.
13. **F12 — áudio/performance/QA:** mix/ducking, interrupções/background, save/migração/
    reinstalação/offline, memória/GC/draw calls/atlases/tamanho AAB, matriz física de
    aparelhos/GPUs; medir60FPS/crash-free, não substituir por teste canvas.
14. **F13 — publicação segura e comprovada:** pipeline assinado APK/AAB, closed testing
    reproduzível, brutos/vídeos/AAB, PlayConsole/consentimento/privacy/DataSafety, screenshots
    reais/ASO, KPIs e rollout gradual com rollback. `docs/21` alega n=20/closed track,
    mas faltam artefatos para reproduzir: não repetir essa alegação como prova atual.

## 8. Comandos e evidências para começar

```sh
node --version
npm --version
npm ci
npm run gates
npm run sim:long                 # baseline conhecido: exit1, três falhas; investigar drift
npx vitest run tools/studio/test/vip.test.ts tools/studio/test/sim-grill.test.ts
npm run check-vectors
npm run check-shots              # prototype/shots/, artefatos ignorados pelo Git
node --experimental-strip-types tools/studio/vip-report.ts
npm audit --fetch-timeout=15000 --fetch-retries=0
```

- Só executar `gen-vectors`, `gen-levels`, `gen-schemas`, tipos C# ou sync-data quando a
  mudança exigir; revisar o diff, não usar regeneração como substituto de análise.
- Logs A-01–A-06.4 estão em `docs/evidence/` (o patch atual ainda não foi commitado). `/tmp` e arquivos ignorados de
  outra sessão não são evidência persistida garantida; reproduzir o que precisar.
- Para preview, usar o servidor do protótipo em0.0.0.0, URLs relativas e host permitido;
  ferramentas de processo para servidor persistente, não bash bloqueante.

**Comece conferindo o Git e preservando A-03/A-04/A-05/A-06.1–4. Leia contrato/decisões e
step4/reopened/README; não repita a escolha late_income; faça A-06.5 quando autorizada. Não reabra escolhas de virada/quarta zona/VIP,
não apague PRs preservados e não mascare falhas econômicas.**
