# F3 / A-05 — VIP funcional validado localmente

## Base e decisões (2026-09-27 UTC)

Branch `arena/01a0e099-game-churrasqueiro`. Fetch confirmou HEAD/origin/main
`e50ce1523fa3d04119dc454e3edb050070641c10` (PR14 integrado). A-03/A-04 locais preservados.
PR7/8 seguem abertos/intactos. Sem commit/push/PR/merge/CI remoto desta entrega.

Dono escolheu explicitamente:

1. **Sorteio por chegada com vaga**, a partir do Espetinho de Rua (índice1).
   Chance explícita do nível prevalece; ausente usa6%. **Zero explícito bloqueia natural**,
   inclusive em evento. Bônus ativo de fim de semana +4 pontos percentuais só se base>0.
2. **Duas visitas/dia no total**, naturais e chamadas compartilhando a cota.
3. **Chamado simulado explícito na Home**, concluir/cancelar, sem SDK/anúncio/cobrança real.
   Conclusão reserva o VIP para a primeira chegada com vaga do próximo turno elegível.
4. Renovação às **00h UTC** (21h de Brasília). Streak/missões não foram alterados.

## Implementação e limites do contrato

- `vip.ts`: cota persistida, clock injetado com high-water mark, oferta única/TTL1h,
  callback de uso único, cancelamento sem recompensa, cooldown60min e limite do placement
  lidos de `ads.json`; chance/cap/calendário lidos de `events.json`. Não muda seus valores.
- Reserva ocupa uma vaga da cota imediatamente. Se atravessar a meia-noite, continua
  ocupando uma vaga no novo dia até chegar; não expira uma recompensa já concedida.
  TTL1h é da **oferta/callback**, não da visita já reservada. Admitir o chamado não debita
  uma segunda vaga. Reserva permanece em restaurante inicial/sem vaga; natural bloqueada
  por chance0 não cancela chamado válido. Revalidar cap/eligibilidade ao concluir callback.
- Cota conta **visita**, não sucesso de serviço. Sair do turno/deixar cliente ir embora
  não devolve vaga. Estado salvo na admissão antes do resultado; relançar não repete reserva.
- TurnSimulation usa RNG VIP separado (`seed ^ 0x71f5`) para não consumir o fluxo comum
  quando não há VIP. Cota cheia/chance0/restaurante bloqueado não sorteiam. Clientes VIP
  não entram no pool de peso comum, mesmo que alguém altere seu weight. Chamadas diretas
  `spawnCustomer('vip')`/roteiro não burlam o ledger; usar serviço de reserva/admissão.
- Pedido usa catálogo nível+restaurante de A-02, paciência/tolerância/gorjeta existentes.
  Natural e chamado têm **mesmo menu/recompensa para mesma seed/condições**, sem multiplicador
  publicitário. `tipMultiplier:3` continua amortecido pela fórmula anterior, não triplica prato.
- `vipServed` conta **pedido inteiro uma vez**, não cada prato; exposto nos counters e
  creditado ao jogador ao liquidar o turno. Apenas conquistas `vip_1`/`vip_25` são consumidas
  nesta etapa: valores existentes1000+3/15000+30, sem retuning. Claims persistem em
  `player.vip.claimedAchievements` (Meta.vip no browser). **Futuro avaliador geral deve
  consultar/migrar esse ledger para não pagar essas conquistas novamente.** B-08 não encerrado.
- Analytics locais validados: `vip_arrival`/`vip_served` com source natural/called e UID
  fictício do cliente (não PII). Oferta usa taxonomy rewarded_* e `network:prototype_test`,
  nunca finge impressão/rede real. Rota de áudio existente `vipArrive` é ativada pelo spawn;
  harness rasterizado não prova reprodução audível em dispositivo.
- Home troca o teaser fictício de missões por cartão VIP após FTUE; aba Missões preservada.
  Modal identifica simulação, regra da reserva/cota e opção cancelar. Intervalo exibido
  usa valor efetivo do config. Arte aprovada/retrato VIP e styling já existentes; nenhum lote.

### Persistência e segurança — sem alegações além da evidência

