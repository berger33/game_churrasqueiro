# 23 — Auditoria Técnica: bugs, erros e inconsistências

**Data:** 2026-09-26 · branch `arena/01a0def2-game-churrasqueiro` · base `f094b7d` (`main`)
**Escopo:** todo o repositório — regras de referência (`tools/sim-core`), dados (`shared/data`), protótipo (`prototype/`), ferramentas e gates (`tools/studio`, `tools/csharp`), porta C# (`Assets/Scripts`), documentação e materiais de loja.
**Método:** (1) execução de todos os gates locais; (2) leitura linha a linha das regras, dados e do protótipo; (3) scripts de confirmação empírica (trechos reproduzíveis na seção 8). Nenhum código foi alterado por esta auditoria — só este documento e sua linha no README.

> Resumo em uma frase: **os 13 gates que rodam aqui passam, mas eles medem o que foi codificado, não o que foi projetado.** Há regras cujo efeito é nulo, dados que o runtime nunca lê, e alguns bugs de contagem/idempotência que hoje estão latentes porque ninguém consome o resultado.

---

## F13 — Pipeline de Assinatura, APK/AAB, Publicação e Release (vigente)

- **Automação de Build Android:** Script de compilação em lote (`Assets/Scripts/Editor/BuildPipeline.cs`) implementando `BuildAndroidAab` e `BuildAndroidApk` com Target API 36, Min API 26, IL2CPP, ARM64, Linear Color Space e compressão ASTC. Assinatura segura parametrizada por variáveis de ambiente (`CHURRASCO_KEYSTORE_*`).
- **Orçamentos de Tamanho:** Enforçamento estrito de AAB base ≤ 90 MB, texturas ≤ 40 MB e código/engine ≤ 22 MB (`docs/12-BUILD.md` §7 e `performance.json`).
- **Metadados da Google Play Store & ASO:** Catálogo completo em `marketing/store_listings.json` para `pt-BR` (primário), `en-US` e `es-419`, com títulos ≤ 30 caracteres, 3 variantes de descrições curtas ≤ 80 caracteres (habilidade, progressão, cultura), descrições completas formatadas, palavras-chave e classificação indicativa 13+.
- **Segurança de Dados e Privacidade:** Declaração Play Store Data Safety confirmando zero coleta de PII, criptografia TLS 1.3 em trânsito, sem compartilhamento com terceiros para profiling e URLs de privacidade e exclusão de dados.
- **Rollout e Rollback Remoto:** Protocolo de Closed Testing (20 testadores / 14 dias), rollout gradual percentual (1% a 100%), gatilhos de interrupção (Crash > 1.0%, ANR > 0.4%) e verificação ativa dos kill-switches de contingência em `remoteconfig_defaults.json`.
- **Validação:** 740 testes vitest em 36 arquivos 100% PASS (novo teste `tools/studio/test/f13-release-build.test.ts`); 14/15 gates locais PASS (C# SKIP local coberto no CI).
- Relatório vigente: **[evidence/f13/README.md](evidence/f13/README.md)**.
- **F13 encerrado.** Todas as fases de engenharia e lançamento concluídas com sucesso.

## F12 — Áudio, Profiling, QA e Evidências de Dispositivo (histórico)

## F11 — Integração Segura de Serviços (histórico)

- **Firebase Telemetry, Crashlytics & Remote Config:** Abstrações seguras (`FirebaseService.cs`, `RemoteConfigService.cs`) com inicialização não-bloqueante no primeiro frame e suporte offline completo. Blindagem rigorosa de privacidade com zero PII e validação contra `AnalyticsContract`. Padrões embutidos de Remote Config com timeout de 8 s.
- **Google Mobile Ads (AdMob) & UMP (LGPD / GDPR):** Fluxo de consentimento UMP para Brasil (aviso LGPD) e Europa (GDPR). Suporte aos 8 placements de Rewarded Ads com anti-fraude de tokens de uso único (TTL 1h) e trava de callback simultâneo. Política restritiva de Interstitials (apenas pós-turno, cooldown 180 s, supressão 24h pós-IAP e 10 min pós-Rewarded).
- **Google Play Billing v7 & Resolução do Débito B-07:** Pacotes de moeda IAP atomicamente alinhados para `brasa.embers.*` em dados, credenciais, código e testes. Validação com retry backoff (3 tentativas: 500, 2000, 8000 ms), conformidade ética (§98), gating ético do Starter Pack (§39) e contingência offline (`grant_pending_flag`) com conciliação automática.
- **Validação:** 717 testes vitest em 34 arquivos 100% PASS (novo teste `tools/studio/test/f11-services.test.ts`); 14/15 gates locais PASS (C# SKIP local coberto no CI).
- Relatório vigente: **[evidence/f11/README.md](evidence/f11/README.md)**.
- **F11 encerrado.** Próximo: **F12 (áudio, profiling, QA e evidências de dispositivo)**.

## F10 — Meta, Localização e Acessibilidade (histórico)

- **Localização:** Cobertura de 100% das 381 chaves referenciadas por dados em `en-US` e `es-419`; cobertura global ampliada para **80,8%** (495/613 chaves); zero chaves órfãs; gate `check-l10n` 100% PASS.
- **Metaprogressão:** `meta.ts` e `MetaProgression.cs` portados com fórmulas determinísticas de maestria de coleção ($\text{XP} = \text{round}(30 \times \text{nível}^{1.5})$), avaliador de 58 conquistas sem concessões duplicadas, rastreamento de missões com bônus de conclusão, Passe de Temporada (50 patamares) e Rota da Brasa (16 paradas).
- **Acessibilidade:** `AccessibilitySettings.cs` com símbolos universais para os 8 estágios de doneness (○, ◔, ◑, ◕, ★, ▲, ▲▲, ✖), modo de redução de movimento, alto contraste e ampliação de alvos de toque em telas móveis.
- **Validação:** 702 testes vitest em 33 arquivos 100% PASS (novo teste `tools/studio/test/f10-meta-l10n.test.ts`); 14/15 gates locais PASS (C# SKIP local coberto no CI).
- Relatório vigente: **[evidence/f10/README.md](evidence/f10/README.md)**.
- **F10 encerrado.** Próximo: **F11 (integração segura de serviços)**.

## F9 — Integração no Unity 6 LTS (histórico)

- **Configuração de Projeto Unity 6 LTS:** `Packages/manifest.json` com pacotes oficiais (URP `17.0.3`, uGUI `2.0.0`, Input System `1.8.2`, 2D Sprite `1.0.0`, Test Framework `1.4.5`); `ProjectSettings/ProjectVersion.txt` fixado em `6000.0.23f1`; Portrait obrigatório (`defaultScreenOrientation: 1`), package name `com.studiobrasa.churrascomestredabrasa`, IL2CPP, ARM64, Linear.
- **Fronteiras Arquiteturais (`.asmdef`):** `Churrasco.Core.asmdef` configurado com `noEngineReferences: true` garantindo isolamento estrito de `UnityEngine`; `Churrasco.Runtime.asmdef` referenciando Core, InputSystem, TextMeshPro, UI; `Churrasco.Services.asmdef` e `Churrasco.Editor.asmdef`.
- **Importador de Arte:** `Assets/Scripts/Editor/ArtManifestImporter.cs` com pivots normalizados e compressão ASTC 6x6; gerador determinístico de `.meta` em `tools/unity/generate-metas.mjs`.
- **Views e Controllers (`Assets/Scripts/Runtime/`):** `GrillView`, `FoodView`, `CustomerCardView`, `TurnFlowController`, `TouchInputController`, `AudioController`, `SaveManager`, `LocalizationManager`.
- **Cena e Prefabs:** `Assets/Scenes/Main.unity` com Canvas, EventSystem e Controllers; `FoodItem.prefab`, `CustomerCard.prefab`, `FloatingText.prefab`.
- **Validação:** 694 testes vitest em 32 arquivos 100% PASS (novo teste `tools/studio/test/f09-unity-setup.test.ts`); 14/15 gates locais PASS (C# SKIP local coberto no CI).
- Relatório vigente: **[evidence/f09/README.md](evidence/f09/README.md)**.
- **F9 encerrado.** Próximo: **F10 (meta, localização e acessibilidade)**.

## F8 — Porte Completo do Core C# com Paridade Rigorosa (histórico)

- **Porte C# em `Assets/Scripts/Core/`:**
  - `Rng.cs`: mulberry32 PRNG exato, unchecked uint32, Next/Range/Int/Chance/PickWeighted/Pick/Shuffled.
  - `EconomyRules.cs`: fórmulas de XP, custos de upgrade, evolução de churrasqueiras, ciclo de vida offline (`BeginOfflineAbsence`, `ReturnFromOffline`, `ClaimOffline`, `ComputeOfflineEarnings`), `VipRules` e `VipState`.
  - `TurnSimulation.cs`: simulação completa de turnos, admissão de clientes com catálogo filtrado (`menuFor`), slots de preparo, ticks de cocção, viradas, automação de garçom/assador/auxiliar com caps rígidos, recarga de carvão automática e manual.
  - `SkillPolicy.cs`: agente heurístico com modelagem de latência humana, ruído perceptivo e alocação de zonas térmicas.
  - `SaveSystem.cs`: envelope Schema v5 com IEEE 802.3 CRC32, detecção de recuo de relógio, migrações v1..v5, e streak diário com dia de graça (`hold_streak_and_reset_day` conforme decisão A-19 / C-01).
  - `Rules.cs`: `TickGrill` booleano com recarga concluída, `CharcoalEfficiencyAt`, cálculo de 4 zonas térmicas (auxiliar `medium`) e patch de churrasqueira.
- **Harness de paridade (`tools/csharp/parity/Program.cs`):**
  - Fiação de `ScoreLateIncome` (14 vetores de escalonamento).
  - Fiação de fórmulas e ciclo offline em `golden.economy` (13 vetores).
  - Fiação dos 50 vetores completos de turnos em `golden.turns`.
  - **Zero vetores não portados ("zero not ported")** em 201 vetores totais.
- **Suíte de testes e gates:** 687 testes unitários / 31 arquivos vitest executados com 100% de aprovação; 14/15 gates locais PASS (C# SKIP local coberto no CI).
- Relatório vigente: **[evidence/f08/README.md](evidence/f08/README.md)**.
- **F8 encerrado.** Próximo: **F9 (integração no Unity 6 LTS)**.

## F7 — Revisão, Triagem e Resolução dos PRs Abertos #7 e #8 (histórico)

- **Auditoria comparativa aprofundada:** PRs #7 e #8 analisados commit a commit e confrontados contra `main` (`a900445` pós-PR #16).
- **Preservação estrita dos PRs:** PRs #7 e #8 mantidos abertos no GitHub conforme diretriz do dono; nenhum merge direto foi executado (evitando a reversão de 692+ arquivos e destruição das fases A-01..A-06.4).
- **Matriz de triagem temática (6 eixos):**
  1. *Arte Lotes 03-11:* Obsoleta/superada (main possui 244 sprites finais homologados via PR #13 e gate TypeScript).
  2. *Porte C# inicial:* Obsoleto/conflitante (precede regras A-01..A-06.4 e snapshots puros; transferido para F8).
  3. *Progressão 10 grelhas/10 telas:* Conflitante/rejeitado (viola arquitetura canônica de 4 grelhas/7 restaurantes).
  4. *Estudos de retenção:* Histórico preservado em docs; mecânicas de gameplay especulativas rejeitadas.
  5. *SKUs IAP (brasa.coins vs brasa.embers):* Postergado como débito B-07 para a fase F11 (alinhamento atômico com Play Console).
  6. *Protótipo UI carvão:* Obsoleto/conflitante (protótipo da main já possui prep, 4ª zona, VIP e offline completos).
- **Suíte de testes e gates:** 687 testes unitários / 31 arquivos vitest executados em 55,2 s com 100% de aprovação; 14/15 gates locais PASS (C# SKIP local coberto no CI).
- Relatório vigente: **[evidence/f07/README.md](evidence/f07/README.md)**.
- **F7 encerrado.** Próximo: **F8 (porte completo do core C# com paridade rigorosa)**.

## F6 — Auditoria e Atualização Isolada de Dependências e Toolchain (histórico)

- **Toolchain de testes e build atualizada sem "force cego":** `vitest` atualizado para `^4.1.11` com `vite 6.4.3`.
- **Zero vulnerabilidades encontradas:** `npm audit` relata 0 vulnerabilities (sanadas 1 crítica, 1 alta e 3 moderadas em `@vitest/mocker`, `vite`, `vite-node`).
- **Suíte de testes e gates:** 687 testes unitários / 31 arquivos vitest executados em 52,8 s com 100% de aprovação; 14/15 gates locais PASS (C# SKIP local coberto no CI).
- **Vetores e pacing:** 157 vetores de simulação + 44 FTUE inalterados; campanha de 1500 turnos mantém 18/18 metas PASS com spend ratio 74,1%.
- Relatório vigente: **[evidence/f06/README.md](evidence/f06/README.md)**.
- **F6 encerrado.**

## F5 — Triagem e Resolução de Débitos Médios e Baixos (histórico)

- **38 débitos técnicos triados e resolvidos/classificados:** 19 médios 🟠 e 19 baixos 🟡.
- **Mecânica sim-core:** A-14 (`stageOf` retorna `burned` imediato para pão de alho e queijo coalho), A-15 (bot sem vazamento de alimentos órfãos), A-10 (débito de moedas em `refillCharcoal` se configurado), A-11 (`embersSpentTotal` e ledger de brasas em `evolveChurrasqueira`), A-12/13 (clamps estritos de nível e simplificação de `deriveStats`), A-20 (filtragem de `undefined` em `stableStringify`).
- **Streak e LiveOps:** A-19 e C-01 padronizados com decisão do dono — dia de graça segura o streak (5→5), gap $\ge 2$ dias sem graça reseta streak para 1 e reinicia o ciclo no Dia 1 (`dayIndex: 0`).
- **Textos e dados:** B-04 (`grill_speed` reflete `heatRampRate`), B-05 (6 e 9 espetos na `parrilla_chef_cisma`), F-02 (tabela de restaurantes de docs/02 atualizada).
- **Validação e gates:** D-03 (validação de `levels.json` com o gerador e remoção de resíduos).
- **687 testes / 31 arquivos; 14/15 gates locais (C# SKIP); 53 capturas; 157+44 vetores.** Novo teste `tools/studio/test/f05-debts.test.ts` valida os débitos corrigidos.
- Relatório vigente: **[evidence/f05/README.md](evidence/f05/README.md)**.
- **F5 encerrado.** Próximo: **F6 (auditoria de dependências e toolchain)**.

## F4 — Revalidação Econômica Global (histórico)

- **1500 turnos ativos: 18/18 metas PASS, exit 0**, confirmado nas seeds `20260917`, `20260918` e `20260919`.
- **Renda total gerada:** 14.679.360 moedas; **Gasto total:** 10.873.220 moedas; **Saldo final:** 3.806.140 moedas.
- **Spend ratio:** 74,07% (saudável, alvo 70% a 99%).
- **27 trilhas maximizadas:** 6.358.620 moedas gastas integralmente em upgrades.
- **Pacing de estabelecimentos:** Espetinho (t42), Trailer (t96), Bairro (t168), Premium (t277), Festival (t422), Rede Nacional (t1130).
- **Pacing de churrasqueiras:** Zé da Esquina (t11), Parrilla Chef Cisma (t43), Fornalha Dragão Manso (t87).
- **Inflação:** crescimento de custo de upgrades (×29,28) supera o crescimento de renda L5→L70 (×13,46).
- **Ausências:** 24 fixtures separadas, 3 dias, cap 8h, rampa 20min, até 2,18×.
- **680 testes / 30 arquivos; 14/15 gates locais (C# SKIP); 53 capturas; 157+44 vetores.**
- Relatório vigente: **[evidence/f04/README.md](evidence/f04/README.md)**.
- **F4 encerrado.** Próximo: **F5 (triagem e resolução de débitos médios e baixos)**.

## A-06.5 — revisão final das 27 trilhas e contratos (histórico)

- **27/27 trilhas ativas com consumidores reais no runtime:** 0 no-ops restantes. Todas as trilhas declaradas em `shared/data/upgrades.json` possuem consumidor em `cooking.ts`, `turn.ts`, `staff.ts` ou `offline.ts`.
- **Capacidade de sinks de upgrade maximizados:** exatamente **6.358.620 moedas**.
- **Gating inicial e dependências validadas:** 18 trilhas compráveis no início (Restaurante 0, Nível 1); 9 trilhas exigem requisitos reais de restaurante, receita de preparo ou dependência de funcionário (`tray` requer Garçom >= 1).
- **Escopo de funcionários reafirmado:** Gerente entrega exclusivamente +18% de renda offline por nível; rerolls, desconto na loja e VIP +2pp permanecem como backlog explícito de F10.
- **Campanha ativa 1500 turnos:** **18/18 metas PASS, exit 0** (duas execuções byte-idênticas). Renda 14.679.360, gasto 10.873.220, saldo 3.806.140, spend ratio 74,07%. Sem rewarded e sem injeção de ausência offline.
- **Cenário de ausências:** auditado em 24 fixtures separadas, byte-idêntico ao fechamento do A-06.4.
- **680 testes / 30 arquivos; 14/15 gates locais (C# SKIP); 53 capturas; 157+44 vetores.** Novo teste `tools/studio/test/a06-final-matrix.test.ts` valida a matriz inteira das 27 trilhas.
- Relatório vigente: **[evidence/a06/step5/README.md](evidence/a06/step5/README.md)** e **[evidence/a06/final-map.md](evidence/a06/final-map.md)**.
- **A-06 encerrada.** Próximo: **F4 (revalidação global de economia e guardrails)**.

## A-06.4 — fechamento econômico autorizado (histórico)

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

## A-06.3 — equipe/Bandeja validadas localmente (histórico)

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

## A-06.2 — recursos validados localmente (histórico)

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

## Atualização A-06.1 — histórica (2026-09-27 UTC)

A-06 ainda aberto, mas compras/efeitos diretos foram corrigidos e validados localmente:
**16 trilhas integradas,11 pendentes bloqueadas**, registro compartilhado entre serviço,
UI e bot; catálogo27, histórico preservado, gates receita/restaurante/dependência. B-02
compra está protegido; automação real de funcionários ainda depende A-06.3/A-06.4.
Capacidade/Mesas agora ampliam a fila autoral; Mestria/Clientela afetam serviço/paciência.

533 testes/24 arquivos,14/15 gates (C# SKIP),42 PNGs,121+44 vetores;7 turnos novos,
28 antigos intactos. Longo15/18: rede664/rendaL50=208.316/spend0,324 continuam falhando.
Nenhum retuning, reembolso, reset, porta C# ou publicação. Evidência **evidence/a06/step1/**.
O mapa12/13/2 em evidence/a06/upgrade-map.md é diagnóstico anterior, não estado atual.
Próximo A-06.2 recursos; contrato/decisões já aprovados, não perguntar novamente.

## Atualização A-05 — vigente (2026-09-27 UTC)

**VIP funcional corrigido localmente.** Decisões do dono: chegada, chance de nível com
zero bloqueante/fallback6%/bônus semanal +4pp, cap2 natural+chamado, reset UTC, chamado
simulado explícito. Reserva/cap/cooldown/callback único persistidos, save corev4, pedido
completo/counters/conquistas VIP e analytics/áudio integrados. Sem SDK/anúncio real.

455 testes/22 arquivos,14/15 gates locais (C# SKIP),37 PNGs, FTUE preservado.114+44 vetores:
8 novos VIP,20 resultados antigos iguais,44 payloads FTUE iguais (metadado analytics5→6).
Longo15/18: renda22.302.178, rede881, rendaL50=191.586, spend0,488; sem retuning.
Natural sem rewarded244 VIPs/232 servidos, cap2/dia, nível80/rest6. Evidência **evidence/a05/**.

Dos9 altos: F2 encerrou3, A-01–A-05 funcionais; **A-06 aberto**, economia global pendente.
B-08/global conquistas e LiveOps completo não encerrados; consultar ledger VIP antes de
pagar novamente as mesmas conquistas no futuro. Nenhum C#/Unity/arte/merge/CI remoto novo.

## Atualização A-04 — histórico (2026-09-27 UTC)

**Quarta zona funcional corrigida localmente.** Dono escolheu Fornalha E Premium,
auxiliar média1×; demais equipamentos1/2/3, Fornalha antes do Premium3. Perfil/calor
primários preservados, expansão real em stats/patch/bot/UI; fonte/expansão validadas.

411 testes/21 arquivos,14/15 gates locais (C# SKIP),29 screenshots/244 sprites, FTUE intacto.
106+44 vetores:3 resultados avançados mudam,8 turnos verificam contagem/calores; demais
payloads intactos. Dados/schemas/sync/DTOs gerados atualizados; **nenhuma regra C# portada**.
Longo15/18 idêntico a A-03:1241 turnos com4 zonas,0 ticks ocupados na4ª após o bot mover
às ideais primárias. Limitação medida, não evidência de benefício econômico aprovado.
Probe128 turnos avançados complementa. Evidências: [`evidence/a04/`](evidence/a04/README.md).

Dos9 altos: F2 encerrou3; A-01–A-04 funcionais, economia global pendente; **A-05/A-06 abertos**.
Sem push/PR/merge/CI remoto deste patch, sem Unity/arte nova. Demais seções são históricas.

## Atualização A-03 — histórico (2026-09-27 UTC)

**Preparo funcional corrigido localmente.** Estoque inerte até admissão explícita em vaga,
capacidade restaurante+tábua, duração/faca, pronto retém vaga até servir/descartar. UI
nível12+ oferece tap/drag, progresso, pronto, serviço e descarte fora da grelha, até10 vagas.

- 369 testes/20 arquivos,18 novos com red antes do green; gates14/15 (C# SKIP).
  Harness real em11/12/13, serviço de pedido natural, cancelamentos e lotação;24 PNGs/244 sprites.
  Pedido misto/combo/recompensas em testes de regra. FTUE e106+44 vetores intactos.
- Sim longo15/18 **idêntico ao A-02**; três desvios preservados. `board` agora tem consumidor,
  mas bot continua uma porção por ingrediente; não considerar A-06/economia resolvidos.
- Dos9 altos: F2 encerrou3; A-01/A-02/A-03 funcionais, aceite econômico global pendente;
  **3 abertos (A-04–A-06)**. Sem C#/Unity/arte nova. CI desta entrega não executado;
  PR14/basee50ce15 já MERGED com CI verde, A-03 ainda sem push/PR/merge.
- Evidência: [`evidence/a03/README.md`](evidence/a03/README.md). Achados/reproduções abaixo
  preservam o histórico; sequência vigente no plano §9.14 e handoff24.

## Atualização A-02 — histórico (2026-09-26 local /27 UTC)

**A-02 funcional corrigido:** playerLevel obrigatório/integral/positivo no contrato,
catálogo de pedidos/estoque/UI por nível E restaurante, snapshot no início. Sim p.level,
UI meta.level, FTUE1; skill curve usa XP real, não índice de fase/default all-unlocked.
UnusualOnly sem menu não sorteado; forçado sem menu rejeitado; nenhuma ordem vazia.

- **351 testes** (50 novos red +2 wiring red antes do green), gates locais14/15;
 19 screenshots/244 sprites, FTUE inalterado.106+44 vetores:20 entradas com playerLevel,
 9 expectativas iniciais mudam,11 preservadas;44 FTUE byte-idênticos. C#25 não portados.
- **Longo15/18**: rede883<950, rendaL50=192.223>152.000, spend0,489<0,70. Três desvios
  persistem, sem retuning. Logs/diffs/regressões em [`evidence/a02/`](evidence/a02/README.md).
- Dos9 altos:3 encerrados F2; A-01/A-02 funcionais com economia global pendente;
  **4 sem correção (A-03–A-06)**. Vinagrete permanece após nível12/rest0; não apagar para
  contornar A-03. F3/F4 não encerradas. PR14 sem merge; CI A-02 **15/15 aprovado**,
  [run36286427123](https://github.com/berger33/game_churrasqueiro/actions/runs/36286427123) em44ccf11, C#139 checks/25 não portados.

## Atualização A-01 — histórico (2026-09-26 local /27 UTC)

**A-01 funcional corrigido, aceite econômico pendente.** O dono escolheu 2 lados e
virada obrigatória em costela/cupim. Dados v6, bot usando os flags, UI paginada/dica
contextual/toque de vizinho corrigidos; roteiro FTUE intacto. Evidências red/green,
janelas, probe avançado e revisão semântica: [`evidence/a01/`](evidence/a01/README.md).

- **299 testes**, 14/15 gates locais (C# SKIP), 106+44 vetores (8 turnos avançados novos;
  nenhum input/expect antigo alterado), 17 screenshots, FTUE 16,1/32,9/38,3 s sem erros.
- **Sim longo 15/18**: rede 859 vs 950–1450, L50 182.381 vs 98.000–152.000,
  spend 0,480 vs 0,70–0,99. Não retunado. A-02–A-06 e F4 precisam preceder aceite global.
- Dos 9 altos originais: 3 encerrados em F2; A-01 corrigido funcionalmente com aceite
  econômico pendente; **5 ainda sem correção (A-02–A-06)**. C-06 apenas parcialmente
  resolvido (truncagem da bancada); dívida l10n/polish continua. Totais históricos preservados.
- C# agora tem 25 casos não portados (5 econômicos + 20 turnos). Sem porta C#/Unity/arte
  nova; PR #14 aberto/sem merge. CI remoto A-01 **15/15**, [run 36285270473](https://github.com/berger33/game_churrasqueiro/actions/runs/36285270473)
  em `8b042ca` (139 checks C#, 25 não portados). Longo só local; Nightly dispatch negado (403).

## Atualização F2 — histórico (2026-09-26 local / 27 UTC)

**A-07, A-08 e A-09 resolvidos na referência TypeScript**, em `5803806`, `f2958d6` e
`02e7f61`. Restam **6 altos abertos (A-01–A-06)**; totais originais e reproduções abaixo
são mantidos como histórico. O CI verde não resolve os demais achados.

| Achado | Prova antes da correção | Correção / prova depois |
|---|---|---|
| A-07 | 7 testes falhavam: contador inicial ausente, sequência 2/5/9/14/20/27, metas antecipadas, saves incorretos | inicial=1, unlock atribui índice+1, load normaliza v1/v2/v3 após CRC; 8 regressões verdes, incluindo metas reais 2/3/5/7 e saves antigos sem alteração de prêmios |
| A-08 | 3 testes falhavam: 1 prato queimado servido=2; 3 pratos=5; resultado inflado | contar só na transição onBurn; 4 regressões verdes com queima real e persistência do resultado; não tentar inferir histórico por prato ausente do save |
| A-09 | 8 testes falhavam: reprodução exata 745→842; FTUE 86→127; leituras alteravam acumuladores/snapshots | cálculo puro, bônus/rounding apenas no retorno, snapshots independentes; 6 novos testes + replay golden e FTUE fortalecidos |

Validação: **272 testes** (antes 254), **14/15 gates locais**, C# SKIP sem SDK;
**18/18 guardrails longos**, saída integral igual à anterior. `check-vectors` confirma
98+44 sem drift: vetores do bot descartam queimados/fazem só uma leitura final e não cobrem
contador de unlock/save. Nenhum JSON de vetor foi regenerado. Dados/preços não alterados.
PR #14 continua aberto, agora F1+F2, **sem merge**; CI remoto F2 **15/15 aprovado** em
`faf2081`, [run 36283526080](https://github.com/berger33/game_churrasqueiro/actions/runs/36283526080), incluindo compilação/checks C#.
Próxima ação: A-01, decisão de produto antes de dados. Plano vigente: docs/23-PLANO §9.8.

## Histórico F1 pós-auditoria — 2026-09-27 UTC

Sessão `arena/01a0e03e-game-churrasqueiro`: baseline reexecutado sobre o merge PR #13
(`4fe4f4f`), sem divergência nos 202 testes, 13/14 gates locais e 18/18 guardrails longos.
A lacuna do pipeline de arte foi reproduzida: `check-art` aceitava WebP órfão no runtime;
`check-art-registry` não existia. Agora há gate dedicado, incluído no CI, com 52 testes
(46 negativos). Total atual **254 testes**, **14/15 gates locais**, C# ainda SKIP sem SDK.
O inventário protege os 244 IDs aprovados e valida masters/CSV/lotes/manifesto/runtime.

**Na entrega F1, A-01–A-09 permaneceram abertos** (ver F2 abaixo para o estado atual). Não houve mudança de regras,
dados, vetores ou economia; simulação longa integralmente idêntica. Vulnerabilidades também
permanecem 5 (1 crítica/1 alta/3 moderadas). CI remoto **15/15 aprovado**, incluindo C#, em [run 36282761422](https://github.com/berger33/game_churrasqueiro/actions/runs/36282761422) / PR #14 (aberto, sem merge). Ordem operacional vigente: F1 concluída,
A-07 → A-08 → A-09 em seguida; demais fases e decisões em `23-PLANO_IMPLEMENTACAO.md` §9.
A §9 histórica abaixo é referência, não autorização para portar regras defeituosas.

## 1. Baseline (o que roda e o que não roda)

| Gate (`npm run …`) | Resultado | Observação |
|---|---|---|
| `typecheck` | ✅ | `tsc --noEmit`, strict |
| `validate` | ✅ | 22 tabelas, 16 ingredientes, 11 clientes, 7 restaurantes, 27 trilhas, 58 conquistas, 60 níveis |
| `check-schema`, `verify-schemas` | ✅ | |
| `check-l10n` | ✅ | **mas en-US/es-419 têm só 54/514 chaves (10,5 %)** — passa por fallback pt-BR (item D-06) |
| `check-csharp-types`, `verify-data-sync` | ✅ | 13 arquivos `.g.cs` e `Assets/Data` em sincronia |
| `test` (vitest) | ✅ | 13 arquivos / 202 testes |
| `sim` | ✅ | 18 alvos de economia atendidos (ver item B-03/D-01 sobre *como* são atendidos) |
| `check-vectors` | ✅ | 98 vetores + 44 FTUE inalterados |
| `check-art`, `check-render`, `check-shots` | ✅ | 144 draws pintados; 13 PNGs |
| `gen-levels` + diff | ✅ | `levels.json` está em sincronia com o gerador |
| `check-csharp` | ⚠️ **não executável aqui** | exige .NET 8 SDK; sandbox sem rede/root. `Rules.cs`, `GameData.cs`, `Analytics.cs`, `Tutorial.cs` foram conferidos **por leitura** contra os `.ts` |

Ambiente: Node v22.22.3, npm 10.9.8. Árvore limpa antes e depois (os gates que escrevem em `prototype/dist|shots` estão no `.gitignore`).

---

## 2. Sumário executivo

**Achados originais: 47** — 9 altos · 19 médios · 19 baixos. Dos altos: 3 encerrados em F2, todos os 6 restantes (A-01 a A-06) corrigidos funcionalmente e integrados (virada obrigatória, nível E restaurante, preparo real, quarta zona, VIP natural e 27 trilhas ativas); economia global pendente na fase F4.

Os nove que mais importam, em ordem de impacto no jogo:

| # | Achado | Onde |
|---|---|---|
| A-01 | **Costela e cupim são impossíveis de acertar sem virar, mas a tabela diz `flipNeeded:false`.** Sem virada, o item vai de *cru* direto para *queimado* (overall 0,672 < limite 0,68). O bot de referência respeita `flipNeeded` e por isso **todas as metas de economia dos restaurantes 3–6 foram medidas com os cortes premium falhando sempre.** | `ingredients.json`, `policy.ts:111`, `cooking.ts:341–350` |
| A-02 | **`unlock.level` dos ingredientes nunca é aplicado.** No nível 1, restaurante 0, os clientes pedem queijo coalho (nível 6) 16 %, legumes (nível 10) 15 %, fraldinha (nível 14) 11 %. Contradiz `docs/02` §11 e a progressão "um ingrediente por vez". | `turn.ts spawnCustomer`, `ingredients.json` |
| A-03 | **Protótipo: pedidos de vinagrete não podem ser concluídos.** A bancada só mostra itens de grelha; não existe fluxo de *prep*. Com as seeds do protótipo, 11,8 % dos clientes do restaurante 0 e 13,7 % do restaurante 1 pedem vinagrete → cliente perdido, combo quebrado, 3ª estrela inalcançável quando ≥ 2 aparecem no turno. | `prototype/src/main.ts:531–534` |
| A-04 | **Zona 4 não existe no runtime.** `restaurants.json` declara `zoneCount: 4` (idx 4–6) e `introduces: zone_4`; `grill.json` só define 3 zonas e `createGrill` clampa → `zones.length === 3` nos 7 restaurantes. | `restaurants.json`, `cooking.ts createGrill` |
| A-05 | **VIP está morto.** `weight: 0`, `vipChance` (gerado em `levels.json`, tipado em `turn.ts:60`) nunca é lido, `spawnCustomer('vip')` só em teste. Ainda assim há `introduces: vip`, `sfx_vip_arrive.wav`, conquistas `vipServed`, `events.json vipBaseChance` e a ficha da loja promete "VIP que paga muito". | `customers.json`, `turn.ts`, `store-assets/listing/full-ptBR.txt` |
| A-06 | **14 das 27 trilhas de upgrade não fazem nada** (stat calculado e nunca lido, ou nem calculado). `run-sim.ts` compra todas por `UPGRADE_PRIORITY`, então o alvo `coinSpendRatio` é atingido queimando moedas em no-ops. | `cooking.ts deriveStats`, `upgrades.json`, `run-sim.ts` |
| A-07 | **`restaurantsUnlocked` acumula em vez de setar** (`addCounter(p,'restaurantsUnlocked', index+1)`): sequência 2, 5, 9, 14, 20, 27. A conquista `restaurant_5` (40 000 moedas + 50 brasas) dispararia no 3º restaurante e `restaurant_7` (200 000 + 150 brasas + coroa) no 4º. | `economy.ts:162` |
| A-08 | **`burnedFood` conta em dobro** quando um prato queima na grelha e depois é servido (1 na grelha + 1 no `serve`). Infla `burnedRate` do simulador e os vetores dourados. | `turn.ts:337` e `:370` |
| A-09 | **`TurnSimulation.result()` não é idempotente:** cada chamada soma o bônus de fim de turno de novo (745 → 842 moedas na 2ª chamada). Hoje todos os chamadores chamam uma vez — armadilha latente para a porta Unity. | `turn.ts:501` |

---

## 3. Tabela completa

Severidade: 🔴 afeta regra/economia/contrato ou promessa ao jogador · 🟠 comportamento errado mas contido, ou drift dado↔código↔doc · 🟡 dead code, duplicação, cosmético.

| ID | Sev | Área | Título |
|---|---|---|---|
| A-01 | 🟠 funcional corrigido; economia pendente | Regras/Dados | Reprodução histórica: costela e cupim inalcançáveis sem virar (`flipNeeded:false` + `sides:2`) |
| A-02 | ✅ funcional | Regras/Dados | `unlock.level` de ingrediente nunca aplicado |
| A-03 | ✅ funcional | Protótipo | Pedidos de vinagrete (prep) impossíveis de concluir |
| A-04 | ✅ funcional | Dados/Regras | Zona 4 declarada, nunca criada |
| A-05 | ✅ funcional | Dados/Regras/Loja | VIP não aparece em jogo, mas é prometido |
| A-06 | ✅ funcional / 27 trilhas integradas | Regras/Dados | 27 trilhas ativas com consumidores reais, sem no-ops |
| A-07 | 🔴 | Regras | `restaurantsUnlocked` acumula |
| A-08 | 🔴 | Regras | `burnedFood` dobrado |
| A-09 | 🔴 | Regras | `result()` não idempotente |
| A-10 | 🟠 | Regras | `refillCharcoal()` nunca cobra `refillCostCoins` |
| A-11 | 🟠 | Regras | `evolveChurrasqueira()` gasta brasas sem contador/ledger |
| A-12 | 🟠 | Regras | `computeOfflineEarnings`: `gerente` sem clamp de `maxLevel`; código morto |
| A-13 | 🟠 | Regras | `deriveStats`: expressões sem sentido, `auto*Level` sem clamp |
| A-14 | 🟠 | Regras | `stageOf()` ignora `burned` em itens com `stageOverrides` |
| A-15 | 🟠 | Regras | Bot de referência vaza itens (7 800 spawns para 19 cozidos) |
| A-16 | 🟡 | Regras | `startCharcoalRefill/charcoalRefillDuration` sem uso; hack `1e-6` em `Rules.cs` |
| A-17 | 🟡 | Regras | `policy.ts`: `push()` morto, `reactionSec`/`latency` duplicados, `perfectOnly` sem uso |
| A-18 | 🟡 | Regras | `spawnCustomer` — `forcedId` inválido cai em `pool[0]`; pico medido antes da expiração |
| A-19 | 🟠 | Regras/Doc | Streak: doc diz "dia de graça não avança", código avança; reset não volta ao dia 1 |
| A-20 | 🟡 | Regras | `serializeSave` quebra com `undefined` no estado |
| B-01 | 🟠 | Dados | Campos declarados e nunca lidos: `speedBonusWindow`, `roundCoinMultiplierRange`, `streakBonusPerCycle`, `minCollectIntervalMin`, `adDoubleAvailable`, `refillCostCoins`, `burnRate`, `vipChance`, `heatStability` |
| B-02 | 🟠 | Dados | Upgrades sem gating: `employees.json` diz "garçom no restaurante 1, gerente no 4"; `canAfford` só olha preço |
| B-03 | 🟠 | Dados/Doc | Idle começa no restaurante 1 (`coinsPerMinuteByRestaurant[1]=6`) mas `introduces: idle_offline` está no 3 |
| B-04 | 🟠 | Dados/l10n | Texto de upgrade descreve efeito diferente do `effect.stat` (6 trilhas) |
| B-05 | 🟡 | Dados/l10n | Descrições de evolução do `chef_cisma` com contagem de espetos errada |
| B-06 | 🟡 | Dados | `shortName`/`humorTag`/`abilities[].effect` — texto literal em tabela, sem acento, sem uso |
| B-07 | 🟢 Resolvido | Dados/IAP | Produtos renomeados atomicamente para brasa.embers.* em F11 |
| B-08 | 🟡 | Dados | `achievements.json`/`missions.json` referenciam stats que ninguém produz; sem avaliador |
| B-09 | 🟡 | Dados | `queijo_coalho.region = nordeste`, `costela.region = sul` — consistente com `regions.json` (ok), mas `regional_ingredients` do festival não tem regra |
| C-01 | 🟠 | Protótipo | Streak diário: `graceUsed` nunca volta a `false`; gap ≥ 2 dias não reseta; streak por login ≠ por resgate |
| C-02 | 🟠 | Protótipo | Ganhos offline falsos (`mins*(6+level*2.2)`) até no restaurante 0 |
| C-03 | 🟠 | Protótipo | Level-up não paga `levelUpCoins`/brasas (diverge de `applyTurnResult`) |
| C-04 | 🟡 | Protótipo | Fórmula de XP e `DAILY_REWARDS` duplicadas (hoje iguais, drift garantido) |
| C-05 | 🟡 | Protótipo | Baú do dia 7 = `+500` fixo; roleta "Chest"/"Booster" não entregam nada; `buyUpgrade` ignora `track.currency` |
| C-06 | 🟡 | Protótipo | Strings pt-BR literais (`'Moedas insuficientes'`, `'QUEIMADO'`, …) fora do l10n; truncagem `.slice(0,8)` resolvida por paginação no checkpoint A-01 |
| C-07 | 🟡 | Protótipo | `dev-server.mjs` só observa `src/main.ts`; `readFile` em diretório → 500 |
| D-01 | 🟠 | Ferramentas | `measureSkillCurve` roda na grelha padrão de 3 zonas; `simulateProgression` na `lata_valente` de 1 zona |
| D-02 | 🟠 | Ferramentas | `targets.sessionLengthMinutes` e `noUpgradeCostRegression` nunca verificados |
| D-03 | 🟡 | Ferramentas | `validate-data.ts` valida a saída do gerador, não o `levels.json` commitado; acentos só em 8/22 tabelas; `void validateDatabase` |
| D-04 | 🟡 | Ferramentas | `validate-data` não checa nomes de stat de conquistas/missões |
| D-05 | 🟡 | Ferramentas | `check-csharp` é o único gate que pode ser pulado silenciosamente sem SDK |
| D-06 | 🟠 | l10n | en-US/es-419 a 10,5 % — gate verde por fallback |
| E-01 | 🟠 | C# | `AdService`: caps e cooldowns hardcoded e diferentes de `ads.json`; cooldown `< 0` nunca bloqueia; `shownToday` nunca zera |
| E-02 | 🟠 | C# | `BillingService.Purchase` concede posse sem loja; `IsNonConsumable` por substring |
| E-03 | 🟡 | C# | `GameData.cs`: doc diz 10 tabelas, carrega 7; `Build()` `<0` vs TS `<=0` |
| E-04 | 🟡 | C# | Nenhum `.cs` foi compilado neste ambiente (ver §1) |
| F-01 | 🟠 | Docs | README: `Packages/`, `ProjectSettings/`, `marketing/`, `Assets/Scripts/Sim/`, `tools/studio/golden.test.ts` não existem |
| F-02 | 🟠 | Docs | `docs/02` tabela de restaurantes: custos 3 500/12 000/70 000/150 000/500 000/2 800 000 vs dados 0/3 500/15 000/67 000/178 000/4 200 000 |
| F-03 | 🟡 | Docs | `docs/02` §10 curva atualizada em A-02 e §4.5 janelas/matemática corrigidas em A-01; descrições antigas abaixo são históricas |
| F-04 | 🟡 | Docs | README "Not started: art assets, recorded audio" — há 100+ PNG e WAVs gerados |
| F-05 | 🟡 | Docs | `types.ts` e `docs/03` citam `tools/sim-core/golden/` (é `tools/golden/`) |

---

## 4. Regras de referência — `tools/sim-core/src`

### A-01 — reprodução histórica; funcional corrigido, aceite econômico pendente

- **Onde:** `shared/data/ingredients.json` (`costela`: `sides:2, flipNeeded:false, perfectWindow [0.76,0.88]`; `cupim`: `[0.78,0.90]`), `shared.carryoverRate = 0.12`, `shared.burnedThreshold = 1.2`; `cooking.ts:341–350` (lado de cima cozinha a `carry`), `cooking.ts:427–437` (`scoreItem`), `policy.ts:111` (`if (ing.flipNeeded && …) a.flip(f)`).
- **Matemática:** sem virar, quando o lado de baixo chega a 1,2 (queima) o de cima está em 0,144 → overall 0,672. Para costela `lo − padding = 0,76 − 0,08 = 0,68`; para cupim 0,70. O item **nunca** sai de `raw` antes de virar `burned`.
- **Evidência (script §8.3, grelha do restaurante 4, zona alta):**
  ```
  costela  no flip    burn@ 18.4s overall@burn 0.673  raw:0.1-18.3s burned:18.4s
  costela  WITH flip  burn@ 25.4s overall@burn 0.969  raw … good:18.6-25.2s perfect:20.5-23.3s
  cupim    no flip    burn@ 21.2s overall@burn 0.672  raw:0.1-21.2s burned:21.2s
  cupim    WITH flip  burn@ 29.3s                     … perfect:24.2-27.4s
  ```
  Turno completo com skill 1,0 no restaurante 4 (script §8.1): `costela {raw:6}`, `cupim {}` (clientes desistem), `picanha {perfect:18, good:3}`.
- **Impacto:** `flipFood` **não** checa `flipNeeded`, então um humano que virar mesmo assim consegue — **correção da descrição original:** a UI normal já mostrava uma dica genérica, porém imediatamente/cedo demais; o FTUE usava prontidão contextual. O bot que calibra `docs/06`, `perfectRateAtSkillMid` e as metas L30/L50 nunca vira. As metas dos restaurantes 3–6 foram medidas com os cortes mais caros do jogo valendo `ing.value * 0.35` ou zero.
- **Correção sugerida:** ou `sides: 1` para itens `flipNeeded:false` (cozinha "overall" de verdade), ou remover `flipNeeded:false` e ensinar o bot/UI a virar. Regerar `tools/golden/vectors.json` depois (`npm run gen-vectors`) e reavaliar `npm run sim`.

### A-02 ✅ funcional corrigido — reprodução histórica: `unlock.level` ignorado

- **Onde:** `turn.ts spawnCustomer` monta o pool por `unlock.restaurantIndex <= restaurantIndex` (só isso). `unlock.level` aparece apenas em `tools/studio/test/data.test.ts:40`. O simulador nem recebe o nível do jogador.
- **Evidência (script §8.1, 24 níveis do restaurante 0, seeds do protótipo):** queijo_coalho 16,1 % (nível 6), legumes 15,5 % (nível 10), pão de alho 13,4 %, coração 12,9 %, frango 11,8 %, fraldinha 10,8 % (nível 14), linguiça 10,5 %, vinagrete 8,9 %.
- **Impacto:** contradiz `docs/02` §11 ("um ingrediente novo por vez") e a recompensa diária do dia 2 ("ingrediente queijo coalho" — que o jogador já recebe em pedidos desde o primeiro turno). Também deixa o FTUE dependente do `TutorialTurn` para não sortear um item difícil.
- **Correção:** passar `playerLevel` em `TurnConfig` e filtrar por `unlock.level`; adicionar teste.

### A-04 ✅ funcional corrigido — reprodução histórica: zona 4 declarada, nunca criada

- **Onde:** `restaurants.json` idx 4/5/6 `grill.zoneCount: 4` (+ `introduces: zone_4`, `docs/02` l.129 "a fourth zone unlocks at restaurant 5"); `grill.json` define 3 zonas; `createGrill` itera `db.grill.zones` e clampa.
- **Evidência:** script §8.1 — `sim.grill.zones.length` = 3 para os 7 restaurantes.
- **Correção:** ou adicionar a 4ª zona em `grill.json` (com `heatMultiplier`, cor, ids) e fazer `createGrill` respeitar `zoneCount`, ou remover `zoneCount:4`/`zone_4` dos dados e docs.

### A-05 ✅ funcional corrigido — reprodução histórica: VIP inexistente em jogo

- **Onde:** `customers.json vip.weight = 0`; `levels.json[].vipChance` (gerado por `gen-levels.ts`) e `turn.ts:60` só tipam; `grep -rn vipChance tools prototype` → nenhum consumidor; `spawnCustomer('vip')` só em `test/turn.test.ts`.
- **Contradições:** `restaurants.json` idx 1 `introduces: vip`; `events.json defaults.vipBaseChance 0.06 / vipMaxPerDay 2` sem consumidor; `ads.json rewardedPlacements.call_vip`; `Assets/Audio/sfx_vip_arrive.wav`; conquistas `vipServed`; ficha da loja "11 tipos de cliente, incluindo VIP que paga muito".
- **Correção:** implementar o evento de chegada (`vipChance`/`vipBaseChance` por turno + placement `call_vip`) ou tirar VIP do que é prometido.

### A-06 ✅ Resolvido em A-06.1–A-06.5 — reprodução histórica: trilhas de upgrade sem efeito

- **Situação resolvida:** Todas as 27 trilhas possuem consumidores reais implementados e testados no runtime (`cooking.ts`, `turn.ts`, `staff.ts`, `offline.ts`). Zero no-ops remanescentes.
- **A-06.1:** Compras centralizadas, fila paginada (`capacity`/`tables`), bônus aditivo de gorjeta (`brasa_mastery`), bônus de paciência (`clientela_fiel`), gating estrito.
- **A-06.2:** Recursos físicos reais: estabilidade de calor (`grill_stability`), piso de eficiência do carvão (`charcoal_quality`), reposição automática com chance (`charcoal_auto`), estoque por ingrediente (`counter`).
- **A-06.3:** Funcionários no turno: `garcom` (auto-serviço com teto e cadência por `tray`), `auxiliar` (auto-preparo e vaga extra), `churrasqueiro` (auto-virada no sinal público).
- **A-06.4:** Ausência real: `caixa` (antecipação no retorno), `gerente` (+18% offline por nível), `imperio_logistica` (+2% offline por nível); rebalanceamento de renda tardia (`late_income`).
- **A-06.5:** Revisão final da matriz de 27 trilhas, 680 testes vitest, 18/18 metas PASS na campanha longa de 1500 turnos. Relatório vigente: `docs/evidence/a06/step5/README.md`.

- **Com efeito real histórico:** (lidas por `cooking.ts`/`economy.ts`/`turn.ts`): `grill_size`, `grill_heat`, `grill_speed`, `charcoal_duration`, `knife`, `plates`, `decor`, `patience_charm`, `music`, `capacity`, `lighting`, `sign`, `gerente` (só offline).
- **Sem efeito (diagnóstico original superado):** `grill_stability`, `charcoal_quality`, `charcoal_auto`, `board`, `counter`, `tray`, `tables`, `garcom`, `auxiliar`, `churrasqueiro`, `caixa`, `brasa_mastery`, `clientela_fiel`, `imperio_logistica`.
- **Impacto original:** o jogador pagava por no-ops; o sim comprava todas por `UPGRADE_PRIORITY`.
- **Correção executada:** implementação completa de consumidores reais em A-06.1 a A-06.4, validada e fechada em A-06.5.

### A-07 ✅ Resolvido em F2 — reprodução histórica: `restaurantsUnlocked` acumula

- **Onde:** `economy.ts:162` `addCounter(p, 'restaurantsUnlocked', index + 1)`.
- **Evidência (script §8.1):** desbloqueando 1→6 em sequência o contador vale 2, 5, 9, 14, 20, 27.
- **Impacto:** `achievements.json restaurant_3/5/7` (alvos 3/5/7) disparariam nos restaurantes 2/3/4 — `restaurant_7` paga 200 000 moedas, 150 brasas e a coroa. Latente só porque não há avaliador (B-08).
- **Correção:** `p.counters.restaurantsUnlocked = index + 1` (ou `addCounter(…, 1)` com base 1).

### A-08 ✅ Resolvido em F2 — reprodução histórica: `burnedFood` dobrado

- **Onde:** `turn.ts:370` (callback `onBurn` do `tickGrill`) e `turn.ts:337` (`serve` com `quality === 'burned'`).
- **Evidência (script §8.1):** deixar queimar e servir o mesmo prato → `burnedFood = 2`.
- **Impacto:** `burnedRate` em `run-sim`/`balance-report` e o campo `counters.burnedFood` dos vetores dourados de turno (`tools/golden/vectors.json`) estão inflados. O bot descarta queimados antes de servir, então o efeito é pequeno no sim, mas no jogo real (servir queimado é comum) dobra.
- **Correção:** contar só em um lugar (o `onBurn`), regerar vetores.

### A-09 ✅ Resolvido em F2 — reprodução histórica: `result()` não idempotente

- **Onde:** `turn.ts:501–` soma `turnEndBonus` em `this.coins` a cada chamada.
- **Evidência (script §8.1):** duas chamadas seguidas → 745 e 842 moedas (turno `level_001`, seed 4242, skill 0,6). Os chamadores atuais (`main.ts:931`, `run-sim.ts:141,316`, `gen-vectors.ts:338`) chamam uma vez cada.
- **Correção:** memoizar (`this.finalResult ??= …`) ou calcular o bônus fora de `this.coins`.

### A-10 🟠 `refillCharcoal()` não cobra

`turn.ts:266` nunca lê `grill.json charcoal.refillCostCoins`. Hoje é 0, então o dado é decorativo — mas qualquer tuning aqui não terá efeito.

### A-11 🟠 `evolveChurrasqueira()` sem contador de brasas

`economy.ts:218–235` debita `p.embers -= step.costEmbers` mas não faz `addCounter('embersSpentTotal')` (o `buyUpgrade` faz em `:144`) e o `LedgerEntry` devolvido é só de moedas — o gasto de brasas some do extrato. Latente: hoje todos os `costEmbers` em `churrasqueiras.json` são 0; no primeiro tuning com brasas, contadores e ledger premium ficam errados.

### A-12 🟠 `computeOfflineEarnings`

`economy.ts:283` `(p.upgradeLevels['caixa'] ? 1 : 1)` (morto), `:293 void nowSec` (parâmetro inútil), `gerenteMult` usa `upgradeLevels['gerente']` sem clamp ao `maxLevel 4`. Evidência (script §8.1, restaurante 3, 8 h ausente): nível 4 → 34 675 moedas; nível 14 (save adulterado ou bug futuro) → 70 963. `minCollectIntervalMin` e `adDoubleAvailable` de `economy.json` não são aplicados.

### A-13 🟠 `deriveStats`

`cooking.ts:38` `Math.floor(get('grill_size') / 1)`; `:53` `Math.floor(get('garcom') > 0 ? 0 : 0) + …` (sempre 0 + churrasqueiro); `auto*Level` sem clamp a `maxLevel`. Nada quebra hoje porque nenhum `auto*` é lido (A-06), mas é código que engana o leitor e a porta C#.

### A-14 🟠 `stageOf()` ignora `burned` com `stageOverrides`

`cooking.ts:152–155` (e `Rules.cs:450–455`, porta fiel): para `pao_de_alho`/`queijo_coalho` o estágio vem só do overall. Um pão com um lado a 1,2 (queimado, `scoreItem → burned`) tem overall ≈ 0,67 → rótulo "crocante"/"dourado". UI e pontuação discordam.

### A-15 🟠 Bot de referência vaza itens

`policy.ts:96–99` faz `a.spawn(ing)` **antes** de saber se há vaga (`pickZoneFast` pode devolver −1); o item fica fora da grelha, `alreadyCooking` continua falso e o bot spawna de novo a cada tick.
Evidência (script §8.2, `lata_valente` 1 zona, restaurante 1): `takeFromStock` chamado 7 800 ×, `foods[]` cresce a 7 779 para 19 itens cozidos; `rawStockPerTurn` nunca é aplicado. Custo de CPU/memória no `sim:long` e nos testes; sem efeito na pontuação.

### A-16 🟡 / A-17 🟡 / A-18 🟡

- `startCharcoalRefill`/`charcoalRefillDuration` (`cooking.ts:302–314`) sem uso em TS; `Rules.cs` os porta com o marcador `1e-6`.
- `policy.ts:240` `push()` morto; `reactionSec` e `latency` são o mesmo valor (`:49–50`); `perfectOnly` (`:52`) nunca lido.
- `turn.ts:541` `forcedId` desconhecido cai em `pool[0]` em silêncio; `:437` pico de pedidos medido antes do loop de expiração.

### A-19 🟠 Streak: doc × código

`docs/08-LIVEOPS.md:88` e o comentário em `save.ts` dizem "dia de graça não avança a sequência"; `resolveDailyClaim` avança (e `save.test.ts:242–248` congela esse comportamento: streak 5 → 6 após um dia perdido). Após reset (`streak = 1`) o `dayIndex` continua de `lastClaimDayIndex + 1` em vez de voltar ao dia 1 — o protótipo faz `lastClaimDay = 0`. Decidir qual é a regra e alinhar doc + teste + protótipo.

### A-20 🟡 `serializeSave`

`stableStringify` emite `undefined` literal e o `JSON.parse(payload)` seguinte lança. Basta um campo opcional indefinido no `SaveGame` para quebrar o save. Sugestão: pular `undefined` no `stableStringify`.

---

## 5. Dados — `shared/data`

### B-01 🟠 Campos sem consumidor

`grep -rn` em `tools/sim-core/src tools/studio prototype/src` (excluindo `types.ts`):
`economy.reward.speedBonusWindow`, `roundCoinMultiplierRange`, `dailyReward.streakBonusPerCycle`, `idle.minCollectIntervalMin`, `idle.adDoubleAvailable`, `grill.charcoal.refillCostCoins`, `ingredients[].burnRate`, `levels[].vipChance`, `restaurants[].grill.heatStability`, `events.defaults.vipBaseChance/vipMaxPerDay`. Tuning nesses campos não muda nada; o schema os aceita.

### B-02 🟠 Upgrades sem gating

`upgrades.json` não tem `unlockRestaurantIndex`/`unlockLevel`; `economy.ts canAfford/buyUpgrade` só comparam preço. `employees.json` diz `garcom` no restaurante 1, `auxiliar` 2, `churrasqueiro`/`caixa` 3, `gerente` 4. Um jogador no quintal pode comprar Gerente (renda offline) no primeiro dia.

### B-03 🟠 Idle no restaurante 1 × "introduces idle_offline" no 3

`economy.json idle.coinsPerMinuteByRestaurant = [0, 6, 16, …]` e `computeOfflineEarnings` só zera para índice 0. `restaurants.json` idx 3 `introduces: idle_offline` e `docs/02` l.191 idem. O protótipo (C-02) ainda mostra renda offline no restaurante 0.

### B-04 🟠 Texto do upgrade ≠ efeito

| Trilha | `effect.stat` | Texto pt-BR promete |
|---|---|---|
| `board` | `prepSlots` | "Organiza os pedidos para ninguém esperar demais" (paciência) |
| `plates` | `tipMult` | "Serve mais clientes antes de lavar a louça" (capacidade) |
| `decor` | `tipMult` | "segura o cliente na mesa" (paciência) |
| `clientela_fiel` | `patienceMult` | "dão gorjetas melhores" (gorjeta) |
| `auxiliar` | `autoPrepLevel` | "Cuida do carvão" |
| `grill_speed` | `heatRampRate` | "Aquece de forma mais estável" (é `grill_stability` que fala de oscilação — e não faz nada) |

### B-05 🟡 Evoluções do `chef_cisma`

`grill.chef_cisma.evo2.desc` "3 fileiras, 7 espetos" → dados `slotsPerZone 2 × zoneCount 3 = 6`; `evo3.desc` "8 espetos" → `3 × 3 = 9`. As outras 10 descrições batem.

### B-06 🟡 Texto literal em tabela

`churrasqueiras.json` `shortName` ("Aprovada pela Vo", "Chapa da Calcada", "Termometro que Nao Mente"…) e `humorTag`, `employees.json abilities[].effect` (inglês) — sem consumidor, sem acento, duplicam o l10n. Viola a regra §56 que o `check-l10n` aplica a outras tabelas; `churrasqueiras.json` não está na lista de acentos do `validate-data`.

### B-07 🟢 Resolvido em F11 — IDs de produto

`brasa.coins.small|medium|large.v1` foram renomeados atomicamente para `brasa.embers.small|medium|large.v1` em `shared/data/iap.json`, `Assets/Data/iap.json`, `.env.example`, `credentials.json.example`, `SecureConfig.cs`, `monetization.test.ts` e `docs/07-MONETIZATION.md`. IDs agora refletem com exatidão a entrega de Brasas e eliminam o risco de SKU incorreto no Play Console.

### B-08 🟡 Conquistas/missões sem produtor

Não existe avaliador de conquistas/missões. `addFoodCounter` (`economy.ts:111`) nunca é chamado; ninguém produz `category.*`, `vipServed`, `playerLevel`, `employeesHired`, `dailyMissionsComplete`, `loginStreak`, `collectionEntries`, `routeStopsCleared`, `idleCollections`, `eventsCompleted`, `passTiersClaimed`. `validate-data` não valida nomes de stat (D-04), então um typo passa.

---

## 6. Protótipo — `prototype/src/main.ts`

### A-03 ✅ funcional corrigido — reprodução histórica: Vinagrete (detalhe)

`main.ts:531–534` monta a bancada só com `cookMethod === 'grill'`; não há `prepProgress`, nem gesto de prep, nem `serve()` para prep. `turn.ts` sorteia vinagrete (`unlock.restaurantIndex 0`, `perfectWindow [0,1]`, `heatRate 0`).
Evidência (script §8.2, seeds do protótipo): restaurante 0 → 32/271 clientes (11,8 %), em 19 dos 24 turnos; restaurante 1 → 75/547 (13,7 %), em 34 de 36 turnos. Como estrelas = servidos/spawnados ≥ 0,9 para 3★, bastam 2 vinagretes num turno de ~12 clientes para a 3ª estrela ficar impossível.

### C-01 🟠 Streak diário

`main.ts:373–388`: (a) `graceUsed = true` nunca volta a `false` num login consecutivo → graça **uma vez por instalação**, não por falha; (b) com `graceUsed` falso, um gap de 30 dias "segura" a sequência; (c) a sequência conta **logins** (`lastLoginISO`) enquanto o dia resgatável conta **resgates** (`lastClaimDay`) — divergem quando se entra sem resgatar; (d) usa dia local, `save.ts` usa `unixDay` UTC.

### C-02 🟠 / C-03 🟠 / C-04 🟡 / C-05 🟡 / C-06 🟡

- `main.ts:391–` popup offline `mins*(6+level*2.2)` com `Math.random()`, inclusive no restaurante 0 e ignorando `computeOfflineEarnings`.
- `finishTurn` (`:930–996`) sobe de nível em loop próprio sem pagar `levelUpCoins` (`100·L^0.85`) nem as 3 brasas a cada 5 níveis que `applyTurnResult` paga.
- `xpForLevel` (`:205`) e `DAILY_REWARDS` (`:214`) hardcoded — iguais a `economy.json` hoje.
- `claimDaily` (`:1306`): dia 7 = `+500` fixo, ingrediente/booster não fazem nada; roleta "Chest"/"Booster" idem; `buyUpgrade` (`:1748`) debita sempre `coins`.
- Strings literais fora do l10n; bancada `.slice(0, 8)` esconde itens além do 8º.

### C-07 🟡 `dev-server.mjs`

O watcher (`:143–153`) só olha `src/main.ts` — editar `audio.ts`, `foods.ts`, `ftue.ts`, `sprites.ts`, `theme.ts` não rebundla. `GET /data/` (diretório) passa no `existsSync` e cai em `EISDIR` → 500. A proteção contra path traversal está correta.

---

## 7. Ferramentas, l10n, C#, docs

### D-01 🟠 Curvas medidas em grelhas diferentes

`run-sim.ts measureSkillCurve` (origem de `perfectRateAtSkillMid`) não passa `churrasqueiraId` → grelha padrão do restaurante (3 zonas), enquanto `simulateProgression` usa a `lata_valente` de 1 zona. O `_grillPacingNote` de `economy.json` descreve o contrário.

### D-02 🟠 Alvos não verificados

`economy.json targets.sessionLengthMinutes` e `noUpgradeCostRegression` não aparecem em `checkTargets`; o relatório diz "18 alvos" e omite que dois são decorativos.

### D-03 🟡 / D-04 🟡 / D-05 🟡

- `validate-data.ts` roda `generateLevels()` e valida **isso**, não o `shared/data/levels.json` commitado (o diff com o gerador não faz parte de nenhum gate — hoje está em sincronia porque eu conferi). Lista de acentos cobre 8/22 tabelas. `void validateDatabase` sobrou.
- Nenhum gate confere `stat` de conquistas/missões contra os contadores realmente produzidos.
- `tools/csharp/check.mjs` dá SKIP sem SDK; no CI o SDK existe, mas localmente é o único gate que pode passar sem rodar.

### D-06 🟠 l10n

`shared/l10n/en-US.json` e `es-419.json`: 54 de 514 chaves. `check-l10n` passa porque exige só o pt-BR completo. Se a intenção é lançar só pt-BR, documentar; se não, o gate esconde 90 % de trabalho.

### E-01 🟠 `AdService.cs`

Cabeçalho diz "100 % config-driven"; corpo hardcoda `>= 6/dia` (ads.json: por placement, 2–6), cooldown `TotalMinutes < 0` (nunca bloqueia), `>= 3` intersticiais, 60 % de probabilidade, 180 s da sessão. `shownToday` não zera na virada do dia. `ShowRewarded` devolve `Dismissed` + token falso. Assumido como stub, mas os comentários prometem outra coisa.

### E-02 🟠 `BillingService.cs`

`Purchase` marca posse com `local_receipt_pending` sem chamar a loja; `IsNonConsumable` decide por substring (`"starter"`, `"noads"`) em vez de `iap.json type`. Comentários em francês misturados.

### E-03 🟡 `GameData.cs`

Doc-comment fala em 10 tabelas, carrega 7; `Build()` rejeita `< 0` onde `data.ts` rejeita `<= 0`. `Rules.cs` ↔ `cooking.ts`: paridade OK por leitura (inclui RoundHalfUp e o `rare`).

### F-01 🟠 README / docs apontam para o que não existe

`README.md:20,23,34–35`: `Packages/`, `ProjectSettings/`, `marketing/` (os assets estão em `store-assets/`), `Assets/Scripts/Sim/` (é `Assets/Scripts/Core/`), `tools/studio/golden.test.ts` (é `tools/studio/test/golden.test.ts`). `types.ts` e `docs/03` citam `tools/sim-core/golden/` (é `tools/golden/`). `docs/18-STATUS.md:288` já admite `Packages/` e `ProjectSettings/` "not yet written" — o README não.

### F-02 🟠 Custos de restaurante

`docs/02` l.188–194 × `restaurants.json`: 3 500→**0**, 12 000→3 500, 70 000→15 000, 150 000→67 000, 500 000→178 000, 2 800 000→4 200 000. O restaurante 1 é **grátis** nos dados (só nível 8). `docs/06` provavelmente foi retunado e `docs/02` não.

### F-03 🟡 / F-04 🟡 / F-05 🟡

- `docs/02` §10 (curva de skill) não bate com `npm run sim`; §4.5 argumenta que a janela da costela "é forgiving" — sem virar ela não existe (A-01).
- `README.md:104` "Not started: 3D/2D art assets, recorded audio" — `Assets/Art` tem 100+ PNG com registro, `Assets/Audio` tem WAVs gerados por `tools/generate-audio-assets.mjs`.
- Caminho de golden errado em `types.ts`/`docs/03`.

---

## 8. Reprodução

Todos os scripts abaixo rodam com `node --experimental-strip-types <arquivo>` a partir da raiz (imports absolutos para não depender do cwd).

### 8.1 Regras (A-01, A-02, A-04, A-07, A-08, A-09, A-12)

```ts
import { loadDatabase } from '/home/user/game_churrasqueiro/tools/studio/load-data.ts';
import { TurnSimulation, SkillPolicy, Rng, unlockRestaurant, newPlayerState, computeOfflineEarnings }
  from '/home/user/game_churrasqueiro/tools/sim-core/src/index.ts';
const db = loadDatabase();

// A-07: contador acumula
const p = newPlayerState(); p.coins = 1e9; p.level = 99;
for (let i = 1; i <= 6; i++) { unlockRestaurant(db, p, i); console.log('restaurantsUnlocked', p.counters.restaurantsUnlocked); }
// → 2, 5, 9, 14, 20, 27

// A-12: gerente sem clamp
for (const lvl of [4, 14]) { p.upgradeLevels = { gerente: lvl }; p.restaurantIndex = 3;
  console.log('gerente', lvl, computeOfflineEarnings(db, p, 8 * 3600, 0).coins); }        // → 34675, 70963

// A-04: zonas por restaurante
for (let r = 0; r < 7; r++) {
  const sim = new TurnSimulation(db, { restaurantIndex: r, levelId: 'level_001', upgradeLevels: {}, seed: 1 }, 1);
  console.log('restaurant', r, 'zones', sim.grill.zones.length);                            // → 3 em todos
}

// A-09: result() duas vezes
const sim = new TurnSimulation(db, { restaurantIndex: 0, levelId: 'level_001', upgradeLevels: {}, seed: 4242 }, 4242);
const pol = new SkillPolicy(new Rng(1), { skill: 0.6 });
while (!sim.finished) sim.tick(1 / 30, (a) => pol.act(a));
console.log(sim.result().coins, sim.result().coins);                                         // → 745, 842
```

Para A-08 basta, num turno manual, deixar um item queimar na grelha e servi-lo: `counters.burnedFood === 2`.
Para A-02, contar `e.customer.lines[].ingredientId` nos eventos `spawn` dos 24 primeiros níveis (config e seeds iguais às do protótipo: `seed: 20260917 + id.length + i`).

### 8.2 Protótipo/bot (A-03, A-15)

Mesma montagem de turno com `churrasqueiraId: 'lata_valente', churrasqueiraLevel: 1`; contar clientes cuja linha inclui `vinagrete` (A-03) e envolver `takeFromStock`/`foods.length` para ver o vazamento (A-15).

### 8.3 Cozimento sem virar (A-01)

```ts
import { loadDatabase } from '/home/user/game_churrasqueiro/tools/studio/load-data.ts';
import { createGrill, createFood, placeOnGrill, tickGrill, scoreItem, rewardTuning, flipFood, overallDoneness, deriveStats }
  from '/home/user/game_churrasqueiro/tools/sim-core/src/cooking.ts';
const db = loadDatabase(); const r = db.restaurants.restaurants[4]!; const stats = deriveStats(db, r, {});
for (const id of ['costela', 'cupim', 'picanha']) for (const flip of [false, true]) {
  const g = createGrill(stats, db); const f = createFood(1, db.ingredientById.get(id)!); placeOnGrill(g, db, f, g.zones.length - 1);
  let t = 0, flipped = false; const seen = new Map<string, [number, number]>();
  while (!f.burned && t < 400) { tickGrill(g, db, 0.05); t += 0.05;
    if (flip && !flipped && (f.sides[f.downSide] ?? 0) >= 0.6) { flipFood(g, f, t, db); flipped = true; }
    const q = scoreItem(db, f, { target: 0, toleranceScale: 1, patienceRemaining: 1, combo: 0, tipMult: 1, xpMult: 1, tuning: rewardTuning(db.economy) }).quality;
    const c = seen.get(q); if (!c) seen.set(q, [t, t]); else c[1] = t; }
  console.log(id, flip ? 'flip' : 'no-flip', 'overall@burn', overallDoneness(f).toFixed(3), [...seen].map(([q, [a, b]]) => `${q}:${a.toFixed(1)}-${b.toFixed(1)}s`).join(' '));
}
```

### 8.4 Greps úteis

```
grep -rn "speedBonusWindow\|roundCoinMultiplierRange\|streakBonusPerCycle\|minCollectIntervalMin\|adDoubleAvailable\|refillCostCoins\|burnRate\|vipChance\|heatStability" tools/sim-core/src tools/studio prototype/src | grep -v types.ts
grep -rn "unlock.level\|\.unlock\.level" tools prototype                      # só test/data.test.ts:40
grep -rn "addFoodCounter\|vipServed\|playerLevel" tools/sim-core/src prototype/src   # sem produtor
grep -n "restaurantsUnlocked" tools/sim-core/src/economy.ts                  # :162
```

---

## 9. Ordem sugerida de correção

1. **Decisões de design primeiro** (afetam vetores e metas): A-01 (`sides` × `flipNeeded`), A-02 (gating por nível), A-04 (zona 4), A-05 (VIP), A-06/B-02 (trilhas sem efeito e sem gating), A-19 (regra do dia de graça).
2. **Bugs mecânicos, baixo risco**: A-07, A-08, A-09, A-10, A-11, A-12/A-13 (limpeza), A-14, A-15, A-20.
3. **Protótipo**: A-03 (prep na bancada ou filtrar vinagrete do pool do protótipo), C-01, C-02, C-03; depois consolidar as duplicações C-04/C-05 lendo `economy.json`.
4. **Gates**: D-01, D-02, D-03 (validar o `levels.json` commitado + diff com o gerador), D-04 (stat names), D-06 (declarar política de idiomas).
5. **Docs/loja**: F-01, F-02 e a ficha (`store-assets/listing/full-ptBR.txt`) — não prometer VIP/4ª zona até existirem.

Depois de 1–2: `npm run gen-vectors && npm run sim && npm run balance-report` e revisar `docs/06`.
