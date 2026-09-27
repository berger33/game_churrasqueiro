# Prompt completo de retomada — após a entrega do PR #14

Copie este documento para iniciar a próxima sessão. O pedido do dono foi integrar o
trabalho concluído, limpar branches já integradas e continuar depois em uma nova sessão.
Este handoff foi preparado para o merge autorizado do PR #14; **confirme o estado real
no GitHub antes de alterar arquivos**. O registro final de merge/CI está no próprio PR.
O histórico dos checkpoints permanece no plano §9, na auditoria, nas evidências e no Git
(inclusive a versão anterior deste handoff em `7a591f3`).

---

## 1. Missão e regras obrigatórias

Você está no repositório **`berger33/game_churrasqueiro`**, jogo **CHURRASCO! O Mestre da
Brasa**, Android portrait, Unity 6 LTS como destino. Hoje existe uma referência TS e
protótipo web; **ainda não existe um jogo Unity publicável**.

**Seu próximo trabalho é F3/A-03: implementar o fluxo real de preparo do vinagrete.**
Não recomece A-01/A-02, não gere outro lote de arte, não antecipe C# ou Unity.

1. Trabalhe **somente na branch atribuída à nova sessão**. Não reutilize/recrie a branch
   da sessão anterior `arena/01a0e03e-game-churrasqueiro`, destinada à exclusão após merge.
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

- Entrega a integrar: **PR #14**, F1 + F2 + A-01 + A-02 + este fechamento:
  https://github.com/berger33/game_churrasqueiro/pull/14
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
  `origin/main`/base da nova sessão. Se ainda não entrou ou houver divergência, **pare e
  relate**, não suponha que o handoff substitui o estado real.
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

## 4. Baseline de testes e limitações

