# 23 — Plano de Implementação e Melhoria (passo a passo)

> **Fechamento econômico revalidado (2026-09-27):18/18, exit0.** Após autorização
> explícita `late_income`, renda tardia ajustada no runtime, mantendo preços, histórico,
> FTUE, offline e todas as metas.672 testes,53 capturas,157+44 vetores; C# SKIP.
> A-06.5 **não foi iniciada**. Registro anterior abaixo é histórico; relatório vigente:
> [evidence/a06/step4/reopened/README.md](evidence/a06/step4/reopened/README.md).

**Atualização operacional:** 2026-09-27 · branch `arena/01a0e099-game-churrasqueiro`
**Histórico:** plano original de 2026-09-26 preservado nas seções 1–7 e no registro.
**Status:** ativo — este é o documento-guia do dia a dia. Na dúvida sobre o que fazer
a seguir, a resposta está em "Próximo passo imediato" (§8).

**Fechamento autorizado pelo dono (2026-09-26 local):** integrar PR #14 e excluir
somente branches integradas. PRs #7/#8 e suas branches foram **explicitamente preservados**.
Este registro precede a operação no GitHub; o recibo final/CI está no PR #14. Na próxima
sessão, confirmar MERGED/main antes de codar. A autorização não vale para merges futuros.
PR #14 confirmado MERGED em `e50ce15` nesta sessão; CI do merge verde.
Handoff consolidado: `docs/24-PROMPT_PROXIMA_SESSAO.md`; próximo A-06, economia pendente.
A-03/A-04/A-05 validados localmente em §9.14–9.16; nenhuma nova autorização de merge inferida.
Os registros de checkpoints abaixo preservam o estado histórico anterior à autorização.

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

- [ ] **Gap entre Festival e Rede Nacional** (histórico 767 turnos; A-01: 476, 383→859, com unlock precoce fora da meta): validar com telemetria
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

