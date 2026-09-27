# F4 — Revalidação Econômica Global e Aceite dos Guardrails

**2026-09-27 · Concluído e validado localmente.**
Checkpoint de encerramento da **Fase F4** (Revalidação Econômica Global pós A-01–A-09).
Base confirmada: PR #16 integrado (`a900445fe3def248973fc884564a632d829f9c65`), branch de trabalho `arena/01a0e1a4-game-churrasqueiro`.
PRs preservados: **PR #7** e **PR #8** abertos e intactos.
Nenhum preço, recompensa, tempo ou meta foi retunado nesta etapa. Sem arte nova, sem porta de regras C#/Unity, sem publicação.

---

## 1. Resumo Executivo da Revalidação Global

Com a correção funcional de todos os 9 achados altos originais da auditoria técnica (`docs/23-AUDITORIA_TECNICA.md`):
- **F2:** A-07 (sequência de restaurantes), A-08 (duplicação de queimados), A-09 (idempotência de `result()`);
- **F3:** A-01 (virada obrigatória na costela e cupim), A-02 (`playerLevel` e catálogo elegível), A-03 (preparo real na bancada), A-04 (quarta zona na Fornalha e Premium), A-05 (VIP natural com cota e UTC), A-06 (27 trilhas ativas com consumidores reais);

A **Fase F4** consolida o aceite econômico global através de:
1. **Campanha ativa de 1.500 turnos (projeção de ~125 dias de jogo a 12 turnos/dia):**
   - **18/18 metas de balanceamento PASS (exit 0)** na seed canônica `20260917` e repetida byte a byte.
   - **Sensibilidade de seeds extras (`20260918`, `20260919`):** 18/18 metas PASS em ambas.
   - **Campanha estritamente limpa:** executada com zero rewarded ads e zero injeção de moedas de ausência offline (`counters.offlineCoins === 0`, `offline.batch === null`).
2. **Consolidação de Sinks e Faucets:**
   - Renda total gerada: **14.679.360 moedas** (turnos 84,4%, recompensas de fase 14,1%, level up 1,2%, VIP 0,1%, clear 0,1%).
   - Gasto total: **10.873.220 moedas** (desbloqueio de restaurantes 41,1%, 27 trilhas de upgrade 58,5%, churrasqueiras 0,5%).
   - Saldo final não gasto: **3.806.140 moedas**.
   - Razão de gasto (*spend ratio*): **74,07%** (alvo 70,0% a 99,0% — classificado como *healthy*).
3. **Pacing de Estabelecimentos e Equipamentos:**
   - Estabelecimentos: Espetinho de Rua (turno 42), Trailer (turno 96), Bairro (turno 168), Premium (turno 277), Festival (turno 422), Rede Nacional (turno 1130).
   - Churrasqueiras: Zé da Esquina (turno 11), Parrilla Chef Cisma (turno 43), Fornalha Dragão Manso (turno 87).
4. **Combate à Inflação e Crescimento de Longo Prazo:**
   - Crescimento de custo das melhorias (×29,28) supera o crescimento de renda diária L5→L70 (×13,46), garantindo que as compras mantenham relevância.
5. **Cenário de Ausências (Offline):**
   - 24 fixtures declaradas ([absence-schedule.json](absence-schedule.json)) exercitam ausências de 3 dias com rampa de 20 min, cap de 8h, multiplicadores aditivos de até 2,18× e quitação em duas etapas (Caixa + manual).

---

## 2. Tabela de Metas Econômicas (18/18 PASS)

| ID do Guardrail | Valor Medido (Seed 20260917) | Faixa / Alvo | Status | Observação |
|---|---:|---:|:---:|---|
| `turnsPerSession` | 4 turnos | 3 – 5 | **PASS** | Simulação assume 4 turnos por sessão |
| `firstUpgradeAffordableAfterTurns` | Turno 1 | 1 – 2 | **PASS** | Grelha Maior (180 moedas) acessível após o turno inicial |
| `unlock:espetinho_rua` | Turno 42 | 28 – 45 | **PASS** | Desbloqueio do 2º restaurante |
| `unlock:trailer` | Turno 96 | 72 – 115 | **PASS** | Desbloqueio do 3º restaurante |
| `unlock:churrascaria_bairro` | Turno 168 | 115 – 185 | **PASS** | Desbloqueio do 4º restaurante (libera ausência) |
| `unlock:churrascaria_premium` | Turno 277 | 195 – 315 | **PASS** | Desbloqueio do 5º restaurante (libera 4ª zona Fornalha) |
| `unlock:festival` | Turno 422 | 340 – 550 | **PASS** | Desbloqueio do 6º restaurante |
| `unlock:rede_nacional` | Turno 1130 | 950 – 1450 | **PASS** | Desbloqueio do restaurante final |
| `income:level5` | 10.614 moedas/dia | 9.000 – 14.000 | **PASS** | Renda inicial estável |
| `income:level15` | 39.317 moedas/dia | 36.000 – 56.000 | **PASS** | Renda média inicial |
| `income:level30` | 114.415 moedas/dia | 78.000 – 122.000 | **PASS** | Platô de transição |
| `income:level50` | 123.527 moedas/dia | 98.000 – 152.000 | **PASS** | Rebalanceamento `late_income` validado |
| `coinSpendRatio` | 0,741 (74,1%) | 0,70 – 0,99 | **PASS** | Gastos acompanham a renda sem acúmulo excessivo |
| `coinSpike` | 1,50× | $\le$ 6,0× | **PASS** | Relação máxima/mediana sem picos desestabilizadores |
| `perfectRateAtSkillMid` | 45,6% | 40,0% – 62,0% | **PASS** | Medido na curva autoral fixa sem compras (skill 0,55) |
| `grill:ze_da_esquina` | Turno 11 | 4 – 12 | **PASS** | Primeira compra de equipamento |
| `grill:parrilla_chef_cisma` | Turno 43 | 32 – 60 | **PASS** | Segunda compra de equipamento |
| `grill:fornalha_dragao_manso` | Turno 87 | 70 – 115 | **PASS** | Terceira compra de equipamento |