Save de referência **v3→v4** adiciona `player.vip`. Migração preserva wallet, tutorial,
progressão, equipados e CRC/envelope/slots anteriores. Ledger ausente em v3 é novo;
ausente/corrompido em v4 bloqueia VIP, sem zerar carteira. Browser mantém chave
`churrasco_meta_v2`, migra só o campo novo e salva quota/reserva imediatamente; **não passou
magicamente a usar o envelope CRC do core**. Relançamento real do bundle foi testado.

Rollback do relógio não renova cota/cooldown. Não há relógio confiável de servidor nem
proteção contra editar/apagar localStorage/adiantar relógio continuamente. Não declarar
antifraude de produção, anúncios reais, validação server-side ou sincronização multi-device.
VIP compartilha um estado entre turnos nos callers reais; fixtures isoladas sem contexto
usam ledger novo/época0 explicitamente documentados, não modelo de campanha persistente.

## Evidência red → green

- `baseline-gates.log`:411 testes/21 arquivos,14/15 gates locais;29 PNGs.
- `baseline-long.log`:15/18, três falhas preexistentes.
- `red-rules.log`:3/4 testes iniciais falham (chance1 não aparecia, cota não atingida,
  bypass forçado); bloqueios já passavam porque **nenhum** natural aparecia.
- `red-wiring-validation.log`:9 falhas de validação/taxonomy antes da integração.
  A mera existência de VIP no sim não provava caller: `red-context.log` detecta chance
  explícita não encaminhada e ledger reinicializado por turno. Depois foi ligado ao jogador
  e ao relógio determinístico de12 turnos/dia, com snapshot observável por turno.
- `red-menu.log`: VIP unusual-only sem receita elegível não pode consumir reserva/cota
  nem gerar pedido vazio; guard de catálogo A-02 também aplicado ao caminho VIP.
- `red-reward-receipt.log`: pagamento existia, mas resultado não mostrava recibo VIP.
  Agora exibe moedas/brasas da conquista separadas dos pratos/fase (PNG37).
- `red-ui.log`: bundle para no assert de Home VIP inexistente. Sem hooks mutadores.
- `red-boundaries.log`/`red-save-context.log`: probabilidades/deltas inválidos, ledger
  inconsistente, conquistas com valores inválidos, save atual sem ledger e restaurante
  inexistente eram aceitos; negativos isolados agora rejeitados.
- `green-rules.log`:**44 testes VIP**; `green-gates.log`:**455/455 em22 arquivos**,
  **14/15 gates locais**. .NET indisponível, C# SKIP. Sem gate/baseline enfraquecido.
- Fixture antiga de comparação de habilidade foi explicitamente isolada com chance0:
  continua exigindo mesmo throughput, zero perdidos e diferença de qualidade/renda. Uma
  nova loteria de clientes não é variável controlada desse teste. VIP tem probes separados.

### UI real:37 capturas

`prototype/shoot.mjs`: oferta→cancelar (sem consumo), turno inteiro chance0 sem VIP;
concluir→salvar→reabrir→chegada chamada→cozinhar/virar/servir pedido natural de
picanha+coração→resultado/conquista→reabrir com cooldown/progresso. Depois novo fixture:
chance1 natural sem oferta, cota2, relançamento/novo turno bloqueado, restaurante inicial
bloqueado para natural e chamado. Taxonomy verificada. Dados de nível/save são fixtures;
nenhum cliente/prato/virada/pagamento é injetado por hook.

PNG30–37 em `prototype/shots/` (ignoradas, regeneráveis): Home/teste explícito/reserva
persistida/chegada chamada/serviço/chegada natural/limite/recibo da conquista. Inspecionados
modal, chegada, limite e recibo. FTUE **16,1s/32,9s/38,3s, zero misses,136 moedas após upgrade**,244 sprites.

## Contratos/vetores — revisão explícita

`check-vectors` sinalizou drift, guardado em `vector-drift.log`; geração explícita e revisão
por caso em **`vector-review.json`**. Agora **114 vetores +44 FTUE**:

- 48 cooking/32 scoring/6 economy sem mudança de payload.
- 20 turnos anteriores: resultados preservados; ganham counters vipSpawned/vipServed zero.
 12 autorais explicitam vipChance0; seed4242 dos8 avançados só sortearia abaixo de6% na
  tentativa36, depois das suas chegadas disponíveis. Logo esses20 **não cobriam VIP real**.
