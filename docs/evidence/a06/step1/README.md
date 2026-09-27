# A-06.1 — compras compartilhadas e efeitos diretos

**Concluído funcionalmente e validado localmente em 2026-09-27.**
A-06 completo/F3/F4 e aceite econômico **continuam abertos**. Próximo: **A-06.2, recursos**.
Branch `arena/01a0e099-game-churrasqueiro`; HEAD/origin/main confirmados em
`e50ce1523fa3d04119dc454e3edb050070641c10`. A-03/A-04/A-05 locais preservados.
Sem commit, push, PR, merge, nova arte, SDK ou porta C#.

Contrato aprovado: [design-proposal.md](../design-proposal.md).
Escolhas do dono: [decisions.md](../decisions.md). Não perguntar novamente nem interpretar
este checkpoint como aprovação para retunar preços/metas ou entregar os extras de Gerente.

## Entregue

- `upgrades.ts`: registro de integração e cotação única de preço, níveis efetivos e motivos
  de bloqueio. UI, `buyUpgrade`, `canAfford` e bot consultam a mesma regra; compra revalida
  antes de debitar e contabiliza o gasto. Custos/deltas/limites das tabelas não mudaram.
- **16 trilhas integradas**, **11 temporariamente incompráveis**. Registro explícito para
  todas27; desconhecidas não são liberadas por fallback. `feature_pending` não é solução
  final: as subetapas seguintes precisam implementar os consumidores e liberar cada grupo.
- Gates de receita para Faca/Tábua/Auxiliar; funcionário lê unlock de `employees.json`;
  Bandeja depende de Garçom1; Logística requer offline no índice3. Funcionários, Bandeja e
  offline continuam bloqueados também por integração, mesmo após cumprir esses gates.
- **Níveis históricos preservados**, sem reembolso/reset. Inteiros limitados para cálculo;
  nível inválido bloqueia compra sem reescrever história. Compra válida atualiza apenas
  nível/carteira/contadores esperados. Saldo insuficiente, max e bloqueio não debitam.
- **Catálogo27 na aba Loja**, paginado, textos por chaves pt/en/es, preços/moeda reais,
  efeito do próximo nível e bloqueio visíveis; pendentes não exibem habilidade como ativa.
  Substitui os teasers de ofertas, não implementa IAP. Atalhos da Home/FTUE usam o serviço.
- **Capacidade/Mesas:** `(base autoral ?? base restaurante) + capacity + tables`;
  a base física de mesas não é somada novamente. Admissão automática e VIP usam esse limite.
  Fila grande usa páginas estáveis de3, controles48px, contagem/urgência e alvos congelados
  durante drag. Pedidos fora da página não têm hitbox; default até6 mantém layout anterior.
- **Mestria:** +.012/nível sobre a parcela de gorjeta; **Clientela:** +.01/nível aditivo à
  paciência. Ambos atingem resultado de serviço/espera, não só `deriveStats`.
- Limites de funcionários normalizados mesmo antes de ativar sua automação. Gerente de
  referência também fica limitado; **popup offline ainda é dívida A-06.4**, não novo sistema.

### Nota importante de pontuação

O antigo campo `tipMult` de Pratos/Decoração multiplica o pagamento inteiro de pratos bons/
perfeitos. Não redesenhamos esses dois efeitos nem fingimos que já atuavam apenas na gorjeta;
seus textos agora descrevem o pagamento. Mestria segue a restrição aprovada de **não aumentar
a parcela-base**. `prestigeTipBonus` separa seu componente no score:

`fator = (1 + gorjetaNormal) × multiplicadorLegado + gorjetaNormal × bônusMestria`.

O bônus continua aditivo na derivação, mas é separado antes de aplicar o valor-base. XP,
raw/burned e conquistas não recebem esse bônus. Teste numérico impede aplicação sobre receita
inteira. O vinagrete barato pode arredondar para o mesmo inteiro: a prova marginal usa
picanha realmente cozida/virada/servida, sem modificar preços para fazer o teste passar.