---

## 3. Sensibilidade Multi-Seed

Execução independente de 1.500 turnos com seeds aleatórias adicionais comprova a estabilidade do modelo:

| Métrica | Seed 20260917 (Canônica) | Seed 20260918 | Seed 20260919 |
|---|---:|---:|---:|
| Renda Total | 14.679.360 | 14.674.338 | 14.669.761 |
| Gasto Total | 10.873.220 | 10.873.220 | 10.873.220 |
| Saldo Final | 3.806.140 | 3.801.118 | 3.796.541 |
| Spend Ratio | 74,07% | 74,10% | 74,12% |
| Turno Rede Nacional | 1130 | 1130 | 1129 |
| Renda L50 | 123.527 | 122.775 | 122.449 |
| Metas Aprovadas | **18 / 18** | **18 / 18** | **18 / 18** |

---

## 4. Auditoria de Sinks: 27 Trilhas de Upgrade Maximizadas

Todas as 27 trilhas atingiram o nível máximo no horizonte de 1500 turnos, totalizando exatamente **6.358.620 moedas**:

| Categoria | Trilhas | Total Gasto (moedas) | Status |
|---|---|---:|:---:|
| Grelha (`grill`) | `grill_size` (8), `grill_heat` (8), `grill_stability` (6), `grill_speed` (6) | 46.180 | Maximizadas |
| Carvão (`charcoal`) | `charcoal_duration` (10), `charcoal_quality` (6), `charcoal_auto` (3) | 38.940 | Maximizadas |
| Preparo (`prep`) | `knife` (6), `board` (5), `counter` (5) | 12.850 | Maximizadas |
| Serviço (`service`) | `plates` (6), `tray` (5), `patience_charm` (5) | 17.710 | Maximizadas |
| Restaurante (`restaurant`) | `tables` (6), `decor` (6), `lighting` (4), `capacity` (5), `sign` (4), `music` (4) | 79.570 | Maximizadas |
| Funcionários (`employees`) | `garcom` (5), `auxiliar` (5), `churrasqueiro` (5), `caixa` (4), `gerente` (4) | 888.750 | Maximizadas |
| Prestígio (`prestige`) | `brasa_mastery` (20), `clientela_fiel` (20), `imperio_logistica` (20) | 5.274.620 | Maximizadas |
| **Total** | **27 trilhas** | **6.358.620** | **100% Maximizadas** |

---

## 5. Integridade de Dados, Contratos e Ferramental

- **15 Gates de CI:**
  - 14 gates locais aprovados (typecheck, validate, check-schema, verify-schemas, check-l10n, check-csharp-types, verify-data-sync, test, sim, check-vectors, check-art-registry, check-art, check-render, check-shots).
  - `check-csharp` marcado como SKIP localmente devido à falta da CLI `dotnet` no contêiner (coberto pelo runner remoto).
- **Testes Unitários:**
  - 680 testes passando em 30 arquivos vitest sem falhas.
- **Vetores Dourados:**
  - 157 vetores completos de simulação + 44 vetores de FTUE mantidos com correspondência estrita.
- **Renderização e Capturas:**
  - 53 capturas visuais em PNG validadas pelo `shoot.mjs` cobrindo o fluxo de tutorial, compras na loja, preparo, 4ª zona, chegada de VIP, feedback de combustível e telas de ausência.

---

## 6. Conclusão e Próximo Passo

A **Fase F4 (Revalidação Econômica Global)** está **encerrada e aprovada**.

👉 **Próximo passo do projeto: Fase F5 — Triagem e Correção de Débitos Médios e Baixos.**
- Triagem completa dos 38 achados restantes da auditoria (19 médios + 19 baixos).
- Prioridades: regras de carvão, ledger de brasas, clamps e derivações de stats, descarte de itens e higienização de contratos antes da porta C#.
