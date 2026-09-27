# 23 — Plano de Implementação e Melhoria (passo a passo)

**Atualização operacional:** 2026-09-27 · branch `arena/01a0e03e-game-churrasqueiro`
**Histórico:** plano original de 2026-09-26 preservado nas seções 1–7 e no registro.
**Status:** ativo — este é o documento-guia do dia a dia. Na dúvida sobre o que fazer
a seguir, a resposta está em "Próximo passo imediato" (§8).

> **Por quê.** O projeto tem ótimas especificações (docs 00–22), mas faltava um roteiro
> único, ordenado e marcável, dizendo *o que fazer agora, o que vem depois e quando cada
> coisa está pronta*. Este documento é esse roteiro. Ele não substitui o roadmap por
> versões (`14-ROADMAP.md`), o backlog priorizado (`17-BACKLOG.md`) nem o status Honesto
> (`18-STATUS.md`) — ele os costura em passos executáveis.

---

## 0. Regras de foco (leia antes de codar/gerar)

1. **Uma fase por vez.** Só abrir a próxima fase com a atual 100% concluída e com gates verdes.
2. **Todo passo tem verificação.** Sem o comando de verificação passando, o passo não está feito.
3. **Atualizar este documento ao concluir cada passo** (marcar `[x]`, data e branch/PR).
   `18-STATUS.md` é atualizado ao fechar cada fase.
4. **Aprovações do dono travam integração, nunca o registro.** Arte gerada entra como
   `pending`; só vira `approved` com o "ok" explícito (docs/22 §5).
5. **Gates verdes sempre:** `npm run gates` precisa passar antes de qualquer merge.
6. **Nada de escopo novo no meio da fase.** Ideia nova vai para o icebox do §7 e espera
   a revisão de fase.

---

## 1. Visão geral histórica das fases (substituída operacionalmente pela §9)

| Fase | Objetivo | Sai de | Chega em | Doc-mãe |
|---|---|---|---|---|
| **0** | Consolidar a base | estado atual | V0.1 fechado de verdade, snapshot atualizado | 18 |
| **1** | Arte 2D completa | lotes 01–04 | lotes 05–11 aprovados; 244 sprites integrados no protótipo | 22 |
| **2** | Paridade C# completa | 139 checks, 17 vetores órfãos | 100% dos golden vectors verdes no CI | 03, 18 §7.2 |
| **3** | Unity V0.2 — Core Loop | sem projeto Unity | turno jogável no Editor a 60 FPS | 14 (V0.2) |
| **4** | V0.3 — Vertical Slice | core funcional | 1 experiência em qualidade final | 14 (V0.3) |
| **5** | V0.4 → V1.0 | slice vertical | jogo publicado em rollout | 14 (V0.4–V1.0) |

Dependências históricas acima **não autorizam mais a porta C#**: a auditoria exige
estabilizar TypeScript, contratos, dados e economia primeiro. A ordem vigente está na §9.

---

## 2. Fase 0 — Consolidar a base (V0.1 fechado de verdade)

- [x] **0.1 — Decisões de aprovação pendentes (dono).** (2026-09-26: os 33 pending do lote 03 foram substituídos e aprovados nos lotes 08–11; registro final 244 approved, 0 pending, 1 superseded.)
- [x] **0.2 — Gates verdes neste checkout.** (2026-09-26: 13/14 verdes, `check-csharp` SKIP sem dotnet — CI executa; FTUE inalterado, 148 sprites no runtime.)
  Ações: `npm install` → `npm run gates` → corrigir o que quebrar.
  Verifica: `npm run gates` (14 gates) + `npm run sim:long`.
  Pronto quando: tudo verde (exceto `check-csharp` SKIP local, verde no CI).
- [x] **0.3 — Integrar aprovações e fechar o snapshot.** (2026-09-26: runtime 244 sprites / 3,98 MB, 16 comidas, 7 fundos; `docs/18-STATUS.md` e README atualizados; FTUE inalterado no `check-shots`.)

## 3. Fase 1 — Arte 2D completa (docs/22)