## Mapa vigente das 27

| Integração | Trilhas | Prova / localização |
|---|---|---|
| Existentes, preservadas | grill_size, grill_heat, grill_speed, charcoal_duration, knife, board, plates, patience_charm, decor, lighting, sign, music | Cooking/turn + regressões existentes; compra compartilhada; Faca/Tábua com gate e UI11/12 |
| Diretas corrigidas | capacity, tables | Fila real com override; default máximo17; golden pareado; UI14 pedidos e serviço na página2 |
| Diretas conectadas | brasa_mastery, clientela_fiel | Serviço/paciência reais, fórmula/clamps; goldens e compras na campanha |
| A-06.2, bloqueadas | grill_stability, charcoal_quality, charcoal_auto, counter | Recursos aprovados, ainda sem consumidor integrado |
| A-06.3, bloqueadas | garcom, auxiliar, churrasqueiro, tray | Equipe/cadência/caps/Bandeja aprovados, ainda não implementados |
| A-06.4, bloqueadas | caixa, gerente, imperio_logistica | Offline aprovado; Gerente apenas em cálculo de referência, não ponta a ponta |

Em nível1/restaurante0/saldo suficiente: **14/27** compráveis; Faca/Tábua ainda sem receita.
No perfil elegível avançado:16/27. Nenhuma das11 pendentes aparece nos gastos do bot.
Níveis já comprados continuam no save e na UI. A-06.5 só encerra quando não restar integração
pendente entre as27, depois de provas por consumidor e revalidação econômica.

## Regressões e validação

- `red-rules.log`: **29 falhas /2 controles** antes da correção. Bloqueio inexistente,
  gate prep, níveis inválidos, override e efeitos diretos reproduzidos.
- `red-ui.log`: bundle real anterior falha por ausência de catálogo27.
- `red-prestige-consumer.log`: reforço com picanha; reintrodução isolada/counterfactual da
  omissão antiga produz3 falhas. Código restaurado imediatamente. Não é log do bundle inteiro antigo.
- `green-gates.log`: **533 testes/24 arquivos**, **14/15 gates locais**, C# **SKIP** sem dotnet.
  São78 testes novos (76 de regra/integração +2 de geometria), além do harness de ponteiro.
- FTUE: **16,1s primeiro perfeito /32,9s conclusão /38,3s compra**, zero misses,136 moedas.
  Prep A-03, quarta zona A-04 e VIP A-05 continuam no gate e no fluxo de capturas.
- **42 capturas**; novas38–42 em `prototype/shots/` (ignoradas, regeneráveis). Inspeção visual
  confirmou catálogo/estado pendente, paginação/serviço, Faca/Tábua bloqueadas no11 e compra
  no12. Texto/moeda e aparência desabilitada foram corrigidos após a primeira inspeção.
- Ponteiro real também percorre27, compra, recarrega, rejeita pendente e max sem débito,
  acessa14 clientes, serve página2 e mantém alvos durante chegada de novos clientes no drag.

### Vetores e save

`vector-check-before.log` confirmou114+44 intactos após as regras: os casos antigos não
compravam essas trilhas. Acrescentamos explicitamente **7 turnos**, sem aceitar drift antigo.
`vector-generation.log` / `vector-review.json`: **121+44** (35 turnos), todos os28 turnos
anteriores e86 primitivas intactos; arquivo FTUE **byte-idêntico ao baseline A-05**.
Novos inputs incluem `upgradeLevels`, e o replay TS os consome. Controle3849 moedas;
Capacidade2=4601, Mesas1=4624, combinação=5772, Mestria20=4111, Clientela20=3875.
Isto é um probe de seed/config, não promessa universal de aumento de renda.

