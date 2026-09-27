# Prompt de retomada — correção do núcleo técnico após fechamento da arte

Use este texto como contexto inicial da próxima sessão no repositório
`berger33/game_churrasqueiro`. Trabalhe somente na branch atribuída à nova sessão e confirme o
estado real de `origin/main` antes de alterar arquivos.

## Handoff F2 — vigente (2026-09-26 local / 27 UTC)

### Estado atual e evidências

- Mesma branch: `arena/01a0e03e-game-churrasqueiro`. Fetch confirmou PR #14 ainda **aberto,
  sem merge**; F2 amplia esse PR porque não se pode criar/trocar de branch nesta sessão.
  Main contém o merge PR #13 (`4fe4f4f`); **não assumir que F1/F2 foram integradas**.
- Baseline da continuação `3f1c9c6`: árvore limpa, Node 22.22.3/npm 10.9.8, `npm ci`,
  254 testes, 14/15 gates locais e 18/18 guardrails longos, mesmas 5 vulnerabilidades.
- **F1 permanece concluída:** gate de arte, 52 testes, 244 IDs protegidos; sem arte nova.
- **F2 concluída na referência TS:**
  - `5803806` A-07: restaurantes inicial=1, sequência 2..7; save v1/v2/v3 normalizado após
    CRC, sem mudar shape/v3 nem carteiras/conquistas/contadores não relacionados.
  - `f2958d6` A-08: contar uma única transição onBurn, nunca somar de novo ao servir.
  - `02e7f61` A-09: `result()` puro, bônus e rounding só no retorno, eventos/counters
    independentes; leituras no meio do turno não congelam o resultado.
- Provas red: A-07 7 falhas em 8 novos testes; A-08 3 falhas em 4; A-09 8 falhas
  (6 novos + 2 consumidores fortalecidos). Reproduções incluem 2/5/9/14/20/27 restaurantes,
  prato queimado=2 e moedas 745→842 (FTUE 86→127) na segunda leitura.
- Final: **272/272 testes**, 14 arquivos; **14/15 gates locais**, só C# SKIP sem .NET.
  `sim:long` após cada correção: **18/18**, saída integral idêntica ao baseline, spend 0,741,
  burned 5,7%, perfect 71,8%, perdidos 6,9%, média 169,8 s, nível 80 em 1.500 turnos.
- `check-vectors`: **98 + 44 sem drift**, não regenerados. Vetores do bot não exercitam
  sequência de unlock/save, descarte→serve queimado ou segunda leitura; testes novos cobrem.
  Replay dos 12 turnos e consumidor FTUE agora exigem leitura idempotente.
- FTUE 16,1/32,9/38,3 s, zero erros; 244 sprites, 13 screenshots; dados/schemas/levels/
  imagens/preços intactos. `npm audit` continua 1 crítica + 1 alta + 3 moderadas.
- CI remoto F2/PR #14: registrar após o push. CI anterior F1 15/15 no run `36282836431`.

### Limites do que foi corrigido

- A-01–A-06 **seguem abertos**, assim como a triagem média/baixa, dependências e paridade C#.
- O save não serializa turnos ativos; teste de restauração de burns cobre resultado creditado
  ao jogador + save/load. Histórico inflado de burns não pode ser reconstruído sem diário por
  item e não é alterado. Normalização de restaurantes confia em `restaurantIndex` válido.
- `result()` é leitura, não concessão de recompensa. `applyTurnResult`/carteira ainda devem
  ser chamados uma única vez; não foi implementado ledger idempotente de resgates.
- C# continua sem os 12 vetores completos e 5 econômicos. Portar também as regressões F2
  quando chegar F8, sem confiar só no conjunto golden antigo.

### Próxima ação concreta — F3/A-01

1. Confirmar branch/base/árvore e estado do PR #14; não mergear sem autorização.
2. Ler os documentos obrigatórios e docs/23-PLANO §9. **Confirmar com o dono a escolha A-01:**
   recomendação = costela/cupim `sides:1`, mantendo `flipNeeded:false` para cortes lentos;
   alternativa = exigir virada com bot/UI/tutorial/docs alinhados. Não editar dados sem decisão.