Ordem = primeira aparição no jogo (docs/22 §2). Cada lote segue o ciclo docs/22 §5:
prompts gravados antes → 10 imagens → `process-sprites` → `review-sheet` →
aprovação do dono → `set-status` → `build-runtime`.

- [x] **1.1 — Lote 05: fechar comidas, upgrades, funcionários e fundos.** (2026-09-26: 10 imagens, 53 sprites, aprovado pelo dono e integrado — runtime com 148 sprites.)
  10 imagens: `food_costela`, `food_cupim` (últimas 2 comidas) ·
  `ui_icons_upgrades_b/c` (18 ícones restantes, ids de `upgrades.json`) ·
  `ui_icons_cosmetics` (5 cosméticos) · `char_funcionarios` (5 cargos de `employees.json`) ·
  `bg_churrascaria_premium`, `bg_festival`, `bg_rede_nacional` (últimos 3 fundos) ·
  `ui_icons_collection` (10 categorias de `collection.json`).
  Ao fechar: 16/16 comidas · 27/27 ícones de upgrade · 5/5 funcionários ·
  7/7 fundos · 5/5 cosméticos · 10/10 categorias.
  Verifica: `process-sprites` + `review-sheet` sem erro; folha em `art/review/lote-05*.jpg`.
  Pronto quando: lote aprovado pelo dono e runtime reconstruído.
- [x] **1.2 — Lote 06: coleção, VFX e evoluções de churrasqueira.** (2026-09-26: 10 imagens, 29 sprites aprovados; desvios autorizados documentados em docs/22 §6.6.)
  A arte aprovada está no runtime; não relaxar `holeValidation` nem alterar as evoluções autorizadas sem novo pedido.
- [x] **1.3 — Lote 07: coleção, eventos, loja/IAP, passe, mapa, medalhas e key art.** (2026-09-26: 10 imagens, 34 sprites aprovados e incluídos no runtime; runtime total 211 sprites, 3,44 MB WebP.)
  Escopo conforme `art/lote-07.json` e docs/22 §6.7 (não os conceitos de store, que ficam para lote futuro). O mapa tem divisões internas não cartográficas; inox da coleção sem manivela. O dono aprovou o lote completo ciente das ressalvas.
  **Limite:** inclusão dos assets no bundle não implementa as telas/fluxos de coleção, eventos, IAP, passe, mapa ou conquistas. A montagem não é screenshot do jogo; ver §7.1 de docs/22.
  Verifica: `set-status` (34/34 approved) → `build-runtime` (211 sprites) → gates locais 13/14; `check-csharp` SKIP por ausência de dotnet no sandbox. CI remoto ainda não registrado para esta branch; validar em CI/ambiente .NET antes de merge.
- [x] **1.3-A — Substituir os 33 sprites pending do lote 03 em 4 rodadas individuais (10 + 10 + 10 + 3).**
  - Lote 08: 10/10 aprovados; runtime 211 → 221 sprites / 3,49 MB.
  - Lote 09: 10/10 aprovados; runtime 221 → 231 sprites / 3,81 MB.
  - Lote 10: 10/10 aprovados; runtime 231 → 241 sprites / 3,88 MB.
  - Lote 11: 3/3 aprovados; runtime final **244 sprites / 3,98 MB**, 16 comidas e 7 fundos.
  - Registro final: **244 approved, 0 pending, 1 superseded**. As 33 substituições e o merge completo foram autorizados pelo dono em 2026-09-26.
