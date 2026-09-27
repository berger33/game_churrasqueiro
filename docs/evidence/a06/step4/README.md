# A-06.4 — offline real, Caixa, Gerente e Logística

> **Fechamento econômico revalidado (2026-09-27):18/18, exit0.** Após autorização
> explícita `late_income`, renda tardia ajustada no runtime, mantendo preços, histórico,
> FTUE, offline e todas as metas.672 testes,53 capturas,157+44 vetores; C# SKIP.
> A-06.5 **não foi iniciada**. Registro anterior abaixo é histórico; relatório vigente:
> [reopened/README.md](reopened/README.md).

2026-09-27 · implementação/validação **local** em `arena/01a0e099-game-churrasqueiro`.
Antes das edições, `git fetch origin` confirmou HEAD/origin/main em
`e50ce1523fa3d04119dc454e3edb050070641c10`. Mudanças anteriores preservadas.
**27 trilhas integradas; A-06.5 (revisão final das 27) e F4/economia continuam abertos.**
Sem commit, push, PR, merge, CI remoto, arte nova, SDK, porta de regras C#/Unity ou dispositivo.

## Contrato funcional entregue (preservado pelo rebalanceamento)

- Desbloqueio no restaurante **índice3**, Churrascaria de Bairro. Até **8h por lote**,
  rampa20min/piso50%, mesmas taxas por restaurante. Multiplicador aditivo
  `1 + .18×Gerente + .02×Logística + bônusCaixa`, máximo **2,18×**.
- Caixa1–4 antecipa até2/4/6/8h **no retorno**; bônus de taxa0/0/3/6%. Não executa com
  app fechado, não estende o cap. Seis horas com Caixa1:2/6 automático,4/6 manual.
  Parcela automática parcial usa piso acumulado; quitação paga total arredondado menos
  o que já foi pago, conservando moedas e XP. Zero fracionário não encerra lote prematuramente.
- Âncora real e snapshot congelado por ausência; nada aleatório, retroativo ou por troca
  de data de login. Cada ausência tem sua rampa; lote soma frações/tempo elegível até480min.
  Fechar/reabrir popup não reinicia cap nem franquia do Caixa. Intervalos online não rendem.
- Cooldown30min começa na **primeira liquidação** do lote e rege o próximo lote. Resto manual
  de lote já elegível pode ser coletado imediatamente. Ausências durante cooldown acumulam;
  o novo lote aguarda a elegibilidade. Não existe callback automático de recompensa em background.
- ID monotônico, parcelas pagas, high-water de relógio e último recibo persistidos. Relógio
  recuado não cria janela nem credita posteriormente o tempo online. Claim repetido é inerte.
- Transações clonam o estado. Browser só troca o estado vivo **após** uma gravação JSON contendo
  carteira, XP/nível/recompensas e ledger. Falha de storage no retorno pausa o turno e retenta
  com o instante de retorno original; falha manual mantém a parcela. Instalação sem storage
  e sem crédito/âncora não bloqueia o FTUE. Falha ao registrar hide não inventa renda depois.
- Turno/RAF pausados quando oculto, durante retorno ainda não salvo e sob popup. Nada de
  pedidos, preparos, missões, VIPs ou turnos fabricados. XP offline chama `grantExperience`,
  extraído do caminho de recompensa de turno do sim-core; recibo separa renda e level-up.
- Popup com alvo/CTA compartilhados, moedas **e XP**, cap real, recibo e reabertura pelo Home.
  Anúncio para dobrar **indisponível**, sem rewarded falso.
- Gerente entrega somente18% offline/nível. Rerolls diário/semanal, descontos10/15% e VIP+2pp
  continuam **backlog explícito**, não promessa ativa. Níveis históricos nunca apagados/reembolsados.

## Red → green e migração

- [red-rules.log](red-rules.log): **17 falhas/18 testes** antes da implementação.
- [red-ui.log](red-ui.log): popup antigo não tinha ledger/controles reais. O código antigo
  inventava35–94min ao mudar o dia, moedas por nível, sem XP, com CTA deslocado, cap falso e
  promessa de anúncio. Fechar descartava a promessa; não havia âncora/claim persistente.
- [red-integration.log](red-integration.log):3 compras bloqueadas +5 contratos de dados
  ainda sem validação. Nona falha era fixture de migração: serializer atual escreve envelope5;
  corrigida para emitir envelope4 real, sem alterar a política de migração para acomodá-la.
- **34 testes offline +68 compras =102 PASS**, [green-rules.log](green-rules.log).
  Cobrem XP/level rewards, conservação, snapshot por ausência, cap/franquia cumulativos,
  frações/cooldown, clock rollback, retorno/claim/reload, schema/CRC, storage e contratos.
- **Save schema5**: v4 e anteriores ganham ledger sem âncora, sem renda histórica; carteira,
  progressão e compras preservadas. Ledger atual malformado falha fechado. Meta browser mantém
  a chave v2 e adiciona ledger/contadores na mesma gravação, sem segundo item de claim.
- `economy13`, `employees4`; schemas/DTOs/cópias sincronizados. DTOs não são porta de regras.
  [contract-review.json](contract-review.json):27 preços/moedas/crescimentos/máximos/deltas,
  gates/níveis/coberturas de funcionários e taxas/cap/rampa/cooldown antigos preservados.

## Gates, vetores e UI

- `npm run gates`: **649 testes/27 arquivos;14/15 gates locais; C# SKIP por falta de dotnet**.
  [green-gates.log](green-gates.log). Não interpretar SKIP como paridade ou build Unity.