3. Reproduzir os cortes indo de cru direto a queimado; criar regressões de janela perfeita e
   bot avançado antes de corrigir. Revisar dados e diff semântico dos vetores afetados;
   revalidar renda, perfect/burned, unlocks e curva de habilidade. Nunca retunar só para passar.
4. Depois A-02 (nível no contrato + gating sem mudar roteiro FTUE), A-03 (prep real), A-04
   (decisão explícita sobre quarta zona), A-05 (VIP), A-06 (consumidores das 27 trilhas).
5. Ordem restante: F4 revalidação global → F5 dívida técnica → F6 dependências isoladas →
   F7 revisão seletiva PRs #7/#8 → F8 C# → F9 Unity → F10 meta/l10n/acessibilidade →
   F11 serviços → F12 QA/device → F13 publicação com evidências.
6. Não iniciar arte/Unity/C# agora, não mergear PRs antigos, não inserir credenciais. Cada
   alteração exige red/green, gates+sim longo, docs atualizadas e commits na branch atribuída.

---

## Handoff F1 — histórico de 2026-09-27 UTC (substituído pela F2 acima)

### Entrega desta sessão

- Branch usada exclusivamente: `arena/01a0e03e-game-churrasqueiro`.
- Baseline `4fe4f4f` contém o merge PR #13, também confirmado em `origin/main` após fetch.
  CI de PR #13 aprovado, run `36281871246`; árvore inicial limpa; Node 22.22.3/npm 10.9.8.
