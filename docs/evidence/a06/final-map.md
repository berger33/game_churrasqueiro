# A-06.5 — Mapa Final das 27 Trilhas de Upgrade

**2026-09-27 · Revisão Final Concluída e Validada Localmente.**
Todas as 27 trilhas de upgrade declaradas em `shared/data/upgrades.json` possuem consumidores reais no runtime, testes de regressão automatizados, cobertura de UI por ponteiro, persistência de histórico e validação de contratos.

**Status:** 27 trilhas integradas (`UPGRADE_PHASES` = `active`). **0 no-ops. 0 trilhas bloqueadas.**
Capacidade total de sinks de upgrade maximizados: **6.358.620 moedas**.
Campanha de 1500 turnos ativos: **18/18 metas PASS, exit 0** (sem rewarded e sem injeção offline).

---

## Matriz Completa das 27 Trilhas

| # | Trilha (`id`) | Categoria | Nome (pt-BR) | Custo Base / Crescimento / Nível Máx | Custo Total (moedas) | Efeito por Nível (`delta` / `stat`) | Desbloqueio (Gating) | Consumidor no Código | Testes Automatizados |
|---|---|---|---|---|---:|---|---|---|---|
| 1 | `grill_size` | grill | Grelha Maior | 180 / 1,62 / 8 | 13.480 | +1 `slotsPerZone` | Inicial (Restaurante 0, Nível 1) | `cooking.ts:deriveStats` / `turn.ts:canPlaceOnGrill` / `prototype/src/main.ts` | `cooking.test.ts`, `upgrades.test.ts`, `cooking-ui.test.ts` |
| 2 | `grill_heat` | grill | Brasa Mais Forte | 220 / 1,60 / 8 | 15.380 | +0,06 `highZoneMultiplier` | Inicial | `cooking.ts:deriveStats` / `effectiveHeat` | `cooking.test.ts`, `resources.test.ts` |
| 3 | `grill_stability` | grill | Grelha Estável | 260 / 1,66 / 6 | 7.850 | +0,04 `heatStability` (recupera 4% perda) | Inicial | `cooking.ts:deriveStats` / `charcoalEfficiency` | `resources.test.ts` |
| 4 | `grill_speed` | grill | Brasa Constante | 300 / 1,68 / 6 | 9.470 | +0,05 `heatRampRate` | Inicial | `cooking.ts:deriveStats` / `tickGrill` | `cooking.test.ts` |
| 5 | `charcoal_duration` | charcoal | Carvão Duradouro | 150 / 1,55 / 10 | 21.560 | +0,09 `charcoalDurationMult` | Inicial | `cooking.ts:deriveStats` / `tickGrill` | `cooking.test.ts`, `resources.test.ts` |
| 6 | `charcoal_quality` | charcoal | Carvão Premium | 340 / 1,63 / 6 | 9.570 | +0,05 `minCharcoalEfficiency` (piso) | Inicial | `cooking.ts:deriveStats` / `charcoalEfficiency` | `resources.test.ts` |
| 7 | `charcoal_auto` | charcoal | Acendedor Automático | 1200 / 1,90 / 3 | 7.810 | +0,33 `autoRefillChance` (33/66/99%) | Inicial | `cooking.ts:deriveStats` / `turn.ts:tick` (t<=0,22) | `resources.test.ts` |
| 8 | `knife` | prep | Faca Afiada | 140 / 1,50 / 6 | 2.910 | +0,12 `prepSpeedMult` | Receita prep liberada (`recipe_locked`, Nível 12+) | `cooking.ts:deriveStats` / `turn.ts:startPrep` | `prep.test.ts`, `upgrades.test.ts` |
| 9 | `board` | prep | Tábua de Preparo | 200 / 1,58 / 5 | 3.060 | +1 `prepSlots` | Receita prep liberada (`recipe_locked`, Nível 12+) | `cooking.ts:deriveStats` / `turn.ts:prepSlotsCapacity` | `prep.test.ts`, `upgrades.test.ts`, `prep-ui.test.ts` |
| 10 | `counter` | prep | Balcão Largo | 420 / 1,62 / 5 | 6.880 | +1 `rawStockCapacityPerIngredient` (6..11) | Inicial | `cooking.ts:deriveStats` / `turn.ts:rawStockCapacity` | `resources.test.ts`, `upgrades.test.ts` |
| 11 | `plates` | service | Mais Pratos | 160 / 1,52 / 6 | 3.480 | +0,06 `tipMult` | Inicial | `cooking.ts:deriveStats` / `scoreItem` | `economy.test.ts`, `upgrades.test.ts` |
| 12 | `tray` | service | Bandeja Grande | 280 / 1,60 / 5 | 4.440 | +0,10 `serveSpeedMult` (viagem 1,5s -> 1,0s) | Garçom >= 1 (`dependency_locked`) | `cooking.ts:deriveStats` / `staff.ts:tick` | `staff.test.ts`, `upgrades.test.ts` |
| 13 | `patience_charm` | service | Ambiente Agradável | 520 / 1,70 / 5 | 9.790 | +0,07 `patienceMult` | Inicial | `cooking.ts:deriveStats` / `turn.ts:spawnCustomer` | `turn.test.ts`, `upgrades.test.ts` |
| 14 | `tables` | restaurant | Mais Mesas | 600 / 1,72 / 6 | 20.740 | +1 `tables` / +1 `maxOrdersOnScreen` | Inicial | `cooking.ts:deriveStats` / `turn.ts:spawnCustomer` | `upgrades.test.ts`, `upgrade-ui.test.ts` |
| 15 | `decor` | restaurant | Decoração | 480 / 1,66 / 6 | 14.490 | +0,05 `tipMult` | Inicial | `cooking.ts:deriveStats` / `scoreItem` | `economy.test.ts`, `upgrades.test.ts` |
| 16 | `lighting` | restaurant | Iluminação | 700 / 1,68 / 4 | 7.180 | +0,05 `xpMult` | Inicial | `cooking.ts:deriveStats` / `scoreItem` | `economy.test.ts`, `a06-final-matrix.test.ts` |
| 17 | `capacity` | restaurant | Capacidade | 900 / 1,74 / 5 | 18.180 | +1 `maxOrdersOnScreen` | Inicial | `cooking.ts:deriveStats` / `turn.ts:spawnCustomer` | `upgrades.test.ts`, `upgrade-ui.test.ts` |
| 18 | `sign` | restaurant | Letreiro | 1100 / 1,80 / 4 | 13.060 | +0,08 `customerSpawnRate` | Inicial | `cooking.ts:deriveStats` / `turn.ts:tick` (spawnTimer) | `turn.test.ts`, `a06-final-matrix.test.ts` |
| 19 | `music` | restaurant | Som Ambiente | 640 / 1,60 / 4 | 5.920 | +0,05 `patienceMult` | Inicial | `cooking.ts:deriveStats` / `turn.ts:spawnCustomer` | `turn.test.ts`, `a06-final-matrix.test.ts` |
| 20 | `garcom` | employees | Garçom | 2500 / 1,85 / 5 | 60.800 | +1 `autoServeLevel` (cobertura 20–50%) | Restaurante 1+ (`restaurant_locked`) | `cooking.ts:deriveStats` / `staff.ts:StaffRuntime` | `staff.test.ts`, `upgrades.test.ts` |
| 21 | `auxiliar` | employees | Auxiliar | 4200 / 1,85 / 5 | 102.130 | +1 `autoPrepLevel` (prep auto, +1 vaga nv3+) | Restaurante 2+ E receita prep (`restaurant_locked`, `recipe_locked`) | `cooking.ts:deriveStats` / `staff.ts:StaffRuntime` | `staff.test.ts`, `upgrades.test.ts` |
| 22 | `churrasqueiro` | employees | Churrasqueiro | 8000 / 1,90 / 5 | 211.210 | +1 `autoFlipLevel` (cobertura 20–60%) | Restaurante 3+ (`restaurant_locked`) | `cooking.ts:deriveStats` / `staff.ts:StaffRuntime` | `staff.test.ts`, `upgrades.test.ts` |
| 23 | `caixa` | employees | Caixa | 12000 / 1,90 / 4 | 160.430 | +1 `autoCollectLevel` (auto 2/4/6/8h) | Restaurante 3+ (`restaurant_locked`) | `offline.ts:offlineSnapshot` / `advanceCashierHours` | `offline.test.ts`, `upgrades.test.ts` |
| 24 | `gerente` | employees | Gerente | 25000 / 1,95 / 4 | 354.180 | +0,18 `idleRateMult` (+18%/nv offline) | Restaurante 4+ (`restaurant_locked`) | `offline.ts:offlineSnapshot` / `offlineCredit` | `offline.test.ts`, `upgrades.test.ts` |
| 25 | `brasa_mastery` | prestige | Mestria da Brasa | 2000 / 1,32 / 20 | 1.605.720 | +0,012 `tipMult` (apenas termo de gorjeta) | Inicial | `cooking.ts:deriveStats` / `scoreItem` | `upgrades.test.ts` |
| 26 | `clientela_fiel` | prestige | Clientela Fiel | 2500 / 1,31 / 20 | 1.778.420 | +0,01 `patienceMult` (+1%/nv paciência) | Inicial | `cooking.ts:deriveStats` / `turn.ts:spawnCustomer` | `upgrades.test.ts` |
| 27 | `imperio_logistica` | prestige | Logística do Império | 3000 / 1,30 / 20 | 1.890.480 | +0,02 `idleRateMult` (+2%/nv offline) | Restaurante 3+ (`restaurant_locked`) | `offline.ts:offlineSnapshot` / `offlineCredit` | `offline.test.ts`, `upgrades.test.ts` |