👉 **Próximo checkpoint: A-06.5 — revisão final das27 trilhas, ainda em F3.**
A-06.0–4 concluídos localmente (§9.17–9.22);27 consumidores integrados.
Reabertura econômica autorizada por `late_income` agora passa18/18 (repete e2 seeds extras).
672 testes,14/15 gates (C# SKIP),53 capturas,157+44 vetores; offline/FTUE/preços preservados.
Ler evidence/a06/step4/reopened/README.md e decisões §8. A-06.5 ainda não foi iniciada.
Preservar o patch, caps de equipe, ausência real e histórico. Sem novas mudanças de
contrato, arte, porta C#/Unity, publicação ou merge sem autorização pertinente.

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
Escopo inicial: baseline, planejamento e F1. Na continuação autorizada pelo dono,
o mesmo PR #14 foi ampliado para **F1+F2+A-01+A-02** (§§9.7–9.12); F3 está em curso, F4–F13 pendentes/bloqueadas. Uma mudança de segurança será isolada em commit/PR, **na branch da sessão**;
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
| **F2 — concluída / PR #14 aberto** | **A-07 → A-08 → A-09**; depois de F1 | `economy.ts`, `turn.ts`, `save.ts` se normalização exigir, testes economy/turn/save, `gen-vectors.ts` só se contrato mudar | A-07: inicial=1, sequência 2..7, repetição sem crédito, roundtrip/save antigo com contador inflado e metas 3/5/7. A-08: queimar+descartar/servir, vários alimentos, resultado/restauração sem contar duas vezes. A-09: 2+ chamadas estruturalmente iguais, moedas/XP não duplicados, serialização e chamadores reais. Reproduzir cada falha antes da correção; gates+sim longo verdes ou divergência econômica explicitamente investigada, nunca retunada por conveniência. |
| **F3 — em curso** | A-01 → A-02 → A-03 → A-04 → A-05 → A-06; decisões abaixo | `ingredients.json`, `grill.json`, `restaurants.json`, `levels.json`, `upgrades.json`, `events.json`, `types.ts`, `cooking.ts`, `turn.ts`, `policy.ts`, `economy.ts`, `prototype/src/main.ts`, tutorial/analytics/audio/l10n, `run-sim.ts` e testes | Janela perfeita costela/cupim e bot avançado; unlock imediatamente antes/no/depois (nível+restaurante), FTUE determinístico; prep com slots/input/hitboxes/pedido misto/paciência/combo/resultado; 4 zonas reais em grelha/bot/UI/calor/screenshots; VIP chance 0/natural/forçado/cap/recompensa/placement; mapa das 27 trilhas (consumidor/fórmula/limite/tela/teste/sim), regras faltantes aprovadas e implementadas; bloqueio de compra durante integração não substitui entrega final. Nove altos resolvidos, nenhuma promessa sem consumidor. |
| **F4 — pendente** | Todas A-01–A-09 corrigidas funcionalmente; consolidar aceite econômico aqui | `shared/data`, schemas necessários, `Assets/Data`, `tools/golden`, docs 06/18/23 | Revisar dados antes de `gen-levels` e `gen-vectors`; revisar cada diff semântico, gates e 1.500 turnos; publicar unlocks/renda/spend/perfect/burned/perdidos/duração/grills. Não aceitar vetores novos apenas por terem sido gerados. |
| **F5 — pendente** | Referência corrigida, antes da porta | `economy.ts`, `cooking.ts`, `policy.ts`, `save.ts`, `prototype/src/main.ts`, dados/l10n, validadores, runner C#, auditoria | Triar 19 médios + 19 baixos. Resolver antes de C#: carvão, ledger brasas, offline, deriveStats/clamps, burned com overrides, vazamento bot, streak, campos mortos, gating funcionários, descrições, avaliadores missões/conquistas, level-up, alvos ignorados, levels commitado e skips C#. Teste reprovando implementação anterior por item; classificar explicitamente o que fica para serviços/device. |
| **F6 — pendente / isolada** | Antes de C#, após fixar contratos | `package.json`, lock, configuração de testes/build necessária | Rever release notes de Vitest/Vite/esbuild e Node mínimo; audit antes/depois; typecheck, 202+ testes, schemas, vetores, sim curto/longo, render, screenshots e C# remoto. Zero vulnerabilidades conhecidas ou impedimento documentado, sem force cego. |
| **F7 — pendente** | Antes da paridade econômica C# | PRs #7/#8 via `gh`, arquivos úteis extraídos no estado atual, registro de decisões | Comparar cada tema com main: útil/obsoleto/conflitante; reimplementar seletivamente com testes. Não fazer merge desses PRs; fechar apenas após revisão registrada. |
| **F8 — bloqueada** | F2–F7 concluídas e contratos estáveis | `TurnSimulation.cs`, `EconomyRules.cs`, `SaveSystem.cs`, `Tutorial.cs`, parity runner | Todos os 20 vetores de turno + 5 econômicos (8 turnos novos em A-01), save v3/migrações e FTUE completos; netstandard2.1/C#9, warnings=erros, **zero not ported**. |
| **F9 — bloqueada** | F8 concluída | Unity 6 LTS: Packages/ProjectSettings/assemblies/cenas/prefabs; importer do manifesto, atlases/.meta; GrillView/FoodView/CustomerCardView/TurnFlow | Turno completo no Editor; input/UI/áudio/save/l10n integrados; 60 FPS em Android médio físico com medição. Arte no bundle não equivale a sistema funcional. |
| **F10 — pendente** | Core Unity | Coleção/missões/conquistas/eventos/loja/passe/rota; en-US/es-419 | Fluxos completos, traduções além dos 11,1%, texto ampliado/contraste/ponto sem só cor/redução de movimento/toque/retorno/telas pequenas e proporções. |
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

1. **A-01 — decisão do dono confirmada e aplicada:** manter `sides:2` e habilitar
   `flipNeeded:true` para costela/cupim. Rejeitada a recomendação anterior `sides:1`.
   Cozimento lento preservado, bot/UI/textos alinhados, FTUE sem mudança de roteiro.
   Correção funcional validada; três desvios de economia longa impedem aceite econômico.
2. **A-04 — decisão do dono confirmada e aplicada (§9.15):** manter4 zonas, mas **exigir
   Fornalha E restaurante Premium** no equipado; média extra1×, com escala/teto atuais.
   Todas as evoluções da Fornalha expandem no índice4+; demais equipamentos continuam1/2/3.
   Rejeitada a recomendação de ampliar qualquer churrasqueira. Não reabrir esta escolha.
3. **A-05 — decisões confirmadas/aplicadas (§9.16):** por chegada; zero explícito bloqueia
   natural; fallback6%, bônus semanal ativo +4pp sobre base positiva;2/dia natural+chamado
   juntos, reset UTC, chamado de teste explícito. Natural progride sem rewarded.
4. **A-06 — contrato aprovado (§9.17):** todos os grupos definidos; preservar níveis,
   sem reembolso automático. Recursos/equipe aprovados, offline índice3, Gerente somente
   offline, extras no backlog. Bloqueio temporário protege compras, mas não encerra A-06.
   A-06.1–4 concluídos (§9.18–9.21); próximo A-06.5. Não repetir decisões de design/histórico.
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

### 9.7 Continuação F2 — concluída (local e CI) (2026-09-26 local / 27 UTC)

Pedido do dono: “Próximo passo”. Branch mantida; PR #14 continua aberto, não integrado.
Baseline reexecutado em `3f1c9c6`: Node 22.22.3/npm 10.9.8, `npm ci`, 254 testes,
14/15 gates locais (C# SKIP), sim longo 18/18 e audit com as mesmas 5 vulnerabilidades.

Execução: A-07 → A-08 → A-09, um commit por correção após red/green. A-07 deve inicializar
contagem em 1, atribuir `index+1` ao desbloquear e normalizar o contador derivado ao carregar
saves v1/v2/v3, preservando demais contadores/recompensas e checksum. A-08 terá o evento
único de queima da grelha como fonte; servir não pode somar novamente. A-09 será cálculo
puro: bonus no retorno, acumuladores intactos, sem cache prematuro durante turno em curso.
Testar resultado → crédito único → save/load; não prometer restauração de turno em andamento
(o SaveGame atual não serializa TurnSimulation). Revisar todos os chamadores reais.

Não há decisão de produto bloqueante. Sem retuning, dados ou portas C#. Verificar drift
antes de decidir sobre regeneração; se os vetores existentes não exercitarem os defeitos,
registrar a ausência de diff e manter regressões explícitas na suíte. Ao encerrar, atualizar
status/auditoria/economia/handoff e CI. Como o PR #14 está aberto na única branch permitida,
os novos commits ampliarão esse PR para F1+F2; não abrir PR duplicado nem fazer merge.

**Checkpoint A-07 — concluído:** 8 regressões adicionadas, 7 falhando no código antigo
(inicial ausente, sequência 2/5/9/14/20/27, metas antecipadas e saves não normalizados).
Depois: 55/55 testes economy/save; suíte completa 262; gates 14/15 (C# SKIP).
`sim:long` 18/18, saída idêntica; 98+44 vetores sem drift, não regenerados.
`newPlayerState` inicia em 1; unlock atribui a quantidade; load após CRC repara v1/v2/v3.
Shape/versionamento v3 mantidos; recompensas já reclamadas e outros contadores preservados.

**Checkpoint A-08 — concluído:** 4 regressões novas, 3 vermelhas antes da correção
(um item servido contabilizava 2, três itens contabilizavam 5, resultado/save carregavam
contagem inflada). Fonte única = transição `onBurn` da grelha; não somar no serve.
Após correção: 23/23 testes de turno, total 266; gates 14/15 e sim longo 18/18 sem diff.
Vetores 98+44 não mudaram: o bot descarta queimados antes de servir, não exercitando o bug.
Não regenerados. A regressão de serve queimado exige burn/items=1, não 2. Histórico de
burns em saves existentes preservado: não é possível reconstruí-lo sem diário por item.

**Checkpoint A-09 — concluído:** 6 testes novos + 2 testes de consumidores fortalecidos;
todos os 8 falharam antes da correção, incluindo reprodução exata 745→842 e FTUE 86→127.
`result()` agora calcula o bônus somente no retorno, arredonda sem alterar moedas/XP e
entrega snapshot de eventos sem aliases mutáveis. Leituras durante o turno não congelam
um resultado prematuro. Crédito de carteira continua responsabilidade do chamador:
`applyTurnResult` não se tornou um ledger idempotente de resgates.
Verificados consumidor FTUE, replay dos 12 vetores e passos 1/20 e 1/30; gates reais também
executam protótipo, simulador e gerador em modo `--check`. 272 testes; gates 14/15 locais;
sim longo 18/18, saída integral idêntica; vetores 98+44 e FTUE/sprites inalterados.


### 9.8 Fechamento F2 e contratos alterados

- Commits: `5803806` A-07, `f2958d6` A-08, `02e7f61` A-09; PR #14 ampliado para F1+F2,
  ainda aberto e **sem merge**. CI remoto F2 **15/15 aprovado** em `faf2081`: [run 36283526080](https://github.com/berger33/game_churrasqueiro/actions/runs/36283526080).
- Baseline 254 → **272 testes**, 14 arquivos. Foram adicionados 18 testes e fortalecidos
  2 existentes (replay dos 12 turnos e consumidor FTUE). Cada defeito teve prova red/green.
- Contratos TypeScript: `PlayerState.counters.restaurantsUnlocked` representa a quantidade
  incluindo o quintal; `migrate`/load normaliza esse contador após CRC em todos os saves
  suportados, inclusive v3. Não mudou a forma do JSON ou a versão do save.
- `TurnCounters.burnedFood` conta transições únicas de queima, não serves; histórico antigo
  sem diário por item não é recalculável e permanece intacto. SaveGame não salva turnos ativos.
- `TurnSimulation.result()` devolve snapshot puro e independente, com bônus no retorno.
  `sim.coins`/`sim.xp` continuam acumuladores pré-bônus; chamadores devem usar o retorno.
  Leitura não concede recompensa e não torna `applyTurnResult` idempotente.
- Dados, schemas, levels, golden JSONs e imagens não foram alterados. Revisão do gerador:
  vetores não cobrem sequência de unlock/save; turnos do bot descartam queimados e fazem
  só uma leitura final. Logo **nenhum dos 98+44 vetores muda**, embora os bugs sejam reais.
  `check-vectors` foi executado em cada checkpoint; nenhuma regeneração automática.
- Economia: saída integral do sim longo idêntica ao baseline em A-07, A-08 e A-09.
  18/18 guardrails, spend 0,741, perfect 71,8%, burned 5,7%, perdidos 6,9%, duração 169,8 s.
  Não retunamos números. F4 ainda depende de A-01–A-06; não declarar a economia estabilizada.
- A-01–A-06, dívida média/baixa, dependências e paridade C# continuam pendentes. Regressões
  desta F2 também precisam ser portadas/testadas em F8, além dos vetores existentes.
- Próximo à época (superado pela decisão oposta em §9.9): decisão A-01 (`sides:1` recomendado, então não aprovado) → janela perfeita/bot
  avançado → revisão semântica de dados/vetores/economia; depois A-02. A-04 ainda exige
  decisão explícita da quarta zona. Sem arte nova, C# ou Unity antes da estabilização.

`npm audit` final repetido com timeout/retries limitados após um timeout de rede: exit 1, mesmas 5 vulnerabilidades. Nenhuma dependência alterada.


**CI F2 confirmado:** 15/15 gates, incluindo compilação/checks C#, run `36283526080`
(commit `faf2081`). Paridade existente: 139 checks; continuam 5 vetores econômicos e 12
turnos não portados. Avisos do runner: actions v4 usam Node 20 e são executadas sob Node 24;
ubuntu-latest migrará para Ubuntu 26. Triar actions/imagem junto do tooling na F6, sem
confundir com o Node 22 configurado para npm. PR #14 aberto, merge não autorizado.

### 9.9 F3 / A-01 — decisão confirmada e execução iniciada

O dono selecionou **“Exigir virada”** na pergunta de produto desta continuação.
Decisão vigente: costela/cupim continuam `sides:2`, passam a `flipNeeded:true`.
A recomendação anterior de `sides:1` foi **rejeitada**, não será aplicada.
Cortes lentos mantêm zona baixa, tempos, janelas, preços e recompensas; a virada garante
cozimento das duas faces e usa o gesto já ensinado no FTUE, sem roteiro introdutório novo.

Baseline reexecutado em `ec8ce1b`: árvore limpa, mesma branch, PR #14 aberto sem merge;
Node 22.22.3/npm 10.9.8; npm ci; 272 testes; gates 14/15 (C# SKIP); sim longo 18/18.

Plano deste checkpoint: reproduzir cru→queimado sem virada; testes vermelhos de contrato,
janela perfeita seguindo os dados e bot em restaurantes avançados. Alterar só os dois flags
+ versão de ingredients; sincronizar Assets/Data. A fórmula do bot já lê flipNeeded e não
precisa de tuning. UI deve usar a dica contextual de virada já ensinada no FTUE e textos
localizados. Dependência localizada descoberta: C-06 `.slice(0,8)` esconde ambos os cortes
na bancada. Resolver só esse bloqueio com paginação de oito itens, desenho e hitbox juntos,
sem antecipar A-02 (gating por nível) ou A-03 (prep). Verificar gesto real em harness.

Revisar drift de schemas/levels/vetores antes de regenerar. Os 12 turnos golden atuais só
cobrem restaurantes 0/1; podem mudar apenas metadados de versão. Adicionar regressões
avançadas explícitas e relatar janelas/curva de habilidade em vez de presumir cobertura.
Depois gates+sim longo, screenshots, economia/documentação/handoff e CI no mesmo PR.
Se guardrails econômicos falharem, manter os alvos/preços e registrar o desvio/bloqueio;
não desfazer a correção funcional nem mascarar o efeito com tuning oportunista.


### 9.10 Checkpoint A-01 — funcional validado; aceite econômico pendente

- Dono rejeitou um lado e escolheu virada obrigatória. `ingredients` v5→v6: somente
  `costela/cupim.flipNeeded` false→true, mantendo 2 lados. Validador semântico protege
  receita multi-face; bot já consumia o flag, fórmula/tuning intactos. Assets/Data sincronizado.
- Regressões vermelhas: regras 17/19, UI 4/6, seleção de vizinho 1/8 (falha no harness
  real ao tentar virar cupim ao lado da costela). Correções mínimas de UI dependentes:
  bancada paginada (8 itens, botão 140×56), dica espera dourar/usa regra do FTUE, target
  vizinho mais próximo sem reduzir área. C-06 só resolvido quanto à truncagem, não l10n total.
- **299/299 testes**, 16 arquivos; **14/15 gates locais**, C# SKIP sem SDK. `sim` curto
  verde; **sim longo 15/18, exit 1**, deliberadamente não mascarado. Novos textos pt/en/es;
  17 screenshots, 244 sprites; FTUE 16,1/32,9/38,3 s e zero erros. Fixture avançada não é
  desbloqueio natural/campanha nova. Rótulos vizinhos ainda se sobrepõem: polish futuro.
- Revisão antes de gerar: schemas, tipos C# e 60 níveis autorais sem mudança. Vetores
  antigos **98+44 intactos em input/expect**, só metadado ingredients 5→6. **8 novos turnos**
  restaurantes 3–6 × skills .55/.85 com uso efetivo dos cortes: total **106+44**.
  Replay fortalecido; C# passa a 5 econômicos + 20 turnos **not ported**, não esconder.
- Economia: renda **22.675.447**, gasto **10.873.220**, saldo **11.802.227**; spend **0,480**;
  perfect **75,9%**, burned **0,2%**, perdidos **3,7%**, duração **173,4 s**. Restaurantes
  **32/89/147/239/383/859**; grills **7/45/90**. Renda L5/L15/L30/L50:
  **10.793/41.115/114.616/182.381**. Falhas: rede 859 vs 950–1450, L50 182.381 vs
  98.000–152.000, spend 0,480 vs 0,70–0,99. Nenhum alvo/preço/janela/tempo relaxado.
- Curva adicional avançada com 8 seeds por skill/tier confirma perfect e renda crescentes
  com skill; a curva autoral 0/1 sozinha não testa os cortes. Janelas físicas em 3 zonas,
  raw→burned sem virada e logs/JSON antes/depois em **`docs/evidence/a01/`**.
- npm audit continua **5 vulnerabilidades (1 crítica, 1 alta, 3 moderadas)**; sem force-fix,
  dependências/lock intactos. Portas C#/Unity/merge bloqueadas; nenhuma arte ou serviço novo.
- A-07/A-08/A-09 encerrados; A-01 funcional corrigido com aceite econômico pendente;
  **A-02–A-06 ainda abertos**. F3 não encerrada. Próximo checkpoint A-02, transportando
  os desvios para F4 após as demais correções, sem pedir novamente a decisão A-01.
- Commits: `331e1bb` decisão, `579c846` dados/validador/UI/testes/vetores, `8b042ca`
  docs/evidências. Todos enviados à branch da sessão, PR #14 aberto/sem merge.
- **CI remoto A-01: 15/15 aprovado** em `8b042ca`, [run 36285270473](https://github.com/berger33/game_churrasqueiro/actions/runs/36285270473).
  C# confirma **139 checks**, declara **25 not ported** (5 economia + 20 turnos).
  Anotações de Node20 nas actions/Ubuntu26 continuam dívida F6, não falha de gameplay.
- Tentativa de disparar Nightly manual na mesma branch retornou **403 Resource not
  accessible by integration** (permissão de dispatch). Portanto evidência longa é
  **local**, repetida e idêntica; não foi alegada execução remota do longo. Nenhuma
  credencial solicitada/inserida. O verde do CI por PR não contradiz os 3 alvos falhos.

### 9.11 A-02 — registro de início (concluído funcionalmente em §9.12): nível do jogador no contrato

Baseline `223b843`, árvore limpa, branch da sessão, fetch/ancestralidade PR13 e PR14 aberto
sem merge confirmados. npm ci, 299 testes, gates 14/15 (C# SKIP), sim longo 15/18 com os
mesmos três desvios A-01, sem retuning. Regressões anteriores à correção em evidence/a02.

Contrato previsto: `TurnConfig.playerLevel` obrigatório, inteiro positivo, snapshot no
início do turno; não inferir de `levelId`, índice da campanha ou tier do restaurante.
Pedido natural, estoque/bancada e pedido roteirizado exigem **nível E restaurante**.
Evitar clientes com menu vazio (inclusive unusualOnly); erro explícito em chamada forçada
sem ingredientes elegíveis. FTUE explicita nível 1, mantém seus pedidos/tempos/seed.
Sim progressivo passa p.level; UI passa meta.level; curva de skill acompanha XP/nível a
partir de newPlayerState por skill, sem alterar sua política/grill/upgrades. Fixtures
isoladas passam níveis explícitos justificados; nenhum default que libera todos os itens.
Vetores existentes de turnos ganham playerLevel e cenários iniciais 1/4/8/14; os oito
avançados usam 44 (ambos cortes disponíveis). Revisar cada expectativa antes de aceitar.
Próximo checkpoint depois deste: A-03 prep, sem escondê-lo do pool para evitar implementação.


### 9.12 Checkpoint A-02 — desbloqueio funcional validado; economia global pendente

- `TurnConfig.playerLevel` obrigatório/integral/positivo, snapshot no início, não índice
  de fase. Catálogo único exige **restaurante E nível** para pedidos, estoque, bot e UI;
  pedido roteirizado também respeita. Rejeita menu vazio; unusualOnly só sorteado quando
  existe receita não comum elegível. Forçar cliente sem receita gera erro, nunca pedido vazio.
- Sim passa p.level, UI meta.level, FTUE1; curva de skill inicia jogador1 por skill e
  acumula XP via regra, sem compras. Relatório expõe contexto/catalogo/pedidos reais.
  Fixtures isoladas de mecânica usam44 explicitamente; nenhum default em produção.
- **50/50 regressões vermelhas antes**; **2/2 regressões de wiring** detectam callers
  artificialmente44. Harness vermelho com bancada antiga (tentativa de legumes bloqueados),
  restaurado em finally. Agora **351/351 testes**, 18 arquivos, gates locais **14/15**, C# SKIP.
- UI real: níveis1/5/6/7 no save, catálogo/pedidos coerentes, sem hitbox fantasma,
  queijo arrastável exatamente6 e depois7; **19 screenshots**, 244 sprites. FTUE mantém
 16,1/32,9/38,3s, zero misses. Fixture não prova metaprogressão completa do protótipo.
- `vectors.version`1→2, playerLevel nos20 turnos. Perfis iniciais1/4/8/14: **9 expectativas
  mudam**, 3 de nível14 e8 avançadas nível44 preservadas. Cooking48/scoring32/economy6
  intactos;44 FTUE byte a byte idênticos. Total106+44; sem schema/data/save/level/C# gerado.
  Diff por caso em `evidence/a02/vector-review.json`; C# continua25 not ported.
- Sim longo: **15/18, exit1**. Renda22.233.557, gasto10.873.220, saldo11.360.337;
  perfect75,7%, burned0,2%, perdidos3,5%, duração172,5s. Restaurantes42/98/165/259/398/883;
  grills10/45/89; renda L5/15/30/50=10.480/39.445/108.533/192.223. Falhas mantidas:
  rede883 vs950–1450, L50=192.223 vs98.000–152.000, spend0,489 vs0,70–0,99.
  Curva .55 passa de55,7%/793 moedas para46,0%/571; agora só recebe receitas desbloqueadas
  por XP real. Probe avançado A-01 inalterado no perfil44. **Nenhum tuning/limite alterado.**
- npm audit mesmas5 vulnerabilidades (1 crítica/1 alta/3 moderadas); sem force-fix.
  Longo local; permissão Nightly foi negada403 na etapa anterior, não alegar longo remoto.
- A-01/A-02 funcionais, **A-03–A-06 abertos**. Próximo A-03 prep; manter gates e transportar
  desvios econômicos para F4. Documentos/evidências atualizados. Sem C#/Unity/arte/merge.
- Commits enviados: **8d6fbde** implementação/testes/vetores, **44ccf11** docs/evidências.
  **CI remoto15/15 aprovado** em44ccf11: [run36286427123](https://github.com/berger33/game_churrasqueiro/actions/runs/36286427123),
  incluindo C#139 checks com25 casos explicitamente não portados. Anotações Node20/Ubuntu26
  continuam F6. PR14 ampliado, aberto/sem merge; consultar corpo do PR para CI do HEAD final.
  O CI por PR não roda longo; suas3 falhas locais permanecem registradas e bloqueiam aceite global.


### 9.13 Fechamento solicitado — merge PR #14 e retomada em nova sessão

- O dono pediu merge completo do trabalho desta entrega, limpeza de branches e prompt
  completo. Isso autoriza **PR #14**, não a incorporação cega dos PRs antigos #7/#8.
- Na confirmação de limpeza, escolheu **preservar #7/#8** para revisão seletiva (F7).
  Não foram fechados, descartados nem autorizados para merge.
- Branches remotas a remover **somente após verificar integração e SHA**:
  - PR #12 `arena/01a0dfd3-game-churrasqueiro`, head `eb2065e2262e21d41d59389695f75ead6111fe3d`;
  - PR #13 `arena/01a0e001-game-churrasqueiro`, head `74a105e5c67075a6d69fe7672bd140566b78c6c2`;
  - PR #14 `arena/01a0e03e-game-churrasqueiro`, após merge do HEAD final.
- Preservar `main`, PR #7 (`arena/01a0daed-game-churrasqueiro`) e PR #8
  (`arena/01a0de76-game-churrasqueiro`). Não trocar de branch local durante esta sessão.
- Handoff24 foi consolidado: estado atual, contratos F2/A-01/A-02, 351 testes, vetores,
  economia15/18, A-03 detalhado e toda a sequência até publicação. Histórico continua
  neste plano, auditoria, evidence e Git (handoff anterior em `7a591f3`).
- CI funcional pré-fechamento **15/15** em `7a591f3`, run `36286499059`; C#139 checks,
 25 casos não portados. O commit documental de fechamento também deve passar CI antes
  do merge. Confirmar resultado final/merge SHA no PR #14 e na nova sessão.
- **Integração não é aceite econômico/publicação:** as3 falhas longas permanecem
  intencionais e evidenciadas; sem retuning, enfraquecimento de gates ou porta C#/Unity.
  Nenhuma nova correção funcional foi adicionada neste fechamento.


### 9.14 Checkpoint A-03 — funcional validado localmente (2026-09-27)

- Base real conferida antes de editar: `HEAD == origin/main == e50ce15`, árvore limpa,
  PR #13/#14 MERGED; CI main [36287025604](https://github.com/berger33/game_churrasqueiro/actions/runs/36287025604)
  verde. PRs #7/#8 abertos/preservados. Texto colado anterior ao PR14 não foi usado para
  refazer F1/F2/A-01/A-02. Branch mantida `arena/01a0e099-game-churrasqueiro`.
- Estoque não prepara sozinho. Admissão explícita `startPrep`; slots por restaurante+tábua,
  tempo por receita/faca; porção pronta retém capacidade até serviço válido/descarte.
  Grelha rejeita prep na API de turno; serviço antecipado/duplicado/cliente errado não paga.
- UI nível12+ usa catálogo completo; tap/drag, estação com progresso/PRONTO, pedido/descarte,
  cancelamento seguro,10 vagas paginadas e alvos>=48. Seis textos em pt/en/es; arte/áudio existentes.
- Red: regras15/16 (uma proteção de unlock já passava), layout2/2, bundle falha por vinagrete
  ausente no12. Green369/369 em20 arquivos;18 novos + teste prep antigo fortalecido.
  Pedido misto/paciência/combo/moedas/XP/resultado em regra; UI serve pedido natural UID10
  com ponteiro real, sem hooks mutadores. 24 PNGs/244 sprites, FTUE16,1/32,9/38,3s/zero misses.
- Gates14/15 locais (C# SKIP),106+44 vetores não regenerados/sem drift; gen-levels diff vazio.
  Sem mudanças em schemas, dados gameplay, save, Assets/Data, C# ou Unity.
- Sim longo15/18, saída inteira idêntica ao baseline A-02. Bot inicia prep no mesmo tick,
  ainda uma porção ativa por ingrediente; humanos podem usar várias vagas. Não alegar que
  a economia aprovou tábua ou que os no-ops A-06 desapareceram. Vazamento grill A-15 preservado.
- Logs red/green, recibos da base, contratos e limites: **docs/evidence/a03/**.
  Esta entrega sem push/PR/CI remoto/merge. CI verde citado é da base, não do patch.
- A-03 funcional concluído; **A-04–A-06 ainda abertos**, F4/economia bloqueados.
  Próximo à época: decisão explícita A-04, agora aplicada em §9.15. Sem antecipar porta C#/Unity.


### 9.15 Checkpoint A-04 — decisão aplicada, funcional validado localmente

- Após “Próximo”, fetch confirmou maine50ce15 sem avanço e A-03 local preservado.
  Dono escolheu **implementar4 zonas**, depois **exigir Fornalha** (não ampliar todas)
  e **média extra1×**. Premium é índice4; contrato conjunto em dados `restaurantExpansion`.
- `grill`v3→4 acrescenta auxiliar `medium_extra`; `churrasqueiras`v1→2 declara expansão
  apenas na Fornalha. Perfil baixa/média/alta não é esticado pela linha extra; mantém
  calor/IDs/bonus anteriores. Extra herda média. Contagem chega a stats/patch/bot/UI.
- Validação rejeita contagem impossível, expansão/fonte/índice inválidos e ausência da
  marca auxiliar; construtor não clampa promessas. Home/HUD/renderer/drop concordam;
  aprovação de arte respeitada,4 faixas compostas na boca existente. Textos localizados.
- 42 novos testes (41 regras/dados+1 wiring),411/411 em21 arquivos. Red16/29 iniciais,
  validação/metadados/construtor/bundle/contexto com falhas comprovadas. Bot com3 zonas
  cheias usa4ª; janela perfeita dos cortes nas4. UI coloca/move/vira/serve pedido natural
  misto na4ª, sem hook mutador.29 PNGs,244 sprites, FTUE16,1/32,9/38,3s/zero misses.
- Gates14/15 locais (sem .NET), sem alegar CI novo. Regeneração revisada:2 schemas,
 2 DTOs C# **gerados**,2 Assets/Data+manifest. Nenhuma regra C# portada.
- 106+44 vetores: cooking48/scoring32/economy6/12 turnos iniciais/44FTUE intactos;
 8 avançados ganham contagem/calores, só3 resultados skill.55/rest4–6 mudam.
  Gerador usa zonas reais do restaurante1 fixado, sem gerar um fixture inválido na4ª.
  `gen-levels` sem diff. Dados de custos/recompensas/metas/receitas/save inalterados.
- Longo1500 idêntico ao A-03,15/18. Snapshots confirmam1241 turnos com4 zonas e0 ticks
  ocupados na4ª após o bot mover às zonas ideais. Não alegar ganho marginal medido nesse
  sim. Probe128 turnos/8seeds/skills.30/.55/.85/1 registra impacto de capacidade sem upgrades.
  F4 segue bloqueado pelos3 desvios; política/tuning não adulterados para forçar melhora.
- Evidências e limites: **docs/evidence/a04/**. A-03/A-04 preservados na mesma branch,
  sem push/PR/merge/CI remoto novo. Próximo à época: A-05/VIP (agora §9.16), depois A-06/F4.


### 9.16 Checkpoint A-05 — VIP funcional validado localmente

- Fetch confirma maine50ce15/PR14 integrado, A-03/A-04 preservados. PR7/8 abertos/intactos.
  Dono escolheu chegada, cap2 compartilhado, UTC, chamado de teste explícito. Decisões encerradas.
- Chance de nível encaminhada por UI/sim/gerador; zero bloqueia natural mesmo em evento,
  fallback6%, calendário semanal VIP +4pp sobre base positiva. RNG separado não perturba
  chegadas comuns quando não há VIP. Gating restaurante>=1, catálogo A-02, vaga/cap reais.
- `vip.ts` consome config existente, persiste cota/reserva/TTL/cooldown/callback único.
  Reserva ocupa cota até chegar, inclusive se atravessar dia. Cancelamento/falha não concede;
  cota é de visitas, não só serviço bem-sucedido. Save corev4, migração v3/CRC/progresso
  preservados. Browser mantém Meta/localStorage, não é envelope CRC nem antifraude de servidor.
- Pedido completo incrementa vipServed uma vez; gorjeta amortecida existente, sem bônus por
  fonte. Só conquistas VIP1/25 têm consumidor novo. Ledger de claims deve ser consultado ou
  migrado pelo futuro avaliador geral; não declarar B-08/global achievements concluído.
- Analytics locais e áudio de chegada integrados; Home identifica simulação sem cobrança,
  concluir/cancelar; restaura reserva/cooldown/cap. Apenas modificador VIP tem calendário,
  não todos os eventos/metagame/SDKs. Sem arte nova ou porta C#/Unity.
- 44 testes novos red→green, **455/22 arquivos**, gates14/15 locais (C# SKIP),37 PNGs/244
  sprites, FTUE16,1/32,9/38,3s/zero misses. Regressão de caller impede cap novo por turno
  e chance autoral ignorada; ponteiro real cozinha/vira/serve picanha+coração para VIP.
- 114+44 vetores explicitamente regenerados/revisados.20 turnos anteriores mantêm resultados
  com novos counters zero; seus seeds não exercitavam VIP.8 novos casos de chegada/cota/
  reserva/chance/fallback/evento.44 payloads FTUE iguais, analytics metadata5→6. Primitivas
  intactas, levels sem diff. Um schema/tabela analytics+Assets manifest sincronizados;
  gerador C# conferido, sem novo DTO/regra C# alterado por A-05.
- Longo1500 **15/18**: renda22.302.178, gasto10.873.220, spend0,488, rede881, rendaL50=191.586.
  Mesmos3 tipos de desvio, sem mexer metas/política/preços. Controle VIP off reproduz A-04;
  natural sem rewarded tem244 visitas/232 servidos e progride até80/rest6; chamado opcional
  mantém244/cap2,236 servidos e renda22.276.110 (não inferir efeito geral de uma seed).
  Probe864 turnos complementa curva autoral que não exercita VIP em seus40 níveis iniciais.
- Evidências **docs/evidence/a05/**; sem commit/push/PR/merge/CI remoto novo. Próximo A-06,
  depois F4 e os bloqueios de plataforma. Não reabrir escolhas A-01/A-04/A-05.


### 9.17 Checkpoint A-06.0 — diagnóstico e contrato aprovado

- Branch/base confirmadas, A-03/A-04/A-05 preservados; nenhum commit/push/merge/CI novo.
- `tools/studio/upgrade-audit.ts` executado:12 trilhas com consumidor de turno,13 no-ops,
  2 parciais.13 produzem traces inteiros iguais em skills.3/.85, com inspeção estática
  complementar.27/27 compráveis no início; override anula Capacidade. Gerente altera
  cálculo offline de referência, mas não browser/campanha. Evidências **evidence/a06/**.
- Capacidade de gasto máximo dos13 no-ops:5.866.480 moedas na tabela, não perda histórica
  comprovada ou montante a reembolsar.
- **Escolhas do dono:** definir todas as regras faltantes para aprovação e dividir a
  implementação em subetapas; preservar níveis/progresso sem reembolso automático.
  Apenas ocultar/desabilitar indefinidamente não cumpre esse escopo.
- **Contrato aprovado pelo dono:** `evidence/a06/design-proposal.md`, decisões em
  `evidence/a06/decisions.md`. Recursos/equipe aprovados como propostos; offline no índice3;
  Gerente offline agora, extras de missões/desconto/VIP no backlog sem promessa ativa.
  Parâmetros novos (estoque3s/viagem1,5s) identificados e aprovados. Não reabrir decisões,
  retunar preços ou ampliar escopo; aprovação não equivale a código/evidência funcional.
- Subetapas propostas: compras/efeitos diretos → recursos → equipe ativa → offline →
  revalidação27/economia1500. Cada grupo exige red antes de corrigir, gates/sim, prova de
  UI e review explícito de vetores/save quando houver semântica nova.
- Nenhuma correção de produção ou regressão A-06 foi feita ainda.455 testes/14 de15 gates/
  37 PNGs/15 de18 no longo são baseline A-05, não aceite de A-06. A-06.0 encerrado; próximo
  A-06.1 (red, compras compartilhadas e efeitos diretos). F4/economia continuam pendentes.


### 9.18 Checkpoint A-06.1 — compras e efeitos diretos validados localmente

- Regressões antes de corrigir:29 red/2 controles; UI antiga sem catálogo falha; probe
  de Mestria reforçado com corte de maior valor, sem mudar tabela/arredondamento.78 testes
  novos;533/24 no total.14/15 gates locais, C# SKIP,42 capturas; FTUE16,1/32,9/38,3/zero misses.
- `upgrades.ts` centraliza disponibilidade, níveis efetivos/preço e fases de integração;
  compra/bot/UI usam a mesma regra. Funcionários leem unlocks reais de employees; Faca/Tábua
  exigem prep; Bandeja/Garçom e Logística/índice3 já explicitam dependências futuras.
- Catálogo27 real na Loja; nível histórico/estado/motivo/preço/efeito visíveis, botão pendente
  desabilitado. Atalhos mantidos pelo mesmo serviço. Sem reembolso/reset. Core savev4 intacto,
  roundtrip protege27 níveis/carteira/claims; browser purchaseCounters opcional só para novas
  compras, sem envelope CRC e sem supor histórico completo.
- Capacidade/Mesas somam à base de pedidos, inclusive override; fila paginada, alvos congelados
  durante drag, sem hitbox oculta. UI percorre14 pedidos e serve página2; regra preenche17.
  Mestria só aumenta gorjeta, Clientela paciência; Pratos/Decoração mantêm pagamento legado.
-16 integradas/11 pendentes bloqueadas. Bloquear é proteção de transição, **não fecha A-06**.
  Sem consumidores de recursos/equipe/offline ainda; popup offline antigo continua dívida.
-121+44 vetores,7 turnos com upgradeLevels adicionados explicitamente;28 turnos anteriores,
  86 primitivas e FTUE byte-idênticos ao baseline A-05. Sem aceitar drift de replay.
-1500 turnos:15/18, repetição byte-idêntica; renda24.859.245/gasto8.057.440/saldo16.801.805.
  Falham rede664, rendaL50=208.316, spend0,324. Unlocks40/91/158/251/395/664; grills10/41/79.
  Capacidade de gasto bloqueada2.815.780 explica a queda de gasto nesta campanha; não é
  reembolso nem permissão para retunar. VIP244/231, offline0; F4/economia pendentes.
- Evidências **evidence/a06/step1/**, relatório reproduzível upgrade-step1-report.ts.
  Nenhum commit/push/PR/merge/CI remoto/arte/SDK/C# novo. Próximo **A-06.2**, recursos conforme
  contrato aprovado, depois equipe/offline/fechamento. Não refazer A-03/A-04/A-05/A-06.1.


### 9.19 Checkpoint A-06.2 — recursos validados localmente

- **20 trilhas integradas / 7 pendentes.** Estabilidade recupera perda; Qualidade eleva
  piso; Auto33/66/99% tenta uma vez por saco no limiar22%, RNG isolado, mesma reposição2,2s.
  Sem calor no esgotamento/reposição; sem duração extra/imunidade à queima. Legado heatStability
  do restaurante não foi reinterpretado (A-13/F5). Estoque por ingrediente6+Balcão (máx11),
  débito só em admissão válida, reposição explícita grátis3s, UI/bot no mesmo serviço.
- Cancelamento/erro/vaga cheia não debita nem deixa raw órfão; mover/virar não cobra de novo,
  descarte não reembolsa. Contagem/falta/reposição visíveis, controles48px. Quatro compras
  reabertas somente após consumidores reais; níveis históricos preservados, sem reembolso.
- **565 testes/25 arquivos,14/15 gates locais (C# SKIP),46 capturas,127+44 vetores.**
  FTUE16,1/32,9/38,3s,0 misses,136 moedas.48 cooking/32 scoring intactos; calor emt=1 corrigido;
  7 turnos mudaram por estoque (ablação restaura todos os resultados antigos);28 intactos,
  6 novos.44 FTUE byte-idênticos. DTO/schema/dados gerados não são porta de regras C#.
- Savev4/CRC e browser metakeyv2 mantidos. Recursos são runtime; não alegar retomada de turno
  persistido. C# ainda diverge no calor esgotado, além de41 turnos+5 casos econômicos sem port.
- Longo1500 **15/18, exit1**, repetição idêntica: renda24.816.326/gasto8.089.550/saldo16.726.776.
  Falham rede670, rendaL50=210.171, spend.326. Novas trilhas gastaram32.110; demais preços,
  recompensas/metas intactos. Não há renda offline nesta campanha. A-06/F4 continuam abertos.
- Evidência **[evidence/a06/step2/README.md](evidence/a06/step2/README.md)**. Próximo **A-06.3**,
  equipe/Bandeja, conforme contrato aprovado. Sem publicação, arte nova ou porta C#/Unity.

### 9.20 Checkpoint A-06.3 — equipe/Bandeja validadas localmente

- **24 trilhas integradas / 3 pendentes** (Caixa/Gerente/Logística, A-06.4). Garçom,
  Auxiliar e Churrasqueiro executam ações reais pelas operações legais compartilhadas.
  Serviço/virada têm cap `floor(cobertura × elegíveis distintos)`, incluindo manual no
  denominador; sem crédito por cru/queimado/repetição/falha. Sem rajadas após lag, escolha
  de zona ou chamada de ponto perfeito. Bandeja reduz viagem real1,5→1s, não reação do bot.
- Garçom serve desde bom/prep pronta, espera>1,5s, cliente/porção mais antigos; gorjeta
  automática5/10% só no termo de gorjeta. Nível5 até2/viagem ainda dentro do cap. Aviso3+
  prevê queima em~1s, não a impede. Auxiliar só prep pedida com estoque/vaga, chance/cadência
  da tabela e uma vaga extra3+; Faca/Tábua reais. Churrasqueiro usa sinal público.55.
- **615 testes/26 arquivos,14/15 gates (C# SKIP),49 capturas,136+44 vetores.** Todos127
  vetores antigos intactos;9 novos com métricas de staff;44 FTUE byte-idênticos.
  FTUE16,1/32,9/38,3s/0 misses/136 moedas. Ponteiro compra/reabre/atua, mostra cap, vaga e
  aviso de queima. Harness reutiliza pixels decodificados entre relaunches, não mocks.
- Dados employees3/grill6; schemas/DTOs/cópias gerados, **não porta de regras C#**.
  Savev4/CRC e browser meta v2 preservados; budgets/timers/RNG são runtime, não retomada
  persistente/offline. Preços/moedas/crescimento/máximos/unlocks/coberturas preservados.
- Longo1500 **15/18, exit1**, repetição idêntica. Renda23.263.609/gasto8.468.130/saldo14.795.479;
  falham rede729, rendaL50=189.197, spend.364. Novas compras378.580. Perfeitos caem75,4→42,2%
  com serviço desde bom; não retunar para esconder.64.715 serviços/29.630 viradas/147 prep
  automáticos; caps verificados por turno. Offline0; A-06/F4 continuam abertos.
- Relatório **[evidence/a06/step3/README.md](evidence/a06/step3/README.md)**. Próximo **A-06.4**,
  ledger offline real no índice3 e três trilhas restantes, conforme contrato já aprovado.
  Sem publicação, arte nova, SDK, C#/Unity ou prova em dispositivo.

### 9.21 Checkpoint A-06.4 — offline/ledger validados localmente

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

### 9.22 Checkpoint A-06.4 — fechamento econômico autorizado

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
