# A-06.5 — Revisão Final das 27 Trilhas e Contratos

**2026-09-27 · Concluído e validado localmente.**
Checkpoint de encerramento da frente **A-06** (Trilhas de Upgrade).
Base confirmada: PR #16 integrado (`a900445fe3def248973fc884564a632d829f9c65`), ramificada em `arena/01a0e1a4-game-churrasqueiro`.
PRs preservados: **PR #7** (`arena/01a0daed-game-churrasqueiro`) e **PR #8** (`arena/01a0de76-game-churrasqueiro`) permanecem abertos e intocados.
Nenhuma decisão prévia foi reaberta. Sem arte nova, sem porta de regras C# ou Unity, sem publicação.

---

## 1. Resumo Executivo da Revisão

A auditoria inicial (`docs/23-AUDITORIA_TECNICA.md` §2 A-06) identificou que 14 das 27 trilhas de upgrade eram puramente no-ops (não possuíam consumidor no runtime ou o valor calculado nunca era lido), gerando um desperdício potencial de 5.866.480 moedas que mascarava o indicador `coinSpendRatio`.

Ao longo dos checkpoints A-06.1 a A-06.4:
- **A-06.1:** Centralizou cotações, compras compartilhadas e ativou efeitos diretos (`capacity`, `tables`, `brasa_mastery`, `clientela_fiel`, etc.) com bloqueio temporário seguro das incompletas.
- **A-06.2:** Ativou recursos físicos reais (`grill_stability`, `charcoal_quality`, `charcoal_auto`, `counter`), reposição grátis em 3s e isolamento de RNG.
- **A-06.3:** Integrou operações legais dos funcionários (`garcom`, `auxiliar`, `churrasqueiro`, `tray`) com tetos de cobertura estritos $\lfloor \text{cobertura} \times \text{elegíveis} \rfloor$.
- **A-06.4:** Integrou ausência real (`caixa`, `gerente`, `imperio_logistica`) no índice 3 com ledger idempotente e executou o rebalanceamento autorizado de renda tardia (`late_income`).

O **A-06.5** consolida e encerra a revisão final de todas as 27 trilhas:
1. **27/27 trilhas ativas** (`UPGRADE_PHASES` = `active`).
2. **0 no-ops restantes** — cada trilha possui consumidor ativo e validado no simulador de turno ou no livro de ausências.
3. **0 trilhas bloqueadas** — capacidade de absorção de moedas em upgrades maximizada atinge exatamente **6.358.620 moedas**.
4. **Gating rigoroso** — 18 trilhas disponíveis no início (Restaurante 0, Nível 1); 9 trilhas exigem requisitos reais (nível de restaurante, desbloqueio de receita de preparo ou dependência de funcionário).
5. **Preservação de histórico** — nenhum progresso ou nível comprado pelo jogador é apagado ou reembolsado.
6. **Campanha ativa de 1500 turnos** — **18/18 metas PASS, exit 0** sem injeção de rewarded e sem injeção de moedas offline.

---

## 2. Matriz Consolidada das 27 Trilhas

A tabela detalhada com custos base, crescimento geométrico, fórmulas de cálculo, deltas e arquivos de teste está documentada em [final-map.md](../final-map.md) e [final-matrix.json](final-matrix.json).

| Categoria | Trilhas | Custo Total (moedas) | Status de Integração | Consumidor Principal |
|---|---|---:|---|---|
| **Grelha** (`grill`) | `grill_size`, `grill_heat`, `grill_stability`, `grill_speed` | 46.180 | 4 ativas, 0 no-op | `deriveStats`, `effectiveHeat`, `charcoalEfficiency`, `tickGrill` |
| **Carvão** (`charcoal`) | `charcoal_duration`, `charcoal_quality`, `charcoal_auto` | 38.940 | 3 ativas, 0 no-op | `tickGrill`, `minCharcoalEfficiency`, `autoRefillCharcoal` |
| **Preparo** (`prep`) | `knife`, `board`, `counter` | 12.850 | 3 ativas, 0 no-op | `prepSpeedMult`, `prepSlotsCapacity`, `rawStockCapacity` |
| **Serviço** (`service`) | `plates`, `tray`, `patience_charm` | 17.710 | 3 ativas, 0 no-op | `scoreItem`, `StaffRuntime` (cadência do garçom), `spawnCustomer` |
| **Restaurante** (`restaurant`) | `tables`, `decor`, `lighting`, `capacity`, `sign`, `music` | 79.570 | 6 ativas, 0 no-op | `maxOrdersOnScreen`, `scoreItem` (XP e gorjetas), `spawnTimer`, paciência |
| **Funcionários** (`employees`) | `garcom`, `auxiliar`, `churrasqueiro`, `caixa`, `gerente` | 888.750 | 5 ativas, 0 no-op | `StaffRuntime` (serviço/prep/virada), `offlineSnapshot` (antecipação e taxa) |
| **Prestígio** (`prestige`) | `brasa_mastery`, `clientela_fiel`, `imperio_logistica` | 5.274.620 | 3 ativas, 0 no-op | `scoreItem` (apenas gorjeta), paciência (+1%/nv), taxa offline (+2%/nv) |
| **Total** | **27 trilhas** | **6.358.620** | **27 ativas** | **100% integradas no runtime** |