---

## Totalizadores por Categoria

| Categoria | Quantidade de Trilhas | Custo Acumulado (moedas) | Participação no Sink de Upgrades |
|---|---:|---:|---:|
| Grelha (`grill`) | 4 | 46.180 | 0,73% |
| Carvão (`charcoal`) | 3 | 38.940 | 0,61% |
| Preparo (`prep`) | 3 | 12.850 | 0,20% |
| Serviço (`service`) | 3 | 17.710 | 0,28% |
| Restaurante (`restaurant`) | 6 | 79.570 | 1,25% |
| Funcionários (`employees`) | 5 | 888.750 | 13,98% |
| Prestígio (`prestige`) | 3 | 5.274.620 | 82,95% |
| **Total** | **27** | **6.358.620** | **100,00%** |

---

## Contratos de UI, Persistência e Segurança

1. **Loja e Paginação:**
   - 27 cartas navegáveis via botões Anterior/Próximo (3 cartas por página, 9 páginas).
   - Todos os alvos de toque/clique (`Rect`) possuem geometria $\ge 48 \times 48\text{ px}$.
   - Cards bloqueados por nível de restaurante, receita de preparo ou dependência (`tray` -> `garcom`) exibem status visível e botão desabilitado.
   - Níveis históricos são preservados; recompra só é admitida quando saldo e requisitos são válidos.

2. **Persistência (Save Schema v5):**
   - Todos os 27 níveis são serializados no mapa `player.upgradeLevels`.
   - O envelope CRC protege a integridade contra corrupção.
   - O protótipo web utiliza `churrasco_meta_v2` com gravação atômica antes de publicar o estado.

3. **Escopo dos Funcionários:**
   - **Gerente:** Apenas +18% de renda offline por nível. Descontos na loja, rerolls e bônus de VIP permanecem no backlog de F10.
   - **Auxiliar:** Inicia preparo apenas quando houver pedido pendente compatível, estoque disponível e vaga livre.
   - **Garçom:** Serve pratos bons ou perfeitos obedecendo ao teto de cobertura $\lfloor \text{cobertura} \times \text{elegíveis} \rfloor$.
   - **Churrasqueiro:** Vira ao sinal público de virada sem teletransporte entre zonas.
   - **Caixa:** Antecipa 2/4/6/8h de ausência no retorno.
