# 25 — Auditoria de status, entrega e branches

> **Atualização de integração — 2026-09-27:** o usuário autorizou resolver os conflitos
> e integrar todo o histórico. PRs #7/#8 foram reconciliadas por merge real na branch
> de consolidação; as decisões e evidências estão em [26 — Merge das PRs #7/#8](26-MERGE_PR7_PR8.md).
> 756 testes e 18/18 metas longas passaram localmente. A decisão anterior de manter
> essas PRs conflitantes está superada; os bloqueios Android/paridade da auditoria continuam abertos.


**Data:** 2026-09-27 UTC
**Base auditada:** `origin/main` em `bf478348f2490263f2feab4a6bd902e57bf2cae6` (PR #17 integrada).
**Branch de trabalho:** `arena/01a0e494-game-churrasqueiro`.

## 1. Conclusão executiva

**O protótipo web e a referência TypeScript estão bem cobertos pelos testes executados. O produto Android não está pronto para publicação. Existem duas PRs conflitantes e trabalho exclusivo fora da main.**

Não é possível declarar “tudo mergeado e entregue”. Não foi feito merge das PRs #7/#8, nem exclusão de branches: a condição de segurança solicitada para a limpeza total ainda não foi satisfeita. A auditoria não alterou gameplay, economia, arte, vetores ou gates.

As declarações anteriores de “F1–F13 concluídas”, “100% de paridade”, “serviços de produção integrados” e “pronto para Closed Testing” **não são sustentadas pelo código e pelas evidências atuais**. Existência de scripts/configurações e testes estáticos não comprova integração Unity, homologação em dispositivo ou publicação.

Escopo: histórico Git completo, branches remotas, PRs, checks do GitHub, execução dos gates disponíveis, simulação longa e inspeção estática de integração/release. **Unity e .NET não estão instalados neste ambiente**; não foram executados Editor, build Android, SDKs reais, Play Console ou testes de dispositivo. A evidência C# vem do check remoto da mesma revisão auditada. Este relatório não pretende certificar ausência de outros defeitos.

## 2. Branches e decisão de merge/limpeza

Foi necessário completar o clone inicialmente raso com `git fetch --unshallow origin`; as conclusões abaixo usam o histórico completo, não contagens de um clone incompleto.

| Branch remota | Ponta auditada | Commits exclusivos em relação à main | Situação / decisão |
|---|---|---:|---|
| `arena/01a0daed-game-churrasqueiro` | `1874270` | 26 | PR [#7](https://github.com/berger33/game_churrasqueiro/pull/7) aberta, `CONFLICTING` / `DIRTY`; preservar |
| `arena/01a0de76-game-churrasqueiro` | `021cc2f` | 29 | PR [#8](https://github.com/berger33/game_churrasqueiro/pull/8) aberta, `CONFLICTING` / `DIRTY`; preservar |
| `arena/01a0e19d-game-churrasqueiro` | `9b54be6` | 0 | PR #16 integrada; ancestral da main; tecnicamente elegível para exclusão após rechecagem |
| `arena/01a0e1a4-game-churrasqueiro` | `bf47834` | 0 | PR #17 integrada; ponta idêntica à main; tecnicamente elegível para exclusão após rechecagem |

- A ponta da PR #7 é ancestral da ponta da PR #8. A #8 contém o histórico da #7 mais três commits; reconciliar as duas independentemente duplicaria esforço.
- `git merge-tree --write-tree`, sem modificar a working tree, retornou **137 registros de conflito para #7 e 142 para #8**. Há conflitos em binários de arte, registro/manifesto, dados, regras de cozinha/economia/save, protótipo, C# e vetores.
- `git cherry origin/main origin/arena/01a0de76-game-churrasqueiro` marcou os 29 commits com `+`: não há equivalência integral de patches detectada. Isso **não** significa que todas as funcionalidades são inéditas; parte foi refeita/substituída em outras PRs. Também não permite descartar o conjunto como já entregue.
- Não usar merge `ours`, escolha global de `theirs`, nem fechamento como “mergeado” para apenas limpar a lista: isso poderia descartar trabalho ou regredir a arte aprovada e a economia atual.
- Não há outras PRs abertas além de #7/#8 na consulta desta auditoria. Não havia issues abertas nem GitHub Releases listadas. Ausência de Release não prova ausência de distribuição externa.
- `main` e a branch desta sessão devem ser preservadas. A branch local `main` não foi modificada.

### Como concluir a integração sem perder trabalho

1. Inventariar o delta da #8 contra o ancestral comum: separar progressão de 10 churrasqueiras, carvão/UX, ferramentas de arte, regras C# e materiais de arte substituídos.
2. Classificar cada mudança como já entregue, substituída com justificativa, descartada por decisão explícita de produto ou ainda necessária. Os contratos atuais não devem mudar implicitamente para resolver conflitos.
3. Transportar somente as mudanças ainda necessárias para a branch de trabalho vigente. Resolver código e dados juntos; preservar arte aprovada, testes e vetores de referência.
4. Rodar gates, simulação longa, paridade sem supressão de falhas e revisão visual. Abrir PR da branch vigente; só integrar com checks e revisão satisfatórios.
5. Encerrar #7/#8 com referência à reconciliação (sem fingir que houve merge integral se houve substituição seletiva).
6. Atualizar os refs, verificar novamente ausência de trabalho exclusivo não contabilizado e só então excluir branches antigas. As duas já integradas podem ser removidas sem perda de código na revisão auditada, mas **nenhuma foi excluída nesta rodada**, em respeito à condição de limpeza após entrega completa.

Evidência: [branches.txt](evidence/2026-09-27-status/branches.txt).

## 3. O que foi realmente verificado

| Verificação | Resultado | Limite da evidência |
|---|---|---|
| `npm ci` | Instalação concluída; auditoria npm informou 0 vulnerabilidades | Não é auditoria de segurança da aplicação |
| `npm run gates` | **14/15 executados e aprovados** | `check-csharp` omitido por ausência de .NET local |
| Vitest, dentro dos gates | **740 testes / 36 arquivos aprovados** | Parte dos testes Unity apenas verifica texto/existência de arquivos |
| `npm run sim:long` | **18/18 metas**, horizonte de 1.500 turnos | Simulação TypeScript, não execução Android |
| Arte | **244 sprites aprovados**, cobertura e capturas do protótipo aprovadas | Não comprova importação/renderização Unity |
| Localização | 381 chaves referenciadas cobertas; en-US/es-419 em **495/613 = 80,8%** | Restam 118 chaves por idioma para cobertura global; loader Unity tem problemas adicionais |
| CI da main | `success`, run [36348469817](https://github.com/berger33/game_churrasqueiro/actions/runs/36348469817) | Compila o core engine-free, não Runtime/Services/Editor Unity |
| Anotação C# desse CI | **203 checks concordam; 13 vetores aguardam port**; `golden.turns`: 37 ok / 13 not ported | Não é paridade completa; há supressão de divergências no runner |

Logs: [gates.log](evidence/2026-09-27-status/gates.log), [sim-long.log](evidence/2026-09-27-status/sim-long.log), [ci-parity.json](evidence/2026-09-27-status/ci-parity.json).

## 4. Bloqueios encontrados no código

### P0-01 — Paridade C# pode ficar verde ocultando divergências

Em `tools/csharp/parity/Program.cs`, `Golden()` executa `ReplayTurn` numa `Section("temp")`. Se não há passes, registra `NotPorted`, em vez de propagar as falhas. A seção temporária não integra o relatório final. `Report.Finish()` só retorna erro para `Failures`, não para `NotPorted`.

**Impacto:** regressões de turno podem deixar CI verde. O CI remoto confirma 13 vetores nessa situação, contrariando “zero pendentes”. 203 checks não são 203 vetores únicos: incluem bind/data e outras verificações.

**Para concluir:** restaurar falha real para divergências, identificar e corrigir os 13 casos, manter epsilon/expectativas sem relaxamento oportunista e acrescentar teste negativo provando que uma divergência faz o processo sair com erro.

### P0-02 — Runtime Unity não corresponde à API do core

`Assets/Scripts/Runtime/TurnFlowController.cs` usa `TurnState`, `CustomerState`, `StaffState` e `ChurrasqueiraDef`, ausentes nas definições do core; `GrillView.cs` usa `ActiveFood`. O construtor usado é `new TurnSimulation(config, churrasqueira, staff)`, mas o core define `TurnSimulation(GameData db, TurnConfig config, double? seed = null)`.

O runtime chama `simulation.State`, `PlaceFood`, `FlipFood`, `ServeCustomer` e `GetResult`; o core expõe `Foods`/`Customers`/`Grill`, `Place`, `Flip`, `Serve` e `Result`. Também usa `CoinsEarned`/`XpEarned`/`PerfectCount` onde `TurnResult` tem `Coins`/`Xp` e `Counters`.

`SaveManager.cs` chama `SaveSystem.SerializeEnvelope` e `VerifyEnvelope`, inexistentes nesse core. `BuildPipeline.cs` usa `NamedBuildTarget` sem importar `UnityEditor.Build` nem qualificá-lo.

**Para concluir:** alinhar APIs e adaptadores, compilar todas as assemblies no Unity fixado, adicionar build/testes Unity ao CI e jogar um turno completo. A constatação atual é de incompatibilidade estática; não foi produzido log do compilador Unity nesta sessão.

### P0-03 — Cena e bootstrap não entregam o jogo

`Assets/Scenes/Main.unity` referencia `TurnFlowController` pelo GUID `c0000000000000000000000000000001` e `AudioController` por `c0000000000000000000000000000002`; seus `.meta` reais têm, respectivamente, `9454688b4e6e71359b852232917ab863` e `c340ebbb9caa9a2988b06b5554e288c7`.

O Canvas tem `m_Children: []`. Não há ligações serializadas dos campos de HUD/grelha/prefabs nesses controladores da cena. A existência do nome `TurnFlowController` no YAML é suficiente para o teste F9 passar, mas não para iniciar o jogo.

**Para concluir:** reconstruir/verificar GUIDs e prefabs no Editor, bootstrap de dados/save, tela inicial, HUD, input e fluxo lobby → tutorial → turno → resultado → lobby. Validar que não existem Missing Scripts/referências nulas e que a arte aprovada é usada.

### P0-04 — Compras/anúncios/consentimento ainda são simulados

- `BillingService.Purchase` fabrica um token `GPA.*`; `PerformLocalSignatureCheck` só verifica token não vazio e produto no catálogo. Não valida uma assinatura RSA nem uma compra real. A fila e o cofre de tokens são estruturas locais em memória.
- `AdService.RequestConsentAsync` atribui `ConsentStatus.Obtained` a partir de `cfg.LgpdNoticeBR`, sem resposta do usuário a um fluxo UMP real.
- `FirebaseService.InitializeAsync` contém a chamada SDK apenas em comentário; `RemoteConfigService.FetchAsync` marca sucesso usando defaults, sem fetch real.
- `Packages/manifest.json` não declara integrações desses SDKs e os adaptadores inspecionados não os chamam.

**Para concluir:** separar explicitamente mocks de produção, instalar SDKs compatíveis, consentimento real e revogável, billing/restauração/acknowledgement e verificação de recibos, idempotência e pendências persistentes, callbacks rewarded reais, Firebase DebugView/Crashlytics e fetch/falha/timeout de Remote Config. Ligar e testar kill-switches nos consumidores. Não habilitar monetização de produção nesse estado.

### P0-05 — Save/autosave e recompensas não estão integrados

`LifecycleManager.TriggerAutosave` registra mensagem e horário em PlayerPrefs, mas **não chama `saveManager.Save`**. O campo de save no `TurnFlowController` não persiste o resultado. O `SaveManager` ainda depende dos métodos inexistentes citados acima; sua escrita atual é `File.WriteAllText` diretamente no arquivo primário, não substituição atômica.

**Para concluir:** serialização/checksum/migração compatíveis, escrita temporária + troca atômica e backup válido, aplicação única de resultados/recompensas, save de meta e ledger offline. Testar suspensão, encerramento forçado, armazenamento cheio, corrupção, rollback do relógio e reabertura sem duplicar/perder moedas.

### P1-01 — Localização Android não está empacotada nem carregada corretamente

`LocalizationManager.cs` espera `StreamingAssets/l10n/<locale>.json` e um objeto com lista `strings[{key,value}]`. Os arquivos reais em `shared/l10n` são mapas chave → texto; não há pasta `Assets/StreamingAssets/l10n` versionada. `File.Exists`/`File.ReadAllText` também não resolvem genericamente o acesso a StreamingAssets dentro do APK Android.

**Para concluir:** definir um contrato único de JSON, empacotar arquivos, carregar com mecanismo Android compatível, implementar fallback por chave, completar as 118 traduções faltantes por idioma se a entrega exigir cobertura global e eliminar textos literais do runtime. Validar formatação, tamanho de fonte, contraste, alvos de toque e redução de movimento no aparelho.

### P1-02 — Build/release não impõe o que a documentação promete

Em `Assets/Scripts/Editor/BuildPipeline.cs`:

- Ausência de keystore permite fallback de desenvolvimento; configuração de anúncios de teste só emite warning.
- Excesso do AAB de 90 MB só gera warning; não há verificação efetiva dos limites de texturas/código anunciados.
- Falha de build é registrada em log, mas o método não impõe explicitamente falha do processo batch por exceção/exit code.
- Saída real: `build/churrasco.aab` ou `.apk`; o checklist apresenta outro caminho.
- Variáveis lidas: `CHURRASCO_KEYSTORE_PATH`, `CHURRASCO_KEYSTORE_ALIAS`, `CHURRASCO_KEYSTORE_PASSWORD`, `CHURRASCO_KEY_PASSWORD`; o checklist/handoff usa outros nomes para alias/senhas.

**Para concluir:** contrato único de configuração, separação debug/release, release que falhe por configuração inválida, código de saída confiável, análise do artefato/base instalada, budgets verificáveis, artefato assinado com hash e log reproduzível. Não colocar chaves/senhas no Git ou chat.

### P1-03 — QA de dispositivo e publicação não têm evidência suficiente

Os testes F9 verificam, entre outros pontos, existência de arquivos, nomes e balanceamento de chaves C#. Isso não compila a cena. Scripts de áudio/performance e 740 testes não substituem profiling e validação física.

**Para concluir:** matriz de aparelhos, estabilidade térmica/FPS/GC/memória/draw calls, safe areas, input, áudio/mixagem/ducking, lifecycle/offline, atualização/migração e acessibilidade. Arquivar relatórios, screenshots/vídeos e artefatos reais. Revalidar requisitos atuais de Play Console, Billing/target API, testes fechados aplicáveis à conta, classificação e Data Safety. O número de testadores e os prazos escritos nos docs não foram verificados contra política externa nesta auditoria. Revisar privacidade conforme coleta real dos SDKs; “sem PII” não dispensa declarar identificadores/diagnósticos e demais dados aplicáveis.

## 5. Plano de conclusão, em ordem

| Ordem | Entrega | Critério de aceite |
|---|---|---|
| 1 | Recuperar confiança no gate C# (P0-01) | Divergência falha o CI; todos os vetores exigidos realmente comparados e aprovados |
| 2 | Corrigir API/runtime/build Unity (P0-02) | Todas as assemblies compilam no Unity; pipeline Unity obrigatório no CI |
| 3 | Entregar vertical slice real (P0-03) | Arte, input, FTUE, turno e resultado jogáveis no Editor e APK |
| 4 | Persistência e meta loop (P0-05) | Save/restore atômicos; saldo, upgrades, coleção, missões, conquistas, passe/rota, diário e offline sem perda/duplicidade |
| 5 | Concluir UI/conteúdo/acessibilidade/localização | Navegação, 7 restaurantes, funcionários, eventos e sistemas planejados ligados ao runtime; tradução/UX aprovadas |
| 6 | Serviços reais em sandbox (P0-04) | Compra/restauração, anúncios, consentimento, analytics e configuração remota comprovados; mocks inacessíveis em release |
| 7 | Reconciliação #8/#7 | Inventário de deltas e decisões; PR revisada, testes funcionais/paridade/visuais verdes; sem regressão das artes/regras atuais |
| 8 | Build/QA/release (P1-02/03) | APK/AAB assinados, budgets impostos, dispositivo homologado, formulários e políticas revisados |
| 9 | Teste fechado e rollout | Evidência de testes, métricas reais, critérios de parada e rollback exercitados |
| 10 | Limpeza final de branches | Nova consulta de refs/PRs; todo trabalho preservado/entregue ou descarte explícito; remover só antigas, manter main e sessão ativa |

Os itens de meta/conteúdo acima são critérios de integração/aceite, não uma afirmação de que seus dados ou toda sua lógica precisem ser escritos novamente. Reaproveitar a referência TypeScript, o core e a arte existentes. O backlog histórico `docs/17-BACKLOG.md` e as fases F8–F13 devem ser reavaliados por evidência, sem tratar texto de handoff como certificado de conclusão.

## 6. Operações desta auditoria

- Fetch/prune dos refs e recuperação do histórico completo; nenhuma troca de branch.
- Consulta de PRs, runs, annotations, issues e releases via `gh`.
- Simulação de merge com `git merge-tree` (nenhum merge aplicado).
- Instalação de dependências e execução de gates/simulação longa; arquivos gerados do protótipo permanecem ignorados.
- Relatório e evidências adicionados; avisos nos documentos de entrada para corrigir a interpretação do status.
- **Nenhum push, merge de PR, fechamento de PR, publicação Android ou exclusão de branch realizado.** As alterações documentais estão na branch desta sessão, não na main.