- 8 novos turnos: natural=2, chamado=1, zero, inicial bloqueado, cota já gasta, fallback
  dia útil=1, fallback fim de semana=2, zero no fim de semana. Quota e fontes são reexecutadas
  no replay, com ledger/clock de entrada explícitos.
- 44 payloads FTUE idênticos. **Só metadado analytics5→6**, pois adicionamos dois eventos.
  Vetor principal inclui versões de customers/events/ads/achievements usados pelo novo contrato.
- `analytics.json`5→6; schema e Assets/Data+manifest sincronizados. Gerador de DTOs
  conferido sem novo diff C# em A-05; dicionário de params já cobre os novos eventos.
  **Nenhuma regra/save C# portada.** Runner atual enumera28 turnos+5 economias não portados
  (33 casos), mas não foi executado aqui. Não alegar paridade VIP/save v4/Unity.
- `gen-levels` sem diff. Receitas/heat/preços/recompensas/metas/arte/dependências intactos.
  Somente recompensas VIP/conquistas já declaradas passam a ter consumidores.

## Economia — revalidada, NÃO aprovada globalmente

`green-long.log`:1500 turnos, saída1, **15/18**. Não ajustamos preços/alvos/política/limites.
`economy-comparison.json`, reproduzível com:

```
node --experimental-strip-types tools/studio/vip-report.ts
```

Três campanhas mesma seed/relógio/12 turnos por dia. Disabled reproduz exatamente A-04.
Natural é o **default de sim:long, sem nenhum rewarded**; called simula callbacks opcionais.

| Métrica | VIP desativado (A-04) | Natural / sem anúncio | Com chamado opcional |
|---|---:|---:|---:|
| Renda total |22.233.557|22.302.178|22.276.110|
| Gasto |10.873.220|10.873.220|10.873.220|
| Saldo |11.360.337|11.428.958|11.402.890|
| Visitas VIP |0|244|244|
| VIPs servidos |0|232|236|
| Visitas chamadas |0|0|125|
| Máximo visitas VIP/dia |0|2|2|
| Moedas de conquistas VIP |0|16.000|16.000|

Não concluir que chamado sempre reduz renda: é uma seed com sequências/pedidos diferentes.
Prova relevante: mesmas recompensas/cap, progresso até nível80/restaurante6 **sem anúncios**,
zero ofertas nesse controle e conquistas acessíveis naturalmente. Não é aprovação global
ou estudo estatístico de monetização.

Natural: unlocks42/97/165/262/406/**881**, grills10/45/**93**; renda diária
L5/15/30/50=10.480/39.837/108.549/**191.586**. Perfect75,7%, burned0,2%, perdidos3,5%,
duração172,5s. Continuam falhando:

- Rede Nacional881 vs950–1450;
- RendaL50=191.586 vs98.000–152.000;
- Spend≈0,488 vs0,70–0,99.

Curva autoral original skill.55 permanece46,0%/571 moedas: seus primeiros40 níveis não
sorteiam VIP elegível. Complemento **864 turnos**:4 skills×3 modos×3 seeds×24 turnos,
restaurante1/nível12/Parrilla evo3 fixos, sem compras, duas jornadas de12 turnos. Skill.55:
1093,19→1163,03 moedas/turno com natural,1152,36 com chamado;12/12 VIPs servidos em cada
modo ativo (72 turnos), zero perdidos/burned. Métrica inclui moedas da primeira conquista,
**não** promete esse bônus como renda recorrente. Todos os agregados estão no JSON.

## Encerramento e próximo checkpoint

**A-05 funcional concluído localmente; A-06 e F4 pendentes.** Próximo: mapear27 trilhas,
consumidores/fórmulas/gating/compra/bot; decidir implementação vs ocultação das no-op e
tratamento de compras antigas antes de alterar sinks. Não reabrir decisões A-01/A-04/VIP.

VIP não implementa todo LiveOps: apenas seu modificador semanal segue calendário; banner
semanal, demais bônus/eventos e tela geral de conquistas continuam fora deste checkpoint.
Não integra ads/billing/servidor, não faz port C#/Unity, não abre lote12 ou merge.
