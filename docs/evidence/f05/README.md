# F5 — Triagem e Resolução de Débitos Médios e Baixos

**2026-09-27 · Concluído e validado localmente.**
Checkpoint de encerramento da **Fase F5** (Triagem e Resolução de Débitos Médios e Baixos da auditoria técnica `docs/23-AUDITORIA_TECNICA.md`).
Base confirmada: PR #16 integrado (`a900445fe3def248973fc884564a632d829f9c65`), branch de trabalho `arena/01a0e1a4-game-churrasqueiro`.
PRs preservados: **PR #7** e **PR #8** abertos e intactos.
Nenhum preço de upgrade, curva de XP, fórmula de balanceamento ou meta foi alterada nesta etapa.

---

## 1. Resumo Executivo da Fase F5

A Fase F5 realizou a triagem completa dos 38 débitos técnicos remanescentes (19 médios 🟠 e 19 baixos 🟡) catalogados em `docs/23-AUDITORIA_TECNICA.md`:
- Débitos de regras de simulação e dados foram corrigidos com testes unitários negativos e positivos dedicados em `tools/studio/test/f05-debts.test.ts`.
- Decisão formal do dono foi confirmada e aplicada para o comportamento de **Streak e Dia de Graça** (A-19 e C-01).
- Todos os 15 gates (14 locais PASS, 1 SKIP C# por falta de toolchain local) e a simulação de 1500 turnos (18/18 metas PASS) foram preservados intactos.

---

## 2. Detalhamento dos Débitos Resolvidos

### 2.1 Mecânica e Simulação (`tools/sim-core/src`)
- **A-14 🟠 (`cooking.ts:stageOf` & `Rules.cs:StageOf`):**
  - **Problema:** Itens com `stageOverrides` (`pao_de_alho`, `queijo_coalho`) ignoravam o estado `f.burned` caso o doneness médio caísse na faixa das substituições (ex: um lado a 1.2 e outro a 0.1 resultava em doneness 0.675, rotulado como "crocante", embora a pontuação marcasse como queimado).
  - **Solução:** `stageOf` agora verifica imediatamente `if (f.burned || d >= db.ingredients.shared.burnedThreshold) return 'burned';` antes de consultar `stageOverrides`.
- **A-15 🟠 (`policy.ts`):**
  - **Problema:** Chamada prematura de `a.spawn()` vazava instâncias de alimentos na grelha quando a capacidade estava esgotada.
  - **Solução:** O bot referencia `pickZoneFast` antes do spawn, descartando imediatamente com `a.discard()` caso a alocação falhe.
- **A-10 🟠 (`turn.ts:refillCharcoal`):**
  - **Problema:** `refillCharcoal()` não lia nem cobrava `charcoal.refillCostCoins`.
  - **Solução:** Adicionada verificação de saldo e débito de moedas durante o turno quando `refillCostCoins > 0`. Caso o reabastecimento falhe (ex: já em andamento), o custo é estornado.
- **A-11 🟠 (`economy.ts:evolveChurrasqueira`):**
  - **Problema:** `evolveChurrasqueira` debitava brasas sem atualizar o contador `embersSpentTotal` e emitia ledger de moedas mesmo em transações puras de brasas.
  - **Solução:** Contador `embersSpentTotal` incrementado adequadamente; suporte a devolução de `LedgerEntry` em brasas quando o custo de moedas for zero.
- **A-12 🟠 & A-13 🟠 (Clamps e deriveStats):**
  - **Problema:** Expressões mortas como `Math.floor(x / 1)` em `deriveStats` e ausência de clamp de nível em `auto*Level`.
  - **Solução:** Expressão limpa para `Math.floor(get('grill_size'))`; níveis de funcionários automatizados (`autoFlipLevel`, `autoServeLevel`, `autoPrepLevel`) agora utilizam `upgradeLevel()` com clamp estrito ao `maxLevel`.
- **A-20 🟡 (`save.ts:stableStringify`):**
  - **Problema:** `stableStringify` emitia valores literais `undefined`, gerando JSON inválido que estourava exceção em `JSON.parse()`.
  - **Solução:** Propriedades com valor `undefined` agora são filtradas dos objetos, aderindo ao comportamento padrão de serialização JSON.

### 2.2 Streak Diário e LiveOps (`docs/08-LIVEOPS.md`, `save.ts`, `prototype/src/main.ts`)
- **A-19 🟠 & C-01 🟠 (Decisão do Dono Aplicada: `hold_streak_and_reset_day`):**
  - **Decisão:** Perder 1 dia não zera o streak mas **não o avança** (streak 5 mantém 5). Gap $\ge 2$ dias sem dia de graça disponível reseta o streak para 1 e reinicia o ciclo no Dia 1 (`dayIndex: 0`).
  - **Implementação em `save.ts:resolveDailyClaim`:**
    - Gap = 1: streak incrementa (+1), `dayIndex` avança.
    - Gap = 2 (com `graceDays >= 1`): streak é mantido (`save.daily.streak`), `dayIndex` avança para a próxima recompensa.
    - Gap > 2: streak reseta para 1, `dayIndex` reseta para 0.
  - **Implementação em `prototype/src/main.ts`:**
    - Login consecutivo restaura `graceUsed = false`.
    - Gap de exatamente 2 dias consome a graça (`graceUsed = true`) e segura o streak.
    - Ausência maior reseta streak e reinicia `lastClaimDay = 0`.

### 2.3 Localização e Textos (`shared/l10n/pt-BR.json`, `docs/02-GAME_DESIGN.md`)
- **B-04 🟠 (Texto de upgrade vs efeito):**
  - Atualizada a chave `upgrade.grill_speed.desc` para `"Acelera o cozimento na grelha em +5% por nível."` e `name` para `"Brasa Acelerada"`, refletindo o stat real `heatRampRate (+0.05)`.
- **B-05 🟡 (`parrilla_chef_cisma` espetos):**
  - Atualizada a descrição da evolução 2 (`grill.chef_cisma.evo2.desc`) para `"3 fileiras, 6 espetos."` (2 slots × 3 zonas = 6) e evolução 3 (`grill.chef_cisma.evo3.desc`) para `"3 fileiras, 9 espetos."` (3 slots × 3 zonas = 9).
- **F-02 🟠 (Custos de restaurante em `docs/02-GAME_DESIGN.md`):**
  - Tabela §15 atualizada com os valores autorizados e vigentes em `restaurants.json`: Quintal (0), Espetinho (0), Trailer (3.500), Bairro (15.000), Premium (67.000), Festival (178.000), Rede Nacional (4.200.000).
- **F-01 🟠, F-04 🟡, F-05 🟡 (Ajustes de documentação):**
  - Referência aos vetores dourados corrigida para `tools/golden/` em `types.ts`.
  - README atualizado para refletir o status de arte aprovada (244 sprites), áudio WAV e encerramento das fases F4 e F5.

### 2.4 Validação e Ferramental (`tools/studio/validate-data.ts`)
- **D-03 🟡 (`validate-data.ts`):**
  - Validação explícita de paridade entre a geração em memória e o arquivo `shared/data/levels.json` persistido no repositório.
  - Remoção de import e instrução residual `void validateDatabase;`.

---

## 3. Classificação dos Débitos Restantes (Unity / Serviços)

Os seguintes itens foram explicitamente classificados para fases posteriores:
- **E-01 🟠 (`AdService.cs`), E-02 🟠 (`BillingService.cs`), E-03 🟡 (`GameData.cs`), E-04 🟡 (Build C#):** Tratam-se de stubs de C# e SDKs de monetização que pertencem às fases **F8 (Port de Paridade C#)** e **F11 (Serviços e SDKs Reais)**.
- **B-07 🟡 (IDs IAP no Play Console):** Mapeamento para provisionamento da loja em **F13**.
- **B-08 🟡 (Produtores de conquistas/missões):** Pertence a **F10 (Meta-sistemas Unity)**.

---

## 4. Evidências de Validação

- **Testes Unitários:** 687 testes aprovados em 31 arquivos vitest (7 novos testes em `tools/studio/test/f05-debts.test.ts` cobrindo A-10, A-11, A-12, A-13, A-14, A-15 e A-20). Log em [`green-tests.log`](green-tests.log).
- **Gates de CI:** 14/15 gates locais aprovados (SKIP em `check-csharp` por ausência de `dotnet` local, coberto remotamente). Log em [`green-gates.log`](green-gates.log).
- **Vetores Dourados:** 157 vetores de simulação + 44 vetores de FTUE inalterados e validados.
- **Sincronização de Dados:** `shared/data/` e `Assets/Data/` 100% sincronizados.
- **Pacing Multi-mês (1500 turnos):** 18/18 metas PASS com saída 0.

---

## 5. Próximo Passo do Projeto

Com a Fase F5 concluída, o próximo passo do plano de implementação é:
👉 **Fase F6: Auditoria e Atualização Isolada de Dependências e Toolchain (`package.json`, Vitest/Vite/esbuild).**
