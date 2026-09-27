# F7 — Revisão, Triagem e Resolução dos PRs Abertos #7 e #8

> **Atualização de integração — 2026-09-27:** o usuário autorizou resolver os conflitos
> e integrar todo o histórico. PRs #7/#8 foram reconciliadas por merge real na branch
> de consolidação; as decisões e evidências estão em [26 — Merge das PRs #7/#8](../../26-MERGE_PR7_PR8.md).
> 756 testes e 18/18 metas longas passaram localmente. A decisão anterior de manter
> essas PRs conflitantes está superada; os bloqueios Android/paridade da auditoria continuam abertos.


**2026-09-27 · Concluído e documentado localmente.**  
Checkpoint de encerramento da **Fase F7** (Revisão, Triagem e Resolução dos PRs Abertos #7 e #8).  
Base de referência: PR #16 MERGED (`a900445fe3def248973fc884564a632d829f9c65`), branch de trabalho `arena/01a0e1a4-game-churrasqueiro`.  
PRs preservados: **PR #7** (`arena/01a0daed-game-churrasqueiro`) e **PR #8** (`arena/01a0de76-game-churrasqueiro`) mantidos abertos e intactos, sem merge direto, em conformidade estrita com as diretrizes do dono do projeto.

---

## 1. Resumo Executivo da Fase F7

Conforme estabelecido em `docs/23-PLANO_IMPLEMENTACAO.md` §8 e §9.2:
> *"F7 — PRs #7/#8 preservados: revisar por tema contra main, classificar útil/obsoleto/conflitante, extrair/reimplementar seletivamente com testes. Não fazer merge direto; fechar/apagar somente após revisão/decisão registrada."*

Uma auditoria comparativa completa e aprofundada foi executada entre os ramos remotos dos PRs #7 e #8 e a branch principal `main` (após a integração dos PRs #9 a #16).

### Principais Conclusões:
1. **Origem Comum e Divergência Histórica:**
   - Ambos os PRs originaram-se do commit `3e6ea7f300ec73d99cd246fb599b117e435203bd` (Merge do PR #6, quando o FTUE e o tutorial inicial foram introduzidos).
   - Enquanto os PRs #7 e #8 exploravam caminhos alternativos de porte C#, testes de retenção e lotes parciais de arte, a linha principal evoluiu através dos PRs #9, #10, #11, #12, #13, #14 e #16, consolidando a estabilização de regras (A-01 a A-06.4), o fechamento do atlas de arte com 244 sprites aprovados e os ajustes rigorosos da economia com 18/18 metas PASS em 1500 turnos.
2. **Impacto Catastrófico de um Merge Direto:**
   - O diff de um eventual merge do PR #7 ou #8 contra `main` apagaria ou reverteria mais de 692 arquivos (`+12826 / -54884` linhas), deletando todas as suítes de teste de A-01 a A-06.4 (`slow-cuts.test.ts`, `vip.test.ts`, `fourth-zone.test.ts`, `offline.test.ts`, `staff.test.ts`, etc.), destruindo 116 sprites de arte aprovados e regredindo correções críticas de pureza de turnos e paridade de calor.
3. **Triagem Temática:**
   - Todas as modificações dos PRs #7 e #8 foram categorizadas em 6 temas essenciais. Todas foram classificadas como **Obsoletas / Superadas**, **Conflitantes / Rejeitadas** ou **Catalogadas / Postergadas (Débito Técnico)**.
   - Não há código órfão válido a ser reincorporado que já não tenha sido superado por implementações superiores em `main`.

---

## 2. Matriz de Triagem Temática Detalhada

| Tema | Conteúdo nos PRs #7 e #8 | Estado Atual na `main` | Classificação | Resolução e Justificativa |
|---|---|---|---|---|
| **Tema 1: Arte e Pipeline de Sprites** (Lotes 03 a 11) | • Tentativas parciais de lotes 04 a 11.<br>• Atlas com 124–128 sprites pendentes.<br>• Scripts legados em `.mjs` (`check-art-registry.mjs`). | • 244 sprites finais aprovados pelo dono e integrados no runtime (PR #13 commit `4fe4f4f`).<br>• Gate estrito TypeScript `check-art-registry.ts` com 52 testes aprovados.<br>• Todos os 11 lotes fechados e consolidados. | **OBSOLETO / SUPERADO** | Não incorporar. O trabalho de arte dos PRs #7/#8 é uma versão intermediária incompleta que foi integralmente concluída e superada no PR #13 e PR #14. |
| **Tema 2: Porte C# Preliminar** (`TurnSimulation.cs`, `EconomyRules.cs`, `Rng.cs`, `SkillPolicy.cs`) | • Primeiro rascunho de porte do turno e economia para C#.<br>• Implementado antes das fases F1 a F6.<br>• Não contemplava corte lento (virada), 4ª zona, VIPs, caps de funcionários, snapshots puros ou taxas de recarga. | • `Assets/Scripts/Core/Rules.cs` com paridade exata de calor (PR #16).<br>• `Tutorial.cs` e `GameData.cs` compilando.<br>• Fase F8 especificamente agendada para portar o core C# completo com todos os 35 vetores após estabilização de contratos. | **OBSOLETO / CONFLITANTE** | Não incorporar. O código C# do PR #7 quebra a paridade com as regras atuais do jogo e conflita com A-01..A-06.4. O porte C# definitivo e fiel será executado na Fase F8. |
| **Tema 3: Progressão de 10 Grelhas e 10 Restaurantes** (`churrasqueiras.json`, `restaurants.json`, `economy.json`) | • Adição de 6 grelhas extras e 3 restaurantes fictícios (`cais_das_brases`, `quiosque_da_orla`, `cozinha_do_campeao`).<br>• Conflação de 10 grelhas com 10 restaurantes.<br>• Curvas idle alteradas para 10 posições. | • Arquitetura canônica fixada: 4 churrasqueiras com 3 evoluções (12 estados) e 7 restaurantes canônicos.<br>• Decisão pétrea de produto: 4ª zona apenas para Fornalha no restaurante Premium em diante.<br>• Balanceamento econômico de 1500 turnos aprovado (18/18 metas PASS). | **CONFLITANTE / REJEITADO** | Rejeitado. Violar as decisões consolidadas de produto e a tabela canônica de 7 restaurantes desestabilizaria toda a simulação econômica e os schemas do jogo. |
| **Tema 4: Estudos de Retenção e Mecânicas Especulativas** (`docs/24`, `docs/25`, `probe-monetization.ts`) | • Propostas especulativas: Comandas (pedidos em dobro), Soprador/Garrafa de água por fileira, revisão de D0-D30.<br>• Script de teste não-assertivo `probe-monetization.ts`. | • F4 e A-06.4 resolveram a inflação de late-game via multiplicadores de restaurante e renda offline estritamente limitada em `offline.ts`.<br>• Comandas e soprador foram avaliados como prejudiciais à carga cognitiva e rejeitados no estudo original. | **REFERÊNCIA HISTÓRICA / REJEITADO** | Preservado apenas como documentação de pesquisa histórica. As mecânicas de gameplay propostas não foram adotadas no core por decisão de game design. |
| **Tema 5: Nomenclatura de SKUs IAP** (`iap.json` - `brasa.coins.*` vs `brasa.embers.*`) | • Renomeação pontual dos SKUs no `iap.json` para `brasa.embers.*`, deixando `.env.example`, `SecureConfig.cs` e testes quebrados. | • Mapeado formalmente em `docs/23-AUDITORIA_TECNICA.md` como Débito Técnico **B-07** (🟡 Baixo).<br>• Alinhado para resolução atômica na Fase F11 (Integração de Loja/Serviços), atualizando Play Console, credenciais e código em conjunto. | **POSTERGADO (DÉBITO B-07)** | Não antecipar. Renomear isoladamente em dados quebra o gate de monetização e a consistência com Unity/serviços. Será sanado na Fase F11 conforme planejado. |
| **Tema 6: Modal de Carvão no Protótipo** (`prototype/src/main.ts`) | • Modal simplificado de 3 linhas para escolha de combustível. | • Protótipo completo e funcional em F3/F5 com suporte a bancadas de preparo (A-03), 4ª zona (A-04), VIPs (A-05), automações de staff (A-06.3) e modal offline (A-06.4). | **OBSOLETO / CONFLITANTE** | Não incorporar. O protótipo atual é muito mais abrangente e a mesclagem do código do PR #7 causaria regressões graves na UI do protótipo. |

---

## 3. Análise de Risco de Integração

Se o PR #7 ou o PR #8 fossem mesclados diretamente na branch `main`:
1. **Perda de Cobertura de Testes:** Os 31 arquivos vitest (687 testes) seriam reduzidos drasticamente, perdendo 14 suítes de testes de regressão adicionadas entre F1 e F5.
2. **Perda de Ativos Gráficos:** O atlas perderia 116 sprites homologados, revertendo o inventário de 244 para 128 sprites pendentes.
3. **Quebra dos Gates de CI:** O validador de schemas falharia devido aos 3 restaurantes não reconhecidos e à tabela de 10 elementos de economia.
4. **Violação de Decisões de Produto:** Quebraria as decisões consolidadas sobre 4 zonas na Fornalha, virada obrigatória para cortes lentos e escalonamento de late income.

---

## 4. Registro de Decisões e Resolução Final

1. **Preservação dos PRs #7 e #8:**
   - Em estrito respeito às restrições do usuário, os PRs #7 e #8 **permanecem abertos e intocados** no repositório GitHub. Não foram fechados, alterados ou mesclados.
2. **Reincorporação de Código:**
   - Nenhuma linha de código dos PRs #7 ou #8 precisou ser reincorporada nesta fase, pois os elementos válidos já se encontram implementados em sua forma final e superior na branch `main` ou estão adequadamente alocados em seus marcos futuros (B-07 na F11, porte C# na F8).
3. **Status da Fase F7:**
   - **CONCLUÍDA COM SUCESSO.** A auditoria temática está integralmente documentada, garantindo rastreabilidade histórica e proteção contra regressões.
4. **Próximo Passo:**
   - Transição imediata para a **Fase F8 (Porte Completo do Core C# com Paridade Rigorosa)**, conforme a ordem mestra de implementação.

---

## 5. Evidências de Validação Local

A integridade do workspace e a total aprovação das suítes de teste e gates após a conclusão da Fase F7 foram revalidadas e registradas:

- **Suíte de Testes Unitários (`npm test`):**
  - **31 arquivos de teste aprovados (100%)**
  - **687 testes unitários passando em 55,2 s**
  - Log completo salvo em: `docs/evidence/f07/green-tests.log`
- **Gates de CI Locais (`npm run gates`):**
  - **14/15 gates locais PASS (1 SKIP local correspondente ao toolchain C#, executado no runner CI)**
  - Validação de 22 tabelas de dados, schemas JSON, consistência semântica e l10n completa
  - 157 vetores dourados de simulação + 44 vetores FTUE inalterados
  - 53 capturas visuais em PNG renderizadas e validadas
  - Log completo salvo em: `docs/evidence/f07/green-gates.log`