- [x] **1.4 — Gate `check-art-registry` no CI.** (2026-09-27: implementado em `ad29b56`, 52 testes de contrato; 14/15 gates locais, C# SKIP; CI remoto registrado no encerramento abaixo.)
  Ações: todo arquivo em `Assets/Art` tem linha no registro; toda linha aponta para um
  arquivo existente; o runtime só contém `approved` (promessa de docs/04 §11).
  Verifica: `npm run gates` inclui o novo gate, verde.
  Pronto quando: gate com "dentes" (falha de propósito se um teste o neutrar).
- [ ] **1.5 — Dados que a arte nova exige.**
  Ações: adicionar `icon` aos 5 `cosmeticTracks` de `upgrades.json` (hoje sem campo);
  `gen-schemas` + `check-schema` + `validate` + `gates` verdes.
  Verifica: `npm run validate && npm run check-schema && npm run verify-schemas`.
  Pronto quando: nenhuma arte aprovada sem referência nos dados (e vice-versa).

## 4. Fase 2 — Paridade C# completa (17 vetores órfãos → 0)

Pré-requisito de ferramental: .NET 8 SDK no CI (já configurado) — local dá SKIP.

- [ ] **2.1 — `TurnSimulation.cs`.**
  Port de `tools/sim-core/src/turn.ts`. Verifica: `npm run check-csharp`
  (12 vetores de turnos completos passam a rodar e concordar).
- [ ] **2.2 — `EconomyRules.cs`.**
  Port de `economy.ts` (+ `applyChurrasqueiraToStats`, `churrasqueiraZoneHeat`,
  `patchGrillForChurrasqueira`, `runtimeZoneIndex`).
  Verifica: 5 vetores de economia concordam.
- [ ] **2.3 — `SaveSystem.cs` (v3).**
  Port de `save.ts` com `progress.tutorial` + `ftueDone` e migração pré-v3.
  Verifica: testes de save portados passam.
- [ ] **2.4 — Cola do `TutorialTurn` em C#.**
  Depende de 2.1. Verifica: vetores de tutorial concordam de ponta a ponta.
- [ ] **2.5 — `SimParityTests` verdes a 1e-9.**
  Pronto quando: `check-csharp` não lista mais nenhum vetor como "não portado".

## 5. Fase 3 — Unity V0.2 — Core Loop (docs/14)

Só começa com a Fase 2 concluída. Requer Unity 6 LTS + device físico médio.

- [ ] **3.1 — Projeto Unity compila** (`Packages/`, `ProjectSettings/`, `Sim` assembly).
  Verifica: build local + `SimParityTests` verdes no Editor.
- [ ] **3.2 — Cena da churrasqueira** (`GrillView`, `FoodView`, `CustomerCardView`, `TurnFlow`):
  arrastar/virar/servir, zonas, carvão, pedidos, paciência, combo.
- [ ] **3.3 — Feel pass**: haptics, squash-and-stretch, trilha, sizzle.
  Pronto quando: 3 testadores dizem "satisfatório" sem serem induzidos (backlog #3).
- [ ] **3.4 — `AssetPostprocessor`** lendo `sprites.manifest.json` (docs/22 §7.2) + `.meta` versionados.
- [ ] **3.5 — Exit V0.2:** turno de 90 s completável num device médio físico a 60 FPS.

## 6. Fase 4–5 — V0.3 → V1.0 (resumo; detalhe em docs/14 e docs/17)

| Passo | Versão | Exit (docs/14) |
|---|---|---|
| 4.1–4.4 | V0.3 Vertical Slice | um estranho joga e diz que parece jogo lançado |
| 5.1 | V0.4 Meta | sessão de 30 min com metas de minuto, hora e dia |
| 5.2 | V0.5 Monetização | compras teste + rewarded verificados no device; nenhum id real no git |
| 5.3 | V0.6 Analytics | funil §60 respondível com dados ao vivo |
| 5.4 | V0.7 Conteúdo | conteúdo MVP completo (§84) |
| 5.5 | V0.8 Polish | zero placeholder; gates de performance ok |
| 5.6 | V0.9 Soft Launch | D1 ≥ 40%, D7 ≥ 12%, crash-free ≥ 99,3%, tutorial ≥ 85% |
| 5.7 | V1.0 Produção | KPIs verdes sustentados por 14 dias |

Cada passo, ao ser aberto, ganha sub-passos próprios neste documento (mesmo formato das fases 0–2).

---

## 7. Melhoria contínua (não bloqueia fases, mas não some)

- [ ] **Gap dos 767 turnos** (418 → 1185 sem estabelecimento novo): validar com telemetria
  (D30/D60, funil `restaurant_unlock`) antes da V1.0 (18-STATUS §3).
- [ ] **l10n en-US/es-419**: sair de ~10% stub para cobertura total antes de qualquer
  lançamento fora do BR.
- [ ] **Acessibilidade**: ponto legível sem cor, tamanho de texto, reduzir movimento.
- [ ] **Git LFS**: se `Assets/Art/**/*.png` passar de ~100 MB (ponto de decisão: docs/22 §8).
- [ ] **Refações de arte acumuladas**: coração selado claro demais (lote 02, usável);
  divergências `look` × arte aprovada (apressado, tio, lata — docs/22 §6.1).
- [ ] **Icebox de ideias novas** (registrar aqui, não executar fora de fase): _nenhuma por enquanto._

---

## 8. Próximo passo imediato

👉 **Iniciar F2: reproduzir A-07 e escrever regressões antes de corrigir `restaurantsUnlocked`.**
F1 está implementada; depois de A-07, seguir A-08 → A-09. A arte está encerrada; não abrir lote.
C# e Unity bloqueados até estabilização da referência. Não fazer merge sem nova autorização.

**Registro de progresso:**

| Data | Passo | Status | Branch/PR | Obs |
|---|---|---|---|---|
| 2026-09-26 | — | plano criado (este documento) | `arena/01a0df03-game-churrasqueiro` | ponto de partida |
| 2026-09-26 | 1.1 (lote 05) | 10 imagens geradas, 53 sprites processados, `pending` | `arena/01a0df03-game-churrasqueiro` | aguardando aprovação do dono |
| 2026-09-26 | 0.2 + 1.1 | lote 05 aprovado e integrado; gates 13/14 verdes | `arena/01a0df03-game-churrasqueiro` | runtime 148 sprites (2,38 MB); descoberto que o lote 04 já estava approved |
| 2026-09-26 | 1.2 (lote 06) | 1ª passada: 10 geradas, 3 ok (VFX fumaça, molhos, equipamentos); 6 grills com perspectiva invertida + confete espalhado vão refazer | `arena/01a0df03-game-churrasqueiro` | limite de 10 gerações do turno atingido; continua no próximo turno |
| 2026-09-26 | 1.2 (lote 06) | parcial: 5/10 processados (24 sprites: inox evo 3 + VFX + coleção); 5 grills falharam no holeValidation | `arena/01a0df03-game-churrasqueiro` | 3ª passada no próximo turno (upgrades compactos); limite de 10 gerações atingido de novo |
| 2026-09-26 | 1.2 (lote 06) | 10/10: chapa evo 2 passou na 7ª passada ([ALTA]); chapa evo 3 + fornalhas evo 2–3 implementadas com desvio documentado e autorização do dono | `arena/01a0df03-game-churrasqueiro` | 29 sprites approved; runtime 177 sprites (3,11 MB); contrato mantido no spec para refação futura |
| 2026-09-26 | 1.3 (lote 07) | 10/10 imagens, 34/34 sprites aprovados; runtime reconstruído para 211 sprites / 3,44 MB WebP | `arena/01a0dfd3-game-churrasqueiro` | 13/14 gates locais; `check-csharp` SKIP sem dotnet. Aprovação cobre arte, não integração das telas de metajogo; desvios aceitos descritos em docs/22 §6.7 |
| 2026-09-26 | 1.3-A (lote 08) | 10/10 aprovados e integrados | `arena/01a0e001-game-churrasqueiro` | 9 ícones centrais + `ic_grill_size`; runtime 211 → 221 sprites / 3,49 MB; dono pediu seguir e fazer merge só após as 33 imagens |
| 2026-09-26 | 1.3-A (lote 09) | 10/10 aprovados e integrados | `arena/01a0e001-game-churrasqueiro` | dono pediu o próximo lote e aceitou os dois carrinhos; runtime 221 → 231 sprites / 3,81 MB |
| 2026-09-26 | 1.3-A (lote 10) | 10/10 aprovados e integrados | `arena/01a0e001-game-churrasqueiro` | cinco estados de contra-filé + cinco de maminha; runtime 231 → 241 sprites / 3,88 MB |
| 2026-09-26 | 0.1 + 0.3 + 1.3-A (lote 11) | 3/3 aprovados, sequência encerrada e merge autorizado | `arena/01a0e001-game-churrasqueiro` | registro 244 approved / 0 pending / 1 superseded; runtime 244 sprites / 3,98 MB, 16 comidas, 7 fundos; docs e snapshot atualizados |


## 9. Plano operacional pós-arte — vigente em 2026-09-27

Esta seção prevalece sobre a numeração histórica das §§1–7 e a ordem antiga do handoff.
Escopo desta entrega/PR: baseline, planejamento e **F1**. F2–F13 permanecem pendentes,
não abandonadas. Uma mudança de segurança será isolada em commit/PR, **na branch da sessão**;
não se aplica a recomendação antiga de trocar para outra branch.

### 9.1 Baseline reproduzido antes de alterações

- `git fetch origin`; HEAD `4fe4f4f`, ancestralidade do merge PR #13 confirmada em HEAD e
  `origin/main`; branch `arena/01a0e03e-game-churrasqueiro`; árvore limpa.
- Leitura integral: README, docs 18, 22, 23-AUDITORIA, 23-PLANO e 24-PROMPT.
- Node **v22.22.3**, npm **10.9.8**; `npm ci` concluído.
- `npm run gates`: **13/14 executados e aprovados**, só `check-csharp` SKIP (sem .NET).
  Lista: typecheck, validate, check-schema, verify-schemas, check-l10n, check-csharp-types,
  verify-data-sync, test, sim, check-vectors, check-art, check-render, check-shots, check-csharp.
- **202/202 testes**, 13 arquivos; 22 schemas; 98 + 44 vetores sem drift; 144 draws;
  244 sprites decodificados; 13 screenshots; FTUE 16,1/32,9/38,3 s e zero erros.
- `sim:long`: 1.500 turnos, nível 80, restaurante 6, Fornalha evo 3; renda 14.665.839,
  gasto 10.873.220, saldo 3.792.619; spend 0,741; perfect 71,8%; burned 5,7%;
  perdidos 6,9%; duração média 169,8 s; **18/18 guardrails codificados**.
  Unlocks 32/89/147/243/418/1185; churrasqueiras 7/45/90;
  renda diária L5/L15/L30/L50 = 10.793/41.115/98.262/115.926.
- `npm audit`: **5 vulnerabilidades (1 crítica, 1 alta, 3 moderadas)**, cadeia
  Vitest/@vitest/mocker/Vite/vite-node/esbuild transitivo. Sugere Vitest 5.0.2 major;
  não aplicado `audit fix --force`. O advisory remoto mudou, mas a contagem coincide.
- PR #13 confirmado MERGED com SHA integral `4fe4f4ff20b11cfd625b0f65f7c4944701e373b9`;
  CI `Studio gates` SUCCESS, run `36281871246`. Não confundir com CI desta nova entrega.
- Nenhuma divergência numérica do handoff. Ressalvas mantidas: o sim curto marca alvos
  não alcançados como PASS; o longo é necessário. Os verdes não corrigem A-01–A-09.
- Reprodução da lacuna F1: `check-art-registry` não existe (`npm` falha); adicionar
  temporariamente um WebP órfão ao runtime **não faz `check-art` falhar** (exit 0).
  Arquivo de prova removido, nenhum master alterado.

### 9.2 Fases, dependências, arquivos, regressões e saída

| Fase / estado | Ordem e dependências | Arquivos/contratos previstos | Testes negativos e critério de conclusão |
|---|---|---|---|
| **F1 — concluída / PR #14 aberto** | Baseline → testes vermelhos → gate → CI | `tools/art/check-art-registry.ts`, baseline nominal `art/approved-runtime-baseline.json`, `tools/studio/test/art-registry.test.ts`, `package.json`, `run-gates.mjs`, `gates.test.ts`, `ci.yml` | Masters ↔ CSV ↔ manifesto ↔ runtime; nomes/caminhos/batch/status, duplicatas, flags, arquivos órfãos, remoção inclusive coordenada; fixtures isoladas e exit != 0. Manter os 244 IDs aprovados e CI com 15 gates. Sem regenerar arte. |
| **F2 — pendente** | **A-07 → A-08 → A-09**; depois de F1 | `economy.ts`, `turn.ts`, `save.ts` se normalização exigir, testes economy/turn/save, `gen-vectors.ts` só se contrato mudar | A-07: inicial=1, sequência 2..7, repetição sem crédito, roundtrip/save antigo com contador inflado e metas 3/5/7. A-08: queimar+descartar/servir, vários alimentos, resultado/restauração sem contar duas vezes. A-09: 2+ chamadas estruturalmente iguais, moedas/XP não duplicados, serialização e chamadores reais. Reproduzir cada falha antes da correção; gates+sim longo verdes ou divergência econômica explicitamente investigada, nunca retunada por conveniência. |
| **F3 — pendente** | A-01 → A-02 → A-03 → A-04 → A-05 → A-06; decisões abaixo | `ingredients.json`, `grill.json`, `restaurants.json`, `levels.json`, `upgrades.json`, `events.json`, `types.ts`, `cooking.ts`, `turn.ts`, `policy.ts`, `economy.ts`, `prototype/src/main.ts`, tutorial/analytics/audio/l10n, `run-sim.ts` e testes | Janela perfeita costela/cupim e bot avançado; unlock imediatamente antes/no/depois (nível+restaurante), FTUE determinístico; prep com slots/input/hitboxes/pedido misto/paciência/combo/resultado; 4 zonas reais em grelha/bot/UI/calor/screenshots; VIP chance 0/natural/forçado/cap/recompensa/placement; mapa das 27 trilhas (consumidor/fórmula/limite/tela/teste/sim), no-ops explicitamente ocultos e incompráveis. Nove altos resolvidos, nenhuma promessa sem consumidor. |
| **F4 — pendente** | Todas A-01–A-09 resolvidas | `shared/data`, schemas necessários, `Assets/Data`, `tools/golden`, docs 06/18/23 | Revisar dados antes de `gen-levels` e `gen-vectors`; revisar cada diff semântico, gates e 1.500 turnos; publicar unlocks/renda/spend/perfect/burned/perdidos/duração/grills. Não aceitar vetores novos apenas por terem sido gerados. |
| **F5 — pendente** | Referência corrigida, antes da porta | `economy.ts`, `cooking.ts`, `policy.ts`, `save.ts`, `prototype/src/main.ts`, dados/l10n, validadores, runner C#, auditoria | Triar 19 médios + 19 baixos. Resolver antes de C#: carvão, ledger brasas, offline, deriveStats/clamps, burned com overrides, vazamento bot, streak, campos mortos, gating funcionários, descrições, avaliadores missões/conquistas, level-up, alvos ignorados, levels commitado e skips C#. Teste reprovando implementação anterior por item; classificar explicitamente o que fica para serviços/device. |
| **F6 — pendente / isolada** | Antes de C#, após fixar contratos | `package.json`, lock, configuração de testes/build necessária | Rever release notes de Vitest/Vite/esbuild e Node mínimo; audit antes/depois; typecheck, 202+ testes, schemas, vetores, sim curto/longo, render, screenshots e C# remoto. Zero vulnerabilidades conhecidas ou impedimento documentado, sem force cego. |
| **F7 — pendente** | Antes da paridade econômica C# | PRs #7/#8 via `gh`, arquivos úteis extraídos no estado atual, registro de decisões | Comparar cada tema com main: útil/obsoleto/conflitante; reimplementar seletivamente com testes. Não fazer merge desses PRs; fechar apenas após revisão registrada. |
| **F8 — bloqueada** | F2–F7 concluídas e contratos estáveis | `TurnSimulation.cs`, `EconomyRules.cs`, `SaveSystem.cs`, `Tutorial.cs`, parity runner | Mesmos 12 vetores de turno + 5 econômicos, save v3/migrações e FTUE completos; netstandard2.1/C#9, warnings=erros, **zero not ported**. |
| **F9 — bloqueada** | F8 concluída | Unity 6 LTS: Packages/ProjectSettings/assemblies/cenas/prefabs; importer do manifesto, atlases/.meta; GrillView/FoodView/CustomerCardView/TurnFlow | Turno completo no Editor; input/UI/áudio/save/l10n integrados; 60 FPS em Android médio físico com medição. Arte no bundle não equivale a sistema funcional. |
| **F10 — pendente** | Core Unity | Coleção/missões/conquistas/eventos/loja/passe/rota; en-US/es-419 | Fluxos completos, traduções além dos 10,5%, texto ampliado/contraste/ponto sem só cor/redução de movimento/toque/retorno/telas pequenas e proporções. |
| **F11 — bloqueada** | Core Unity funcional | Serviços Firebase/Crashlytics/Remote Config, UMP, ads/billing | SDKs reais em projetos de teste; LGPD/Data Safety; caps/cooldowns dos dados; recibos/restauração/offline; nenhuma credencial real em Git. |
| **F12 — pendente** | Core + serviços integrados | Áudio, profiling, QA e evidências de dispositivo | Mix/ducking, memória/GC/draw calls/atlases/build; foco/interrupções/save/migrações/reinstalação/offline/GPUs; 60 FPS/crash-free/estabilidade medidos, não simulados como evidência física. |
| **F13 — bloqueada** | Critérios de QA/release atendidos | Pipeline assinatura, APK/AAB, store/privacy/ASO | Build reproduzível, closed testing com AAB e brutos/gravações, Play Console/consentimento/Data Safety/screenshots reais; rollout gradual observável com rollback. Sem evidência bruta, não declarar teste reproduzível. |

### 9.3 Vetores e impacto econômico esperado

- F1: **nenhum** vetor, dado de jogo ou número econômico deve mudar; comparar saída longa.
- A-07: contadores de estado/save e futuros consumidores de conquistas; não adiantar prêmios.
  A-08: `counters.burnedFood` nos vetores de turnos que servem queimados e `burnedRate`;
  menos contagem não significa melhoria de habilidade. A-09: primeira chamada deve manter
  recompensa; chamadas repetidas não geram moedas/XP. Vetores de primeira chamada podem não mudar.
- A-01: cooking/scoring de costela/cupim e turnos avançados; renda/perfect podem subir.
  A-02: composição de pedidos e seeds dos 12 turnos; curva inicial/unlocks/renda mudam;
  FTUE roteirizado deve permanecer. A-03: prep real deve melhorar pedidos concluídos na UI;
  tempo/slots podem afetar sim. A-04: calor/capacidade/turnos avançados e progressão de grills.
  A-05: spawn RNG/VIP/recompensas; medir renda sem rewarded e verificar ausência de pay-to-win.
- A-06: consumidores de stats, economia e turnos; excluir compras no-op provavelmente reduz
  spend ratio. Investigar sinks reais; **não** ajustar preços só para restaurar guardrails.
- Mudanças de save/contrato em F5 também exigem vetores e migrações. Regenerar apenas de modo
  explícito, após revisar expectativas; C# fica bloqueado se houver contrato reconhecidamente falso.

### 9.4 Decisões de produto (não bloqueiam F1/F2)

1. **A-01 — recomendação, ainda não aprovada:** `sides:1`, mantendo `flipNeeded:false` para
   os cortes lentos. Preserva a fantasia low-and-slow já documentada e reduz microgestão tardia.
   Alternativa: exigir virada e ensinar no bot/UI/tutorial/docs. Confirmar antes de editar dados.
2. **A-04 — recomendação, ainda não aprovada:** manter a quarta zona prometida, implementada
   ponta a ponta, inclusive nas churrasqueiras equipadas (não só grelha default). Confirmar
   desenho/progressão e calor; alternativa é remover promessa de todos os contratos/textos.
3. **A-05:** confirmar chance/fonte, teto diário persistido e `call_vip` como conveniência,
   nunca requisito de progressão; testar renda sem anúncios.
4. **A-06:** priorizar prep/board junto de A-03; ocultar por flag os no-ops restantes até
   consumidor testado, sem deixar compras do bot passarem. Aprovar eventual impacto em saves
   com compras antigas antes de decidir reembolso/migração.
5. **F5:** confirmar streak/dia de graça (doc e código divergem) e início de offline;
   não escolher silenciosamente uma regra que altere recompensas.

### 9.5 Checkpoints de commit e PR

1. Commit de planejamento/baseline (sem semântica).
2. F1: testes red → implementação green + integração gate/CI, commit coerente sem binários.
3. Commit de encerramento: resultados, status e handoff; abrir PR F1 para `main` pela branch
   `arena/01a0e03e-game-churrasqueiro`, aguardar CI remoto e registrar resultado. **Não mergear.**
4. F2: commits separados por A-07/A-08/A-09 com prova red/green e diff de vetores revisado;
   PR/grupo independente depois de F1 (mesma branch enquanto durar esta sessão).
5. F3: checkpoints por achado/decisão; F4 um checkpoint de revalidação. F5 por contrato;
   F6 isolada; F7 inventário+extrações; F8 por port; F9–F13 por milestone com evidências.
   Cada fase fecha com docs sincronizadas, testes e verificações da tabela; merge só com dono.


### 9.6 Encerramento F1 — 2026-09-27

- Planejamento/baseline: `70a60b3`; implementação gate/testes/CI: `ad29b56`.
- Prova red: 49/49 testes iniciais falharam antes de existir o gate; a reprodução anterior
  mostrou `check-art` aceitando um WebP órfão. Depois: **52/52** testes do gate (46 negativos,
  6 positivos), incluindo status não aprovados fora do bundle e aprovação adicional válida.
- Contrato: `tools/art/check-art-registry.ts` é somente leitura; inventaria recursivamente
  masters e runtime, rejeita links/caminhos inseguros/duplicatas/CSV malformado, confere saídas
  contra `art/lote-NN.json` e manifesto, `includePending:false`, cobertura approved e lookups.
  Baseline nominal independente dos **244 IDs** de PR #13 bloqueia deleções coordenadas e
  trocas que mantêm a contagem. Não é regenerado pelo builder. Novos approved são permitidos;
  remoção/substituição de IDs protegidos exige revisão explícita desse contrato.
- Escopo da prova: metadados/inventário do checkout (inclui arquivos órfãos não indexados),
  não autenticidade da aprovação humana ou equivalência de pixels WebP/PNG. `check-shots`
  continua decodificando todos os 244 sprites; não foi substituído/enfraquecido.
- Final local: **254/254 testes em 14 arquivos**, **14/15 gates**; único SKIP = C# sem .NET.
  Schemas/dados 22, vetores 98 + 44, draws 144, screenshots 13; FTUE inalterado.
- `sim:long`: **18/18**, saída integral idêntica ao baseline (diff vazio); economia não retunada.
  `npm audit` novamente exit 1, mesmas 5 vulnerabilidades; major fica na F6 isolada.
- Zero alterações de masters, runtime, dados, schemas, vetores ou contratos de gameplay.
  Nenhuma decisão de produto aplicada. A-01–A-09 e F2–F13 continuam abertas/bloqueadas conforme §9.2.
- Próxima ação: A-07, testes inicial/sequencial/repetido/restauração/metas de conquistas;
  depois A-08/A-09. Não iniciar Unity/C# nem arte nova. PR #14 aberto, **sem merge**. CI **15/15**, incluindo C#, aprovado em `92976b2`: [run 36282761422](https://github.com/berger33/game_churrasqueiro/actions/runs/36282761422).


| Data | Passo operacional | Status | Branch/PR | Evidência |
|---|---|---|---|---|
| 2026-09-27 | F1 / histórico 1.4 | concluído, PR aberto sem merge | `arena/01a0e03e-game-churrasqueiro` / [#14](https://github.com/berger33/game_churrasqueiro/pull/14) | 254 testes; 14/15 locais (C# SKIP); 15/15 no CI run 36282761422; sim longo 18/18 sem diff |
