# F3 / A-04 — quarta zona funcional validada

Branch `arena/01a0e099-game-churrasqueiro`. Base Git e50ce15 + checkpoint A-03 local
preservado; `git fetch origin` confirmou main sem avanço. PR14 já integrado; PR7/8 preservados.
Baseline369 testes,14/15 gates locais (C# SKIP), longo15/18, três falhas conhecidas.

## Decisões explícitas do dono nesta continuação

1. **Implementar quatro zonas**, em vez de remover a promessa.
2. **Exigir a Fornalha**: no Premium (índice4) e posteriores, a Fornalha ganha a quarta
   zona em todas as evoluções. As outras churrasqueiras mantêm1/2/3; antes do Premium
   a Fornalha também permanece3. O perfil de restaurante sem equipamento tem4.
3. **Média extra1,00×**, com escala/teto atuais no equipamento. Não elevar a máxima,
   não alterar o calor das três zonas originais, nem o FTUE/início da progressão.

A segunda escolha rejeitou a sugestão inicial de ampliar qualquer equipamento.
Não transformar o requisito conjunto (Premium E Fornalha) num unlock universal.

## Resultado — funcional validado localmente

**411 testes/21 arquivos** (369→411,42 novos), **14/15 gates locais**, C# SKIP sem .NET;
**29 PNGs/244 sprites**. FTUE16,1s/32,9s/38,3s,0 misses. Sem push/PR/merge/CI remoto
novo. CI verde do PR14 citado no checkpoint anterior é somente da base.

### Contratos/dados

- `grill` v3→4: `medium_extra`, índice3, calor1, `auxiliaryOf:medium`. As zonas originais
  permanecem0,55/1/1,55 e os IDs/índices0/1/2. Auxiliar não entra na interpolação do perfil
  1/2/3, e recebe o mesmo bônus de upgrade da média (não o bônus de alta por ser última).
- `churrasqueiras` v1→2: somente Fornalha recebe `restaurantExpansion:{restaurantIndex:4,
  zoneCount:4}`. Nível do jogador sozinho não substitui o restaurante; evoluções1/2/3
  ganham a mesma expansão, mantendo slots, heatBase, preços e carvão anteriores.
- O número resolvido chega a stats, criação, patch de calor, bot, UI e relatório. `createGrill`
  rejeita contagens inválidas em vez de ocultá-las por clamp. Construtor genérico1/2/3/4
  usa o mesmo mapeamento; no caso sintético de duas zonas sem equipamento, agora usa
  baixa/alta, não baixa/média. Restaurantes autorais só usam3/4; equipado1/2 já usava esse
  perfil e seus calores foram preservados.
- Calor da Fornalha evo3: **0,891 /1,62 /1,70 /1,62**, antes de carvão/upgrades.
  Teto1,7 continua sendo do **perfil base equipado**, não clamp dos bônus de upgrade.
- Validador rejeita promessa acima da tabela, IDs/índices inválidos, expansão inconsistente,
  fonte auxiliar inexistente/calor divergente e remoção da marca auxiliar. Fixtures negativas
  usam clones isolados: `loadDatabase()` é cacheado, não usar retorno direto para mutações.
- Sincronizados2 schemas,2 tabelas Assets/Data+manifest e2 DTOs C# **gerados**. Nenhuma regra
  C# portada. O consumidor C# de expansão/auxiliar ainda pertence a F8, mesmo que os antigos
  vetores parciais passem em CI; não declarar paridade nova. Tipos gerados não são port.
- `gen-levels` sem diff; não mudaram receitas, preços, recompensas, metas, arte ou save.

### UI, arte e fluxo real

Home calcula a expansão para o restaurante selecionado, gameplay lê o snapshot da simulação.
HUD mostra4F, rótulos vêm da identidade/localização (`MÉDIA EXTRA`), brasas usam calor efetivo.
O sprite aprovado da Fornalha e seu quadrilátero continuam os mesmos; renderer compõe quatro
faixas dentro da boca, sem lote de arte. Código de desenho, drop e posição de comida já
aceitava contagem dinâmica; o harness agora verifica a quarta faixa e vizinhos de verdade.

`check-shots` cobre restaurante3→4→5/6, Fornalha nas3 evoluções, outras churrasqueiras
permanecendo1/2/3. Home/HUD/runtime concordam. Dois itens de um pedido natural são colocados,
movidos entre terceira/quarta, virados e servidos por **ponteiro real**, sem mutação de estado
via hooks. Capturas25–29 ficam em `prototype/shots/` (ignoradas/regeneráveis), inspecionadas.
São fixtures de restaurante/save/equipamento, não prova de campanha Unity avançada.

### Red → green

- `reproduction.log`: default/Fornalha não atingiam4 no Premium; demais equipamentos1/2/3.
- `red-rules.log`:16/29 regressões iniciais falham no código anterior;13 garantias de
  regiões/equipamentos não afetados já passavam. Capacidade, calor, virada/serviço, bot com
  três zonas cheias e janelas de costela/cupim em todas as4 zonas agora passam.
- `red-ui.log`: bundle real para no assert Premium+Fornalha=4 antes da correção.
- `red-validation.log`: contratos de fonte/expansão não eram validados. `red-auxiliary-metadata.log`
  detecta a remoção/esvaziamento da marca que impediria preservar o perfil original.
- `red-constructor-mapping.log`: troca temporária para indexação antiga faz o teste falhar
  (duas zonas baixa/média vs baixa/alta). Fonte restaurada em `finally`.
- `red-wiring.log`: relatório não expunha hardware efetivamente usado; após adicionar snapshot,
  `red-context.log` prova que remover **o restaurante da chamada real de apply** causa3≠4.
  Mutação temporária restaurada em `finally`. Não basta olhar o equipamento no save final.
- `green-rules.log`, `green-gates.log`, `green-ui.log`: regressões/gates finais. Nenhum gate
  enfraquecido; fixtures antigas que confundiam tabela completa com3 zonas iniciais agora
  distinguem perfil primário e auxiliar, e rejeitam auxiliar bloqueada explicitamente.

### Vetores — revisão explícita, não aceitar drift cego

`check-vectors` acusou drift (`vector-drift.log`); geração explícita após testar a semântica.
Revisão por caso: **`vector-review.json`**. Total permanece **106+44**.

- 48 cooking,32 scoring/flip,6 economy e44 FTUE: **payloads idênticos**.
- 12 turnos iniciais: idênticos. Oito avançados ganham `zoneCount/zoneHeats` verificados no replay.
- Só3 expectativas de resultado mudam, todas skill0,55/Fornalha/restaurantes4–6:

| Restaurante | Moedas antes | Depois |
|---|---:|---:|
|4|2269|2410|
|5|2849|2785|
|6|2990|2953|

Restaurante3 permanece3 zonas e mesmo resultado; skills0,85 avançadas mantêm resultado.
Metadado `dataVersions.grill`3→4. As fórmulas e os inputs desses turnos não foram retunados.
Gerador de cooking/effectiveHeat continua iterando as3 zonas do **restaurante1 fixado**,
não toda definição da tabela: um loop antigo inicialmente gerava uma linha de calor para
uma quarta zona inexistente nesse fixture. Isso foi rejeitado na revisão e corrigido antes
do aceite. A quarta zona é exercitada pelos turnos avançados e regressões específicas.

### Economia e cobertura do simulador

`green-long.log` é **inteiramente idêntico** ao `baseline-long.log` (diff vazio), inclusive
curva autoral: nível80/rest6, renda22.233.557, gasto10.873.220, saldo11.360.337, spend0,489,
perfect75,7%, burned0,2%, perdidos3,5%, duração172,5s. **15/18, exit1**, falhas mantidas:
Rede Nacional883 vs950–1450, rendaL50=192.223 vs98.000–152.000, spend0,489 vs0,70–0,99.

A igualdade foi investigada, não presumida: `LevelOutcome.grillSnapshot` registra equipamento,
contagem/calores/capacidade e ticks ocupados **depois** das ações da política. Na campanha
padrão, **1241 turnos usam4 zonas, mas0 ticks mantêm alimentos na quarta após a política**.
`progression-sample.json` inclui amostras antes/depois do unlock259 e fim1500. A política
já tem skill>0,55 ao chegar ali e move imediatamente para a zona ideal primária quando cabe;
as compras deixam espaço suficiente. Logo esse longo não mede benefício marginal da expansão.
Teste com três zonas cheias comprova que o bot usa/cozinha/serve na quarta quando necessário.

Probe complementar antes/depois: **128 turnos avançados** (4 restaurantes×4 skills×8 seeds),
sem upgrades, receitas/tempo/calor não adulterados, mais janelas físicas3→4 zonas.
`advanced-before.json`/`advanced-after.json`, gerados por `slow-cuts-report.ts`.
Antes foi reproduzido com cooking/data/2 tabelas do HEADe50ce15 (A-03 não os alterou),
restaurados em `finally`. Agora o probe enumera zonas reais em vez de fixar três.

| Restaurante | Skill0,55: moedas/turno antes | Depois |
|---|---:|---:|
|3|2128,50|2128,50|
|4|2140,88|2196,50|
|5|2409,63|2522,13|
|6|2624,13|2714,50|

Skills0,85/1 continuam iguais, pela mesma política de movimento. Skill0,30 tem variações
não uniformes; arquivos registram perfect/burned/lost/coins, sem impor melhora artificial.
**Aceite econômico global segue pendente.** Não alteramos política de habilidade para fazer
uso artificial da zona nova, nem custos/alvos para recompor métricas.

## Próximo

A-04 funcional concluído; **A-05/VIP**, depois A-06 e revalidação F4. Confirmar decisões de
chance/fonte/cap diário/placement antes de codar VIP. A-03 continua preservado. Sem nova arte,
Unity, porta de regras C#, dependências major, limpeza de branches ou merge nesta entrega.