---

## 3. Verificação de Regras e Fronteiras de Escopo

### 3.1 Escopo dos Funcionários Reafirmado
- **Gerente:** Concede **estritamente +18% de renda offline por nível** (`idleRateMult`). Outras promessas de design antigo (reroll diário/semanal, desconto na loja de 10–15%, bônus de chegada de VIP de +2pp) permanecem classificadas como **backlog explícito** para a fase F10 (metaprogressão). Não foram implementadas silenciosamente nem prometidas na UI ativa.
- **Auxiliar:** Inicia preparo exclusivamente quando houver pedido na fila sem preparo em andamento, houver vaga livre na tábua e estoque disponível do ingrediente. Concede +1 vaga extra de preparo a partir do nível 3.
- **Garçom:** Serve pedidos bons ou prontos respeitando o teto de cobertura $\lfloor \text{cobertura} \times \text{elegíveis} \rfloor$. O tempo de viagem de 1,5 s é acelerado em 10% por nível de `tray` (até 1,0 s).
- **Churrasqueiro:** Executa virada automática ao sinal visual público de virada (0,55) respeitando o teto de cobertura (20% a 60%). Nunca move alimentos entre zonas nem garante ponto perfeito.
- **Caixa:** Antecipa 2, 4, 6 ou 8 horas de ausência imediatamente no retorno do jogador.

### 3.2 Distinção entre Campanha Ativa e Ausências
- **Campanha Ativa (1500 turnos):**
  - Executada sem rewarded ads e **com zero moedas de ausência offline** injetadas (`counters.offlineCoins === 0`, `offline.batch === null`).
  - Resultado: **18/18 metas PASS, exit 0**.
  - Rede Nacional desbloqueada no turno 1130 (alvo 950–1450).
  - Renda L50: 123.527 moedas/dia (alvo 98.000–152.000).
  - Razão de gasto: 74,07% (alvo 70–99%).
  - Gasto total: 10.873.220 moedas (todas as 27 trilhas maximizadas consumiram 6.358.620 moedas).
- **Cenário de Ausências:**
  - Auditado em 24 fixtures declaradas de forma isolada ([absence-economy.json](absence-economy.json)).
  - Simula ausências reais de 3 dias com janelas programadas, rampa de 20 min, cap de 8h e quitação em duas etapas (automática pelo Caixa + manual).
  - O resultado é byte-idêntico ao fechamento do A-06.4.

---

## 4. Testes, Gates e Evidências Coletadas

- **Suíte de Testes Vitest:**
  - **680 testes passando em 30 arquivos** (tempo de execução: ~66–73 s).
  - Adicionado `tools/studio/test/a06-final-matrix.test.ts` (8 testes abrangentes) cobrindo integridade do catálogo, custos geométricos, traduções em pt-BR, gating inicial, derivação de stats por trilha, ciclo completo de compras até o nível máximo e persistência/CRC.
- **CI Gates Locais:**
  - **14 de 15 gates PASS** (registro em [green-gates.log](green-gates.log)).
  - `check-csharp` marcado como **SKIP** no ambiente local por ausência do SDK `dotnet` (o CI do GitHub Actions executa e valida com .NET 8.0).
- **Simulação Longa:**
  - `npm run sim:long` executado com 1500 turnos (registro em [green-long.log](green-long.log)).
  - Todos os 18 critérios de balanceamento validados com sucesso.
- **Capturas e Visual:**
  - 53 imagens geradas e validadas via `check-shots` (todas as 244 sprites WebP decodificadas sem exceções).
- **Vetores Dourados:**
  - 157 vetores de regra + 44 vetores de FTUE mantidos intactos (`check-vectors` PASS).

---

## 5. Limitações e Débitos Técnicos Registrados

1. **Anti-cheat / Autoridade de Cliente:** O protótipo web utiliza `localStorage` e o relógio local do dispositivo. Embora possua proteções contra recuo de relógio (*clock rollback*) e travamento fechado (*fail closed*) em corrupção, não substitui um servidor autoritativo de LiveOps (dívida F11).
2. **C# SKIP:** A aprovação local dos 14 gates não substitui o teste remoto de compilação C# em netstandard2.1. Nenhuma regra de produção foi portada para C# nesta sessão (os arquivos C# gerados são estritamente DTOs de dados).
3. **UI Avançada via Fixtures:** As verificações de ponta a ponta da interface com 14 pedidos e bancada estendida utilizam cenários de teste automatizados com ponteiro real; não comprovam a progressão contínua de 1500 turnos dentro de um navegador sem recarregamento.
4. **Metaprogressão e XP Legado:** O XP offline utiliza a função `grantExperience` do `sim-core`, enquanto o XP legado do navegador permanece pendente de unificação em F10.

---

## 6. Próximo Passo

Com a conclusão do checkpoint **A-06.5**, a frente **A-06 (27 Trilhas de Upgrade)** está **encerrada**.

👉 **Próximo passo do projeto: Fase F4 — Revalidação Econômica Global.**
- Consolidação dos relatórios de economia, dados, levels e vetores.
- Revisão detalhada dos sinks e faucets em todos os perfis de jogador.
- Não requer arte nova nem implementação prematura de C#/Unity.