- Regeneração explícita: [vector-generation.log](vector-generation.log),
  [vector-review.json](vector-review.json). **143+44 vetores**:135 antigos byte-equivalentes
  como objetos; apenas `econ.offline` recebe índice3 no input e mais linhas de restaurantes
  (todas18 linhas antigas intactas);7 novos casos de ledger.48 cooking/32 scoring/50 turnos
  não mudam.44 FTUE byte-idênticos. Replay agora verifica XP offline além de moedas.
- **52 capturas** por ponteiro; [green-ui.log](green-ui.log). Casos50–52 exercitam hide/show,
  eventos duplicados, pausa do turno,6h/Caixa1, fechamento/reload/Home, falha no retorno e na
  coleta, retentativa sem contabilizar espera online, quitação e recibo. Layout somente leitura,
  sem função de pagamento de teste. PNGs ignorados em `prototype/shots/`.
- Capturas50/52 inspecionadas visualmente durante implementação; não alegamos revisão individual
  das52. Fixture avançada de restaurante **não prova progressão natural completa do browser**.
- FTUE preservado: primeiro perfeito16,1s, completo32,9s, compra38,3s,0 misses,136 moedas.
  pt-BR611 chaves; en/es135 cada, fallback22,1%. Sem novo texto literal em dados de UI.
- O teste A-04 observa300 em vez de275 turnos porque Premium agora chega277, antes272.
  Nenhuma asserção de zonas nem meta econômica foi removida/relaxada (banda Premium195–315
  intacta). Harness render agora emite também o visibilitychange de retorno, como o browser.

## Economia ativa anterior ao rebalanceamento — histórico15/18

`npm run sim:long`: seed20260917, dt1/12,1500 turnos, UTC2026-09-21,12 turnos/dia,
VIP natural, sem rewarded/ausências. [green-long.log](green-long.log) e
[green-long-repeat.log](green-long-repeat.log) byte-idênticos: **15/18, exit1 esperado**.
Relatório reproduzível: `node --experimental-strip-types tools/studio/upgrade-step4-report.ts`,
[economy-comparison.json](economy-comparison.json).

| Medida | A-06.3 | A-06.4 |
|---|---:|---:|
| Renda | 23.263.609 | 22.748.950 |
| Gasto | 8.468.130 | 10.873.220 |
| Saldo | 14.795.479 | 11.875.730 |
| Razão gasto/renda | .3640075794 | .4779657962 |
| Premium / Festival / Rede | 272 /422 /729 | 277 /430 /881 |
| Renda diária L50 | 189.197 | 183.646 |

Continuam falhando **Rede881 vs950–1450; L50=183.646 vs98.000–152.000;
spend.478 vs.70–.99**. Nenhum retuning. A renda muda por cronologia/compras, **não** por
injeção offline. Sinks novos exatamente2.405.090: Caixa160.430, Gerente354.180,
Logística1.890.480. Todas27 trilhas têm capacidade total6.358.620,0 temporariamente bloqueada.
Unlocks42/96/168/277/430/881; grills11/43/87. Perfeitos42,13%, queimados.0768%,
perdidos2,209%, duração172,055s; curva autoral skill.55 sem compras45,6%. VIP244/238.
63.319 serviços/28.808 viradas/121 preparos automáticos, limites verificados por turno.

## Ausências — cenário separado e declarado

`node --experimental-strip-types tools/studio/offline-report.ts` →
[absence-economy.json](absence-economy.json).24 fixtures: restaurantes3/4/6 ×8 configurações,
nível80 para isolar renda de recompensa de nível (esta tem teste/vetor próprios).
Três dias a partir de2026-09-21 UTC, ausências **00:30–06:30,06:45–06:55,08:00–20:00**.
Janelas online são só relógio, não turnos.1090min ausentes/dia,850 elegíveis após cap;
rampa do trecho10min produz847,5min ponderados. Coleta manual imediata quando elegível;
segunda coleta aguarda07:00, sem renda durante a espera. Todos recibos conservam moedas/XP.

| Restaurante /3 dias | Base: moedas /XP | Caixa1: auto +manual | Máximo: moedas /XP |
|---|---:|---:|---:|
| 3 |106.785 /6.102 |30.240 +76.545 |232.794 /13.302 |
| 4 |244.080 /12.714 |69.120 +174.960 |532.095 /27.714 |
| 6 |1.093.275 /40.680 |309.600 +783.675 |2.383.341 /88.683 |

Caixa1 muda **quando**, não quanto, se tudo for quitado. Caixa3/4 mudam também a taxa conforme
contrato. Arredondamento é por liquidação, não por dia; não interpretar a tabela como receita
natural de retenção/economia já aprovada. Não há target criado para fazer este cenário passar.

## Limites e próxima etapa

Browser local não é autoridade antifraude contra editar storage, adiantar relógio, abas
concorrentes/dispositivos. Hard kill sem evento de hide persistido não tem âncora: não inventa
renda. Turno em memória pausa ao retornar, mas não foi implementado save/resume de turno completo.
O caminho **ativo do browser** ainda tem XP/level-up legado diferente do sim-core (dívida F10);
esta etapa não alterou silenciosamente suas recompensas. Offline usa o caminho comum **do core**.
A-06.5 deve revisar as27 trilhas/contratos/limites/documentação e consolidar os desvios econômicos,
sem confundir integração funcional com aceite econômico ou antecipar porta C#/Unity.
