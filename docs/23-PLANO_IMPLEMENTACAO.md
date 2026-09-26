# 23 — Plano de Implementação e Melhoria (passo a passo)

**Data:** 2026-09-26 · branch `arena/01a0df03-game-churrasqueiro`
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

## 1. Visão geral das fases

| Fase | Objetivo | Sai de | Chega em | Doc-mãe |
|---|---|---|---|---|
| **0** | Consolidar a base | estado atual | V0.1 fechado de verdade, snapshot atualizado | 18 |
| **1** | Arte 2D completa | lotes 01–04 | lotes 05–07 aprovados e integrados no protótipo | 22 |
| **2** | Paridade C# completa | 139 checks, 17 vetores órfãos | 100% dos golden vectors verdes no CI | 03, 18 §7.2 |
| **3** | Unity V0.2 — Core Loop | sem projeto Unity | turno jogável no Editor a 60 FPS | 14 (V0.2) |
| **4** | V0.3 — Vertical Slice | core funcional | 1 experiência em qualidade final | 14 (V0.3) |
| **5** | V0.4 → V1.0 | slice vertical | jogo publicado em rollout | 14 (V0.4–V1.0) |

Dependências: 1 e 2 são independentes entre si e podem intercalar; 3 precisa da 2;
4 precisa da 1 + 3; 5 segue a ordem do roadmap.

---

## 2. Fase 0 — Consolidar a base (V0.1 fechado de verdade)

- [ ] **0.1 — Decisões de aprovação pendentes (dono).**
  Ações: aprovar ou pedir refação de: (a) lote 03 — fundos (3, sem veredito), maminha
  (`warn`); ícones e contra-filé já estão `ok`; grills já estão `redo`;
  (b) lote 04 — as 3 churrasqueiras refeitas com guia (`warn`).
  Verifica: `set-status` aplicado conforme a decisão.
  Pronto quando: todo asset dos lotes 03–04 tem veredito final (`approved`/`rejected`/`superseded`).
- [ ] **0.2 — Gates verdes neste checkout.**
  Ações: `npm install` → `npm run gates` → corrigir o que quebrar.
  Verifica: `npm run gates` (14 gates) + `npm run sim:long`.
  Pronto quando: tudo verde (exceto `check-csharp` SKIP local, verde no CI).
- [ ] **0.3 — Integrar aprovações e fechar o snapshot.**
  Ações: `build-runtime` com os lotes aprovados; atualizar `18-STATUS.md`
  (novo snapshot, §7) e este documento.
  Verifica: `npm run check-shots` (funil do FTUE inalterado).
  Pronto quando: status reflete fielmente o repositório.

## 3. Fase 1 — Arte 2D completa (docs/22)

Ordem = primeira aparição no jogo (docs/22 §2). Cada lote segue o ciclo docs/22 §5:
prompts gravados antes → 10 imagens → `process-sprites` → `review-sheet` →
aprovação do dono → `set-status` → `build-runtime`.

- [ ] **1.1 — Lote 05: fechar comidas, upgrades, funcionários e fundos.**
  10 imagens: `food_costela`, `food_cupim` (últimas 2 comidas) ·
  `ui_icons_upgrades_b/c` (18 ícones restantes, ids de `upgrades.json`) ·
  `ui_icons_cosmetics` (5 cosméticos) · `char_funcionarios` (5 cargos de `employees.json`) ·
  `bg_churrascaria_premium`, `bg_festival`, `bg_rede_nacional` (últimos 3 fundos) ·
  `ui_icons_collection` (10 categorias de `collection.json`).
  Ao fechar: 16/16 comidas · 27/27 ícones de upgrade · 5/5 funcionários ·
  7/7 fundos · 5/5 cosméticos · 10/10 categorias.
  Verifica: `process-sprites` + `review-sheet` sem erro; folha em `art/review/lote-05*.jpg`.
  Pronto quando: lote aprovado pelo dono e runtime reconstruído.
- [ ] **1.2 — Lote 06: coleção, eventos, loja, passe e VFX.**
  10 imagens: coleção própria (molhos, equipamentos, churrasqueiras especiais, medalha,
  em 2 folhas) · banners de eventos (11, em 3 folhas) · arte da loja/IAP (7 produtos,
  2 folhas) · Brasa Pass (1) · VFX (fumaça, faíscas, PERFEITO, moedas/confete, 2 folhas).
  Verifica e pronto: idem 1.1.
- [ ] **1.3 — Lote 07: mapa, conquistas, key art e sobras.**
  10 imagens: mapa da rota · folha de medalhas de conquista · key art da tela-título ·
  3 conceitos de ícone + feature graphic da loja · sobras e refações acumuladas.
  Verifica e pronto: idem 1.1.
- [ ] **1.4 — Gate `check-art-registry` no CI.**
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

👉 **Fase 0, passo 0.2** (gates verdes) em paralelo com **Fase 1, passo 1.1** (lote 05,
já com conteúdo definido acima) — arte nova entra como `pending` e só integra após o
"ok" do dono no passo 0.1.

**Registro de progresso:**

| Data | Passo | Status | Branch/PR | Obs |
|---|---|---|---|---|
| 2026-09-26 | — | plano criado (este documento) | `arena/01a0df03-game-churrasqueiro` | ponto de partida |
| 2026-09-26 | 1.1 (lote 05) | 10 imagens geradas, 53 sprites processados, `pending` | `arena/01a0df03-game-churrasqueiro` | aguardando aprovação do dono |
