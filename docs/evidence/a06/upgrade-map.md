# A-06 — mapa anterior à correção (2026-09-27 UTC)

**Diagnóstico ANTERIOR à correção. Estado vigente após fechamento econômico A-06.4 em [step4/reopened/README.md](step4/reopened/README.md). A-06 ainda aberto.** Base e50ce15 + A-03/A-04/A-05 locais preservados.
Fetch não encontrou avanço de main. Nenhuma regra/preço/compra/save foi alterada neste mapa.

Reprodução do método: `node --experimental-strip-types tools/studio/upgrade-audit.ts`.
O runtime atual já contém correções A-06.1–4; não sobrescrever o bruto anterior ao reexecutar.
Bruto: `before-audit.json`. Inspeção dos consumidores + comparação de resultados/eventos
inteiros, skills .30/.85, mesmo seed/restaurante4/nível44/Fornalha3, VIP0 só no probe.
Igualdade em um probe **sozinha não prova no-op**: classificação combina ausência de
consumidor com comportamento observado. Provas específicas de cada efeito serão testes A-06.

| Trilha | Efeito declarado por nível | Consumidor atual / situação |
|---|---|---|
| grill_size | +1 vaga/faixa | createGrill/zoneIsFull/place e renderer; ativo, inclusive equipado |
| grill_heat | +0,06 bônus de calor | effectiveHeat; alta1×, média0,25×, baixa0×; ativo |
| grill_stability | +0,04 estabilidade | só deriveStats; calor não oscila nem lê estabilidade; sem efeito |
| grill_speed | +0,05 velocidade | tickGrill multiplica taxa; ativo |
| charcoal_duration | +0,09 duração | tickGrill/carvão e escala equipada; ativo |
| charcoal_quality | +0,05 eficiência mínima | não derivado/consumido; sem efeito |
| charcoal_auto | +0,33 chance automática | não derivado/consumido; sem efeito |
| knife | +0,12 velocidade de preparo | estação A-03 em turn.tick; ativo após receita prep liberada |
| board | +1 vaga de preparo | prepSlots/startPrep/UI paginada A-03; ativo após receita prep |
| counter | +1 estoque | só deriveStats; estoque permanece ilimitado; sem efeito |
| plates | +0,06 gorjeta | scoreItem via turn.serve; ativo |
| tray | +0,10 velocidade de serviço | só deriveStats; serviço não consome campo; sem efeito |
| patience_charm | +0,07 paciência | cálculo de paciência no spawn; ativo |
| tables | +1 mesa | só deriveStats; não muda limite de pedidos; sem efeito |
| decor | +0,05 gorjeta | scoreItem via turn.serve; ativo |
| lighting | +0,05 XP | scoreItem via turn.serve; ativo |
| capacity | +1 pedido simultâneo | real SEM override; levels nos callers substituem stats e anulam compra |
| sign | +0,08 taxa de chegada | spawnTimer em turn.tick; ativo |
| music | +0,05 paciência | cálculo de paciência no spawn; ativo |
| garcom | +1 nível auto-serviço | só campo; automação ausente; sem efeito |
| auxiliar | +1 nível auto-preparo | só campo; automação ausente; sem efeito |
| churrasqueiro | +1 nível auto-virada | só campo; automação ausente; sem efeito |
| caixa | +1 nível auto-coleta | não implementado; ramo offline `?1:1`; sem efeito |
| gerente | +0,18 renda offline | computeOfflineEarnings funciona no core; browser usa renda aleatória e sim não contabiliza offline |
| brasa_mastery | +0,012 gorjeta | omitido de deriveStats; sem efeito |
| clientela_fiel | +0,01 paciência | omitido de deriveStats; sem efeito (descrição ainda fala gorjetas) |
| imperio_logistica | +0,02 renda offline | omitido de offline/deriveStats; sem efeito |

## Resultado e compras

- **12 consumidores de turno efetivos**, **13 sem consumidor**, **2 parciais** (capacity,
  gerente). Tábua já foi resolvida por A-03; não repetir contagem histórica de14 no-ops.
- Os13 sem efeito têm resultados/eventos idênticos ao controle nos dois perfis do probe,
  mesmo no nível máximo. Custo acumulado deles na tabela atual: **5.866.480 moedas**.
  Isto é capacidade de gasto, não estimativa de perda de todo jogador nem comprovante de compra.
- Capacidade: fila autoral base3; upgrade2 deriva5 mas mantém3. Sem override, admite5.
  Correção deve somar upgrade à base autoral e suportar a mesma fila no renderer/input/bot.
- Gerente0→4 aumenta 1h offline no core (rest4) de5760 para9907 moedas. Não funciona
  no popup aleatório atual do browser e não produz renda no sim. Não chamar de funcional
  ponta a ponta nem implementar todo offline silenciosamente neste checkpoint.
- `buyUpgrade` aceita **27/27 no restaurante0/nível1** com saldo suficiente; não lê gates
  de funcionários. `employees.json` declara restaurantes1/2/3/3/4.
- UI só oferece compra real de grill_size/grill_heat; demais abas são teasers, não catálogo
  dessas27 trilhas. Compra rápida duplica lógica econômica. O bot tenta comprar todas27.
- Faca/tábua não devem ser vendidas antes do primeiro prep elegível (hoje vinagrete, nível12).
  FTUE grill_size permanece disponível. Não criar outros gates arbitrários para tunar renda.

## Decisões de escopo confirmadas pelo dono

1. **Definir todas as regras faltantes primeiro, para aprovação**, em subetapas. Não encerrar
   A-06 apenas desabilitando melhorias indefinidamente. Automação, carvão, estoque, serviço
   e offline precisam de contratos explícitos antes da implementação.
2. **Preservar níveis comprados, sem reembolso automático nem apagamento de progresso.**
   Não há recibos históricos suficientes para tratar o custo de tabela como gasto comprovado.
   Incompletos podem ficar temporariamente indisponíveis para novas compras, com estado visível.

O contrato detalhado em [design-proposal.md](design-proposal.md) foi **aprovado pelo dono**:
recursos, serviço/equipe, offline no índice3 e Gerente somente offline (extras no backlog).
Respostas em [decisions.md](decisions.md). Explicita parâmetros existentes/novos, conflitos
resolvidos e subetapas. Não repetir decisões de escopo, histórico ou mecânicas aprovadas.
**Estado à aprovação: A-06.0 concluído; implementação então não iniciada. A-06.1 agora concluído, ver step1/README.**

Próximo: regressões red antes de corrigir, provas de efeito real e
impossibilidade de comprar bloqueados, UI por ponteiro, revisão de contratos/vetores,
gates/sim1500. Não retunar custos/metas para esconder efeitos. Nenhuma regra de produção,
compra, preço ou save foi modificada nesta fase de diagnóstico/proposta.