Save core permanece **v4/CRC**: nenhuma migração nova necessária para esses níveis. Teste
roundtrip preserva todas27, carteira, counters válidos e claims VIP. Browser mantém a chave
raw `churrasco_meta_v2`, com `purchaseCounters` opcional para compras futuras (ausência vira
contador vazio, **não recibo histórico reconstituído**). Continua sem CRC/autoridade de servidor.
O restaurante do catálogo é o do nível autoral atual; não foi entregue persistência geral da
rota/metaprogressão de F10. Provas avançadas de UI usam fixtures declaradas.

Sem execução/porta C#. Com35 turnos e5 casos econômicos, há40 casos dessa lista ainda sem
portagem, além das regras atuais/savev4. Não declarar paridade plena por haver golden TS.

## Economia1500 — falhas mantidas visíveis

Mesma seed20260917, dt1/12,12 turnos/dia, VIP natural sem rewarded, sem renda offline.
`green-long.log` e repetição: **15/18, exit1**; `long-repeat.diff` vazio.
`economy-comparison.json` compara o baseline A-05 gravado com a campanha nova e confere
cada sink contra níveis comprados/preços da tabela. Ambos terminam nível80/rest6/Fornalha3.

| Métrica | A-05 natural | A-06.1 |
|---|---:|---:|
| Renda |22.302.178|24.859.245|
| Gasto |10.873.220|8.057.440|
| Saldo |11.428.958|16.801.805|
| Gasto/renda |0,488|**0,324**|
| Unlocks restaurantes |42/97/165/262/406/881|40/91/158/251/395/**664**|
| Unlocks grills |10/45/93|10/41/79|
| Renda diária L5/L15/L30/L50 |10.480/39.837/108.549/191.586|10.254/42.146/109.396/**208.316**|
| Perfect / burned / perdidos |75,7% /0,2% /3,5%|75,6% /0,1% /3,3%|
| Duração média |172,5s|175,0s|
| VIP chegados/servidos |244/232|244/231|

Falham **Rede664** (alvo950–1450), **rendaL50=208.316** (98.000–152.000),
**spend0,324** (0,70–0,99). Sem alteração de metas, preços, recompensas ou política para verde.
O curto passa seus checks, mas checks fora do horizonte continuam skip/PASS histórico (F5).

Capacidade máxima de gasto das27 na tabela:6.358.620 moedas;16 integradas=3.542.840;
11 bloqueadas=**2.815.780**. Nesta campanha as16 atingem máximo, e a queda de gasto é
exatamente2.815.780. Não são reembolsos nem perdas históricas. A alta de renda2.557.067
mistura efeitos de fila/paciência/gorjeta e progressão mais cedo, não causalidade de uma trilha.
Não inventar renda offline ou ressuscitar compras fictícias para melhorar o ratio.

`after-audit.json` mantém o cohort histórico13 para comparação; só Mestria/Clientela mudam
seus traces nesse probe. Mesas não saturava a fila daquelas configs: seu consumidor é provado
pelos testes/goldens com pressão de chegada. Igualdade de um trace sozinha não prova no-op.

## Reproduzir / continuar

```sh
npx vitest run tools/studio/test/upgrades.test.ts tools/studio/test/upgrade-ui.test.ts
npm run gates
npm run sim:long                 # exit1 esperado; investigar qualquer drift
node --experimental-strip-types tools/studio/upgrade-step1-report.ts
node --experimental-strip-types tools/studio/upgrade-audit.ts
```

Não sobrescrever `../before-audit.json` com o runtime corrigido. Vetores só regenerar com
revisão explícita quando a próxima semântica exigir.

**A-06.2:** escrever red para estabilidade/qualidade/auto-carvão e estoque/Balcão conforme
contrato já aprovado; implementar APIs comuns, UI e bot, liberar só depois dos consumidores
reais. Depois A-06.3, A-06.4, A-06.5 e F4. Manter histórico, FTUE e evidência das etapas anteriores.