- Commits: `70a60b3` (plano/baseline), `ad29b56` (gate e testes), `92976b2` (docs/handoff).
  [PR #14](https://github.com/berger33/game_churrasqueiro/pull/14) aberto, **sem merge**.
  CI remoto **15/15 aprovado**, incluindo C#, em `92976b2`: [run 36282761422](https://github.com/berger33/game_churrasqueiro/actions/runs/36282761422).
  O commit seguinte só registra essa evidência nas docs; confira também seu check no PR.
- **F1 implementada:** `npm run check-art-registry`, CLI somente leitura em
  `tools/art/check-art-registry.ts`, integrado em `run-gates.mjs`, package e CI.
  Confere masters ↔ CSV ↔ especificações de lote ↔ manifesto ↔ runtime e lookups;
  recusa pending/rejected/superseded no bundle, órfãos/links/caminhos inseguros/duplicatas;
  mantém os 244 IDs de `art/approved-runtime-baseline.json` (extraídos e conferidos em PR #13).
  Não regenerar essa lista para fazer um teste passar. PNG/WebP não foram alterados.
- Reprodução: gate antigo aceitou arquivo órfão; 49 testes inicialmente vermelhos.
  Final: **52 testes do gate** (46 negativos + 6 positivos), **254/254 testes no total**,
  14 arquivos; **14/15 gates locais**, único SKIP = C# sem .NET SDK.
- `sim:long`: **18/18** e saída integral idêntica ao baseline; spend 0,741, burned 5,7%,
  perfect 71,8%, perdidos 6,9%, duração 169,8 s, nível 80 em 1.500 turnos.
  Vetores 98 + 44 intactos; FTUE 16,1/32,9/38,3 s e zero erros; 244 sprites/13 screenshots.
- `npm audit` antes/depois: **5 vulnerabilidades**, 1 crítica, 1 alta, 3 moderadas; exit 1.
  Nenhuma atualização major aplicada, nem `audit fix --force`.
- **Todos A-01–A-09 continuam abertos.** Nenhum contrato de gameplay/save/dados mudou.
  Nenhuma decisão de produto foi aplicada; não confundir esta F1 com correção das regras.

### Próxima ação ao encerrar F1 — histórica

1. Na branch atribuída à próxima sessão, fetch/confirmar base real e árvore limpa; conferir
   estado do PR desta entrega. Não assumir que ele foi integrado. Reexecutar baseline.
2. Ler integralmente os documentos obrigatórios e **docs/23-PLANO §9**, ordem vigente:
   F1 arte (implementada) → **F2 A-07/A-08/A-09** → F3 A-01–A-06 → F4 revalidação →
   F5 dívida média/baixa → F6 segurança → F7 revisão seletiva PRs antigos → F8 C# →
   F9 Unity → F10 metajogo/l10n/acessibilidade → F11 serviços → F12 QA → F13 publicação.
3. **Reproduzir A-07 primeiro** (`economy.ts`, `newPlayerState`, `unlockRestaurant` e save).
   Escrever testes vermelhos para inicial=1, sequência 2..7, tentativa repetida, roundtrip e
   save antigo com contador inflado; considerar metas de conquistas 3/5/7. Só então corrigir.
4. A-08: única contagem por alimento queimado, servir/descartar/múltiplos/resultado/restauração.
   A-09: result puro/memoizado, repetição/igualdade/moedas/XP/serialização/chamadores reais.
5. Antes de A-01/A-04, pedir confirmação: recomendados cortes efetivamente de um lado
   mantendo `flipNeeded:false` e quarta zona real ponta a ponta. Não aprovados ainda.
   VIP/caps/placement, política de upgrades comprados e streak/offline também têm decisões
   listadas no plano; não bloqueiam F2.
6. Teste red antes de cada correção; revisar diff semântico antes de regenerar vetores;
   gates + sim longo por grupo. Não retunar para mascarar falhas; não iniciar arte/C#/Unity.
7. Fazer commits coerentes/PR na branch atribuída. Não mergear sem autorização explícita;
   não mergear PRs #7/#8; revisar por tema antes de paridade econômica C#.

---

## Objetivo original pós-arte (histórico; atualização abaixo prevalece)

Começar a correção sistemática dos **nove achados de alta severidade** de
`docs/23-AUDITORIA_TECNICA.md`, com testes negativos que falhem antes da correção. Não iniciar
o projeto Unity nem portar regras defeituosas para C# antes de estabilizar a referência
TypeScript e revalidar a economia.

## Estado confirmado em 2026-09-26 (histórico)

### Visão executiva

O projeto é um **protótipo técnico sólido**, mas ainda não é um jogo Unity publicável.

Existe e está automatizado:

- fonte de verdade de dados, schemas e sincronização para `Assets/Data`;
- regras de referência TypeScript, economia, save, FTUE e vetores dourados;
- protótipo web jogável com FTUE completo;
- arte 2D aprovada e bundle WebP;
- áudio e materiais de loja para prototipagem;
- CI com 14 gates, incluindo compilação/paridade parcial do núcleo C# no GitHub.

Ainda não existe:

- projeto Unity completo (`Packages/`, `ProjectSettings/`, cenas, prefabs e `.meta` de importação);
- APK/AAB ou build assinado para dispositivo;
- integração real de Firebase, Crashlytics, Remote Config, UMP, AdMob e Play Billing;
- paridade C# de economia, save e turnos completos;
- correção dos nove defeitos altos da auditoria;
- localização completa fora de pt-BR.

### Arte — sequência encerrada

- As 33 substituições individuais do antigo lote 03 foram concluídas em 10 + 10 + 10 + 3
  imagens nos lotes 08–11.
- O dono aprovou o lote 11 e autorizou o merge completo em 2026-09-26.
- O fechamento foi enviado ao GitHub no **PR #13**; confirme o estado do merge e dos checks
  antes de continuar.
- Registro final: **245 entradas = 244 `approved`, 0 `pending`, 1 `superseded`**.
- Runtime aprovado: **244 sprites / 3,98 MB WebP**.
- Índice completo: **16 comidas, 7 fundos, 11 clientes, 12 variantes de churrasqueira e
  51 ícones**.
- Contra-filé e maminha têm cinco estados alinhados + prato servido; não dependem mais do
  fallback procedural.
- Revisões e prompts finais: `art/lote-08..11.json`, `art/prompts/lote-08..11.md` e
  `art/review/lote-08..11*`.
- O ciclo de substituição está fechado. Não iniciar lote 12 antes de corrigir o núcleo técnico.

### Dados, regras e protótipo

A validação reconhece:

- 22 tabelas de dados e 22 schemas;
- 16 ingredientes, 11 clientes e 7 restaurantes;
- 27 trilhas de upgrade;
- 58 conquistas;
- 37 itens de coleção em 10 categorias;
- 48 eventos de analytics;
- FTUE com 6 etapas;
- 60 níveis autorais.

O protótipo web possui splash, título, FTUE, grelha, virar/servir, pedidos, paciência, combos,
resultado, Home, calendário diário, abas de loja/missões/coleção/rota, arte aprovada com
fallback, áudio e persistência local.

O harness do FTUE registra:

- primeiro PERFEITO em 16,1 s;
- fim da parte jogável em 32,9 s;
- compra do upgrade em 38,3 s;
- zero erros de interação.

### Gates verificados no fechamento

- `npm run gates`: **13/14 locais**; somente `check-csharp` dá SKIP sem .NET SDK.
- Testes: **202/202**, 13 arquivos.
- TypeScript strict: sem erros.
- Dados e schemas: 22/22.
- Vetores: 98 + 44 FTUE sem drift.
- Arte: 16 ingredientes × 8 níveis + ícones = 144 draws.
- `check-shots`: 244 sprites decodificados; 13 PNGs; FTUE inalterado.
- `npm run sim:long`: 1.500 turnos, nível 80, spend ratio 0,741 e 18/18 guardrails
  codificados aprovados.

**Ressalva:** gates verdes confirmam consistência com o comportamento atual. Eles não provam
que os nove defeitos de design/regra abaixo estejam corretos; alguns testes congelam o
comportamento defeituoso atual.

### C# e Unity

O núcleo independente de Unity já contém tipos gerados, `GameData`, parte das regras de
cozimento/pontuação, analytics e tutorial. O CI compila em netstandard2.1/C# 9 com warnings
como erros.

Ainda faltam 17 vetores na paridade C#:

- 5 de economia;
- 12 de turnos completos.

Ainda faltam `TurnSimulation.cs`, `EconomyRules.cs`, `SaveSystem.cs`, a cola completa do
`TutorialTurn` e toda a camada visual Unity (`GrillView`, `FoodView`, `CustomerCardView`,
`TurnFlow`). Os serviços `AdService.cs`, `BillingService.cs` e `SecureConfig.cs` são stubs e
não foram compilados dentro de um projeto Unity real.

## Nove achados altos que devem ser resolvidos antes da porta C#

Fonte de evidência e scripts de reprodução: `docs/23-AUDITORIA_TECNICA.md`.

1. **A-01 — Costela/cupim:** dados dizem `flipNeeded:false`, mas o modelo de dois lados não
   permite atingir o ponto sem virar. O balanceamento avançado foi medido com esses cortes
   falhando.
2. **A-02 — Unlock de ingredientes:** `unlock.level` não filtra pedidos; cliente inicial pode
   pedir conteúdo de níveis futuros.
3. **A-03 — Vinagrete no protótipo:** é item de preparo, mas a interface só oferece fluxo de
   grelha, tornando pedidos impossíveis.
4. **A-04 — Zona 4:** restaurantes avançados declaram quatro zonas, mas o runtime cria no
   máximo três.
5. **A-05 — VIP:** `vipChance` não é consumido e o VIP tem peso zero; o conteúdo é prometido
   em dados, áudio, conquistas e loja, mas não aparece naturalmente.
6. **A-06 — Upgrades sem efeito:** 14 das 27 trilhas não têm consumidor funcional, embora o
   simulador gaste moedas nelas e use esse gasto no `coinSpendRatio`.
7. **A-07 — `restaurantsUnlocked`:** acumula `index + 1` em vez de representar a quantidade,
   antecipando recompensas/conquistas.
8. **A-08 — `burnedFood`:** um alimento queimado pode ser contado na grelha e novamente ao
   servir.
9. **A-09 — `TurnSimulation.result()`:** não é idempotente; cada chamada reaplica o bônus de
   fim de turno.

## Outros riscos que não podem sumir

- streak diário diverge entre documentação, sim e protótipo;
- ganhos offline do protótipo usam fórmula própria e aleatória;
- level-up do protótipo não paga todas as recompensas da regra;
- missões e conquistas não têm avaliador completo;
- ads e billing usam regras hardcoded/stubs;
- vários campos aceitos pelos schemas não têm consumidor;
- en-US e es-419 têm somente 54/514 chaves (10,5%) e passam por fallback;
- `npm audit` registra 5 vulnerabilidades no tooling: 1 crítica, 1 alta e 3 moderadas,
  principalmente na cadeia Vitest/Vite/esbuild; a correção exige atualização major e regressão;
- `docs/21-5S_TEST_20.md` relata teste n=20/closed track, mas o repositório não contém os
  brutos, gravações ou AAB necessários para reproduzir a evidência;
- os PRs antigos **#7 e #8** continuam abertos, grandes e com conflitos (`DIRTY`). Não fazer
  merge direto; revisar mudanças úteis seletivamente e depois fechar.

## Regras de execução da próxima sessão

1. Ler `docs/23-AUDITORIA_TECNICA.md` e reproduzir o achado antes de corrigir.
2. Criar teste que falha no comportamento antigo e passa na correção.
3. Corrigir a referência TypeScript e os dados; não portar para C# ainda.
4. Se a semântica mudar, regenerar vetores explicitamente e revisar o diff — nunca aceitar
   drift automático.
5. Rodar `npm run gates` e `npm run sim:long` após cada grupo de correções.
6. Recalcular economia depois de A-01, A-02, A-04 e A-06; os números atuais podem mudar.
7. Manter pt-BR como fonte completa e não introduzir texto literal nos dados.
8. Não inserir credenciais reais no repositório.
9. Não tratar arte aprovada como implementação das telas de metajogo.
10. Atualizar `docs/18-STATUS.md`, `docs/23-PLANO_IMPLEMENTACAO.md` e este prompt ao encerrar.

# SEQUÊNCIA HISTÓRICA COMPLETA — ESCOPO PRESERVADO, ORDEM ATUAL EM DOCS/23-PLANO §9

1. **Confirmar o merge e o CI**
   - atualizar `origin/main` e confirmar árvore limpa;
   - conferir o PR de fechamento da arte e os 14 gates no GitHub;
   - registrar qualquer diferença entre o ambiente local e CI.

2. **Implementar `check-art-registry`**
   - todo master em `Assets/Art` deve ter linha no registro;
   - toda linha deve apontar para arquivo existente;
   - manifesto e registro devem concordar em nome, arquivo e batch;
   - runtime versionado deve conter somente `approved`;
   - criar testes negativos que provem que o gate falha;
   - adicionar o gate a `npm run gates` e ao CI.

3. **Corrigir A-01 — costela e cupim**
   - decidir semanticamente entre `sides:1` e exigir virada;
   - alinhar dados, UI, política do bot e documentação;
   - adicionar teste de janela perfeita para ambos;
   - revalidar restaurantes avançados e economia.

4. **Corrigir A-02 — desbloqueio de ingredientes**
   - passar nível do jogador ao `TurnSimulation`/pool de pedidos;
   - filtrar por `unlock.restaurantIndex` e `unlock.level`;
   - preservar o roteiro determinístico do FTUE;
   - testar níveis limítrofes e campanhas existentes.

5. **Corrigir A-03 — vinagrete/preparo**
   - definir fluxo de prep no protótipo e na regra;
   - permitir produzir e servir sem grelha;
   - adicionar input/hitboxes e tutorial contextual, se necessário;
   - testar pedido misto, combo, paciência e resultado.

6. **Corrigir A-04 — quarta zona**
   - decidir se o design mantém quatro zonas;
   - se sim, adicionar contrato/dados e fazer runtime/UI respeitarem `zoneCount`;
   - atualizar mapeamento de calor, bot, arte e testes por churrasqueira;
   - se não, remover a promessa dos dados, l10n e docs.

7. **Corrigir A-05 — VIP**
   - consumir `vipChance`/configuração de eventos;
   - limitar aparições e ligar analytics/áudio/conquistas;
   - definir o placement `call_vip` sem pay-to-win;
   - testar chance zero, teto diário e spawn forçado.

8. **Corrigir A-06 — upgrades sem efeito**
   - mapear as 27 trilhas para consumidores reais;
   - implementar as 14 faltantes ou ocultá-las com flag explícita;
   - impedir que o simulador compre no-ops;
   - recalcular `coinSpendRatio`, pacing e custos.

9. **Corrigir A-07, A-08 e A-09**
   - `restaurantsUnlocked` deve representar quantidade correta;
   - `burnedFood` deve contar uma vez por alimento;
   - `result()` deve memoizar/ser idempotente;
   - criar regressões unitárias e atualizar vetores afetados.

10. **Regenerar contratos e revalidar a economia**
    - `npm run gen-vectors` somente após revisar mudanças semânticas;
    - `npm run gen-levels` e conferir diff;
    - `npm run gates`;
    - `npm run sim:long`;
    - atualizar números publicados em `docs/06`, `docs/18` e auditoria.

11. **Atualizar dependências de desenvolvimento**
    - planejar upgrade major de Vitest/Vite/esbuild em commit/PR isolado na branch atribuída à sessão;
    - registrar `npm audit` antes/depois;
    - rodar toda a suíte, render e screenshots;
    - não usar `npm audit fix --force` sem revisar breaking changes.

12. **Concluir a paridade C#**
    - portar `TurnSimulation.cs` e fazer os 12 vetores de turno passarem;
    - portar `EconomyRules.cs` e fazer os 5 vetores econômicos passarem;
    - portar `SaveSystem.cs` v3 e migrações;
    - concluir `TutorialTurn`;
    - exigir 0 vetores “not ported” no `check-csharp`.

13. **Criar o projeto Unity V0.2**
    - gerar `Packages/` e `ProjectSettings/` no Unity 6 LTS;
    - criar assemblies, cenas, prefabs e `.meta`;
    - implementar `AssetPostprocessor` para `sprites.manifest.json` e atlases;
    - criar `GrillView`, `FoodView`, `CustomerCardView` e `TurnFlow`;
    - integrar input, UI, áudio, save e localização;
    - obter turno completo no Editor e 60 FPS em dispositivo Android médio.

14. **Revisar PRs #7 e #8**
    - comparar cada um com `main` por tema;
    - extrair seletivamente apenas mudanças ainda úteis e testáveis;
    - não resolver conflitos por merge cego;
    - fechar os PRs antigos após registrar o que foi aproveitado/descartado.

15. **Completar localização e acessibilidade**
    - traduzir en-US e es-419 além dos 10,5% atuais;
    - implementar resolver/localização no Unity;
    - validar tamanho de texto, contraste, leitura do ponto sem depender só de cor e redução de movimento.

16. **Integrar serviços e monetização somente depois do core Unity**
    - Firebase Analytics, Crashlytics e Remote Config;
    - UMP/consentimento e Data Safety/LGPD;
    - AdMob com unidades de teste e caps vindos de dados;
    - Play Billing com produtos de teste e validação de recibo;
    - nenhuma credencial real no Git.

17. **Fechar áudio, performance e QA em dispositivo**
    - mixagem final e política de ducking;
    - perfis de memória, GC, draw calls, atlas e tamanho do AAB;
    - matriz de dispositivos físicos, interrupções, offline, save e migração;
    - 60 FPS no device-alvo e crash-free medido.

18. **Preparar publicação**
    - gerar APK/AAB assinado por pipeline seguro;
    - closed testing reproduzível com evidências brutas;
    - revisar política de privacidade, consentimento e Data Safety;
    - validar screenshots reais do jogo, ASO e listagem;
    - executar rollout gradual somente após critérios V0.6–V0.9 do roadmap.