- Ambiente verificado: **Node22.22.3/npm10.9.8**; projeto exige Node>=22.
- **351 testes passando**,18 arquivos; **14/15 gates locais** (só C# SKIP sem dotnet).
- **CI remoto15/15** na entrega A-02, incluindo C#:
  https://github.com/berger33/game_churrasqueiro/actions/runs/36286499059
  em `7a591f3`. Consultar o PR para runs posteriores do fechamento/merge.
- C# engine-free compila netstandard2.1/C#9, warnings=erros; **139 checks concordam**,
  mas **25 casos não portados** (5 economia +20 turnos). Não declarar paridade plena.
- **106 vetores +44 FTUE**. Arquivo principal formato **v2**, `playerLevel` explícito
  nos20 turnos. A-02 alterou9 expectativas iniciais; preservou11 restantes e todas as
  cooking48/scoring32/economy6. FTUE permaneceu byte-idêntico.
  Perfis iniciais1/4/8/14 são fixtures, não previsão de nível pela fase; avançados usam44.
- **19 screenshots**,244 sprites; FTUE: primeiro perfect16,1s, completo32,9s,
  upgrade38,3s, zero misses. `prototype/shoot.mjs` usa bundle real/ponteiro real.
  Fixtures avançadas/de unlock **não** provam metaprogressão natural completa.
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

O merge do checkpoint não elimina esses bloqueios de produto/publicação. Mesma seed,
1.500 turnos, dt=1/12, nível80/restaurante6/Fornalha evo3:

| Métrica | Baseline A-02 |
|---|---:|
| Renda |22.233.557|
| Gasto |10.873.220|
| Saldo |11.360.337|
| Spend ratio |**0,489 — falha**, alvo0,70–0,99|
| Perfect / burned / clientes perdidos |75,7% /0,2% /3,5%|
| Duração média |172,5s|
| Unlocks de restaurantes |42/98/165/259/398/**883**|
| Unlocks de grills |10/45/89|
| Renda diária L5/L15/L30/L50 |10.480/39.445/108.533/**192.223**|

**Sim longo15/18, exit1.** As outras duas falhas são Rede Nacional883 vs950–1450 e
L50=192.223 vs98.000–152.000. Metas/preços nunca foram afrouxados para esconder isso.
Transportar os desvios para F4 após as correções funcionais; A-06 também afeta sinks.

Curva autoral skill.55: **46,0% perfect /571 moedas por turno**, com XP/unlocks reais.
Perfect/renda crescem com skill; cobre restaurantes0/1, não prova cortes avançados.
Probe A-01 no nível44 conserva as janelas e agregados de128 turnos avançados.
O sim curto segue verde, mas marca metas fora de alcance como PASS/skip: dívida F5,
**não** evidência de economia longa aprovada.

## 6. Próximo passo concreto — A-03, antes de qualquer outro sistema

### Reprodução e arquivos

- Vinagrete: `cookMethod:'prep'`, `prepSec:2`, `sides:1`, sem calor/virada,
  unlock nível12/restaurante0 (`shared/data/ingredients.json`). **Preservar a receita.**
- `prototype/src/main.ts` usa `availableIngredients.filter(i => i.cookMethod === 'grill')`:
  a regra pode pedir vinagrete desbloqueado, mas a UI não permite produzi-lo/servi-lo.
- `turn.ts` já incrementa progresso de prep fora da grelha e impede servir antes de1.
  Não presumir sistema completo: verificar início de preparo, capacidade, fila/ocupação,
  estados, duplicação e integração com input/UI.
- `cooking.ts`: `prepSlots`, `prepSpeedMult`, `prepProgress`; `policy.ts` já cria prep
  fora da grelha. `board`/`knife` e restaurante.service precisam de consumidor coerente.
  Preparar o vínculo com A-06 sem implementar todas as27 trilhas agora.
- Ler `turn.ts`, `cooking.ts`, `policy.ts`, `types.ts`, dados, `prototype/src/main.ts`,
  `cooking-ui.ts`, tutorial/l10n/áudio, `run-sim.ts`, testes e harnesses de ponteiro.

### Ordem e aceite

1. Reproduzir pedido de vinagrete na UI com playerLevel12+; comparar antes/no/depois do
   desbloqueio (11/12/13), mantendo FTUE1 intacto. Registrar prova do bloqueio atual.
2. Propor/descrever fluxo mínimo coerente de prep antes de editar: área/slot fora da
   grelha, início/progresso/pronto, retirada/serviço, ocupação/capacidade e descarte.
   Não deixar timers consumirem capacidade fictícia nem permitir serviço prematuro.
3. Escrever regressões red para regra e UI: capacidade, tempo/velocidade, prep sem grelha,
   pickup/drag/drop/hitboxes, tentativas inválidas, pedido misto prep+grill, paciência,
   combo, cliente servido só quando completo, moedas/XP/resultado sem duplicação.
4. Implementar referência TS + UI e orientação contextual localizada se necessária,
   usando a arte já aprovada. Não quebrar paginação, A-02 ou seleção de pratos vizinhos.
5. Usar bot, sim e harness reais, sem hooks mutadores para fingir conclusão. Capturar
   screenshots do fluxo. Distinguir fixture de teste de progressão natural implementada.
6. Revisar cada diff semântico de dados/vetores; só regenerar contratos afetados.
   Validar cozinha, prep, turnos mistos, skill curve e 1.500 turnos sem tuning oportunista.
7. Atualizar docs02/03/06/18/23/24 conforme impacto, evidências red/green, plano/status,
   commits e PR da nova sessão. Verificar CI remoto. **Não fazer merge sem novo pedido.**

## 7. Tudo que ainda falta, na ordem vigente

A auditoria tem47 achados originais (9 altos,19 médios,19 baixos). F2 está corrigida;
A-01/A-02 funcionais, economia global pendente; **A-03–A-06 ainda abertos**.
Plano autoritativo: `docs/23-PLANO_IMPLEMENTACAO.md` §9 (não usar a ordem histórica antiga).

1. **F3/A-03:** prep/vinagrete conforme seção6.
2. **A-04 — quarta zona:** decisão do dono ainda pendente. Recomendação documentada:
   manter a promessa e implementar4 zonas ponta a ponta (default e grills equipados),
   dados/calor/bot/UI/arte aprovada/screenshots. Alternativa exige remover a promessa de
   todos os contratos/textos. **Não escolher silenciosamente.**
3. **A-05 — VIP:** consumir chance/fonte, aparição natural e forçada, teto diário
   persistido, recompensas/analytics/áudio/conquistas e `call_vip`. Testar chance0,
   caps e renda **sem rewarded**; conveniência, nunca requisito de progressão.
4. **A-06 —27 trilhas:** mapear consumidor/fórmula/limite/tela/teste/sim. Implementar
   consumidores faltantes ou ocultar/desabilitar compras no-op explicitamente; impedir
   gastos fictícios do bot. Decisões de migração/reembolso de compras antigas exigem
   aprovação. Revalidar sinks/spend sem aumentar preços só para voltar ao verde.
5. **F4 — revalidação global:** após A-03–A-06, revisar dados/levels/vetores, guardrails,
   economia e decisões de design. Publicar renda/unlocks/spend/perfect/burned/lost,
   duração/grills, com logs brutos. Resolver os3 desvios, não declará-los aprovados.
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
   EconomyRules, SaveSystem v3/migrações e cola completa TutorialTurn. Cobrir os20 turnos
   +5 econômicos, regressões F2/A-01/A-02 e futuros fixes. netstandard2.1/C#9,
   warnings=erros, **zero not ported**, não apenas os139 checks existentes.
10. **F9 — Unity6 LTS:** criar Packages/ProjectSettings/assemblies/scenes/prefabs/.meta;
    importer do manifesto/AssetPostprocessor/atlases; GrillView/FoodView/CustomerCardView/
    TurnFlow; input/UI/áudio/save/l10n. Turno completo no Editor e60FPS em Android físico.
11. **F10 — meta, localização e acessibilidade:** coleção/missões/conquistas/eventos/
    loja/passe/rota e progressão real; en-US/es-419 além dos57/515 keys (11,1%, fallback);
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
npx vitest run tools/studio/test/ingredient-unlock.test.ts tools/studio/test/unlock-wiring.test.ts
npm run check-vectors
npm run check-shots              # prototype/shots/, artefatos ignorados pelo Git
node --experimental-strip-types tools/studio/slow-cuts-report.ts
npm audit --fetch-timeout=15000 --fetch-retries=0
```

- Só executar `gen-vectors`, `gen-levels`, `gen-schemas`, tipos C# ou sync-data quando a
  mudança exigir; revisar o diff, não usar regeneração como substituto de análise.
- Logs A-01/A-02 estão versionados em `docs/evidence/`. `/tmp` e arquivos ignorados de
  outra sessão não são evidência persistida garantida; reproduzir o que precisar.
- Para preview, usar o servidor do protótipo em0.0.0.0, URLs relativas e host permitido;
  ferramentas de processo para servidor persistente, não bash bloqueante.

**Comece conferindo o merge e o baseline. Depois reproduza A-03 e escreva seus testes red.
Não execute outra fase, não altere a decisão de virada, não apague PRs preservados e não
mascare falhas econômicas.**
