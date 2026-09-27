# A-06 — contrato aprovado para as 27 trilhas

**Adendo econômico autorizado após reabertura A-06.4:** o dono escolheu `late_income`
(decisions.md §8). Receita de pratos ativos por restaurante0–3=100%,4=85%,5=62%,6=48%;
XP/offline/preços/FTUE/metas preservados. Campanha1500 agora18/18. Este adendo substitui
somente a proibição de rebalancear a renda tardia neste recorte, não as demais regras.
Ver [step4/reopened/README.md](step4/reopened/README.md). A-06.5 não iniciada.

**2026-09-27 · DESIGN APROVADO. A-06.1–4 IMPLEMENTADOS/VALIDADOS LOCALMENTE; A-06.5 PENDENTE.**

Base: `e50ce15` + A-03/A-04/A-05 locais preservados. Diagnóstico em
[upgrade-map.md](upgrade-map.md); reprodução em [before-audit.json](before-audit.json).
O dono aprovou os quatro blocos apresentados: recursos, serviço/equipe, offline no índice3
e Gerente somente offline neste recorte. Registro em [decisions.md](decisions.md).
**A aprovação é de regras; não constitui evidência de implementação ou testes.**

## 1. O que o dono já decidiu

- **Definir as regras faltantes de todos os grupos antes de implementar**, com aprovação
  e subetapas. Apenas desligar as trilhas indefinidamente **não encerra A-06**.
- **Preservar os níveis comprados, sem reembolso automático nem apagamento de progresso.**
  Bloqueio temporário de novas compras incompletas não revoga níveis existentes.
- Não reabrir virada de costela/cupim, quarta zona Fornalha + Premium, nem o contrato VIP
  aprovado em A-05. Não alterar preços, recompensas ou metas para fazer guardrails passarem.

Diagnóstico inicial A-06.0: **12 trilhas com consumidor de turno,13 sem efeito,2 parciais**.
Após A-06.4: **27 integradas,0 temporariamente bloqueadas**. Provas/limites em
[step4/README.md](step4/README.md); A-06.5 e aceite econômico ainda pendentes.

## 2. Resumo das escolhas aprovadas

| Grupo | Decisão aprovada | O que muda em relação ao estado atual |
|---|---|---|
| Calor/carvão | Estabilidade recupera parte da perda de eficiência; qualidade eleva o piso; reposição automática tenta uma vez por saco | Não inventar oscilação de calor para depois vender a solução |
| Estoque/Balcão | Reserva **por ingrediente**, 6 + nível; reposição manual gratuita de todos os ingredientes, em **3 s** | Estoque hoje ilimitado; 3 s é parâmetro NOVO aprovado, não dado preexistente |
| Mesas/Capacidade | As duas somam vagas à base de pedidos do turno | Override autoral deixa de anular upgrades; fila paginada |
| Bandeja | Manter +10%/nível, aplicado à frequência de viagens do Garçom | Requer Garçom; trocar promessa de quantidade por velocidade, sem atrasar serviço manual |
| Funcionários | Preparar/virar/servir com orçamento limitado; nunca escolher zona nem garantir o ponto | Corrigir promessas contraditórias da tabela e das descrições |
| Offline | Liberar no **índice 3**, Churrascaria de Bairro, quarto restaurante; renda real ao retornar | Seguir game design, em vez do core atual que libera no índice 1 ou do popup aleatório |
| Gerente | Implementar integralmente o efeito da trilha: +18%/nível offline | Rerolls, descontos e +2pp VIP não entram sem escopo próprio explícito; não anunciá-los como ativos |

**Os últimos seis itens contêm decisões novas de produto**, não simples consertos de wiring.
O dono aprovou o índice3 para offline, resolvendo a divergência, e aprovou o recorte de
Gerente somente offline. Todas as27 trilhas funcionais não significa que o sistema geral
de missões, loja e LiveOps esteja entregue. Não reabrir essas escolhas sem nova solicitação.

## 3. Contrato comum: disponibilidade, compras e histórico

### 3.1 Uma única regra para UI, serviço e bot

Implementar um resolvedor compartilhado que devolva nível efetivo, próximo preço, disponibilidade,
motivo de bloqueio e efeito do próximo nível. `buyUpgrade` revalida tudo antes de debitar.
A UI e o bot não calculam preço/gate por caminhos próprios.

- Manter `baseCost`, `growth`, moeda e `maxLevel` das 27 trilhas. Não há desconto novo neste
  recorte. Prestígio não ganha requisito de rebirth/reset que hoje não existe.
- Faca/Tábua: exigir receita prep elegível pelo catálogo de A-02 (hoje vinagrete no nível12).
- Funcionários: índices existentes **1/2/3/3/4**, respectivamente Garçom/Auxiliar/
  Churrasqueiro/Caixa/Gerente. Auxiliar também precisa de prep elegível.
- Bandeja: depender de Garçom nível1, pois sua velocidade proposta só atua nesse serviço.
- Império Logística: depender do desbloqueio offline aprovado.
- Demais trilhas: sem gates novos arbitrários. `grill_size` continua disponível no FTUE.
- Durante desenvolvimento, `feature_pending` impede compra de efeito ainda não integrado.
  No fechamento, **nenhuma das 27 pode continuar pendente por falta de consumidor**;
  gates legítimos de receita/restaurante/dependência permanecem.
- Exibir níveis históricos mesmo quando bloqueados; manter saldo, XP, claims e contadores.
  Ao disponibilizar a funcionalidade e cumprir o gate, o nível já comprado passa a valer
  sem nova cobrança. Não reconstruir recibos históricos usando a tabela atual.
- Para cálculo, validar inteiros/limites em todas as trilhas, inclusive funcionários.
  Save inválido não autoriza multiplicadores ilimitados nem reset automático da carteira.

### 3.2 Interface e comportamento humano

Antes de A-06.1 o protótipo só vendia Tamanho/Calor. A-06.1 agora oferece as27 num catálogo
paginado, usando componentes/arte existentes e textos por chaves pt-BR. Mostrar motivo de
bloqueio e nível preservado; manter o atalho/spotlight do FTUE. Não basta provar compra pelo bot.
Testar ponteiro real, saldo, compra dupla, max level, bloqueio e reabertura com save.

## 4. Regras aprovadas por grupo

### 4.1 Manter os efeitos existentes e ligar prestígio

Os 12 consumidores existentes não serão redesenhados: `grill_size`, `grill_heat`,
`grill_speed`, `charcoal_duration`, `knife`, `board`, `plates`, `patience_charm`, `decor`,
`lighting`, `sign`, `music`. Acrescentar cobertura de compra/gate e efeito marginal.

- `brasa_mastery`: adicionar **0,012 × nível** ao mesmo multiplicador aditivo de gorjeta
  de Pratos/Decoração. Máximo20. Não multiplicar receita total nem recompensa de conquista.
- `clientela_fiel`: adicionar **0,01 × nível** ao multiplicador aditivo de paciência de
  Amuleto/Música. Máximo20. Corrigir a descrição que promete gorjeta.
- `imperio_logistica`: **0,02 × nível** no multiplicador offline (§4.6). Máximo20.

### 4.2 Capacidade e Mesas: uma fila real

Fórmula aprovada:

`limite = (override autoral ?? limite-base do restaurante) + nível(capacity) + nível(tables)`

Os deltas das duas trilhas já são +1; limites de níveis5 e6 permanecem. A base do restaurante
já representa seu serviço inicial: **não somar de novo o total de mesas-base**. Assim, base3
com Capacidade2 admite5; adicionar Mesas1 admite6. Sem override, base6 e ambas max chegam17.

São duas fontes do mesmo benefício, assim como há duas fontes de gorjeta. Não inventar bônus
oculto de renda/paciência para diferenciá-las. Chegada continua usando a taxa real de `sign`;
mais vagas não implica fabricar clientes quando não há chegada pendente.

UI paginada, contagem total e sinalização de urgência fora da página; todo pedido precisa ser
alcançável sem sobrepor grelha/prep. Página não troca sozinha durante drag. VIP ocupa vaga da
mesma fila e mantém chance/cota A-05. Bot e serviço usam o mesmo limite, inclusive com override.

### 4.3 Estabilidade, qualidade e reposição de carvão

**Dados existentes:** duração150s antes dos bônus; eficiência .75 → 1 → 1 → .62;
reposição2,2s, custo0, aviso quando resta22%; estabilidade+.04 (máximo6), qualidade+.05
(máximo6), auto+.33 (máximo3).

**Fórmula aprovada**, enquanto houver combustível e fora do estado de reposição:

1. `e` = eficiência da curva atual; `pisoBase` = mínimo dessa curva, hoje .62.
2. `q = max(e, min(1, pisoBase + .05 × nível(charcoal_quality)))`.
3. `s = .04 × nível(grill_stability)`; `eficiência = q + s × (1 - q)`.
4. Aplicar a eficiência ao calor pelo caminho comum; não aumentar duração por estes efeitos.

Com níveis0, a curva atual permanece intacta. No fim do saco, qualidade6 dá .92;
com estabilidade6 junto, .9392. Estabilidade6 sozinha recupera24% da queda, não +24% de calor.
Não cria calor sem carvão, não anula reposição nem garante ausência de queimados.
O campo legado `restaurant.grill.heatStability` (hoje sem consumidor) não será reinterpretado
silenciosamente como oscilação. Separar claramente o bônus operacional da trilha; triagem do
campo-base continua em A-13/F5, sem alegar que todos os campos de restaurante ficaram ativos.

Reposição automática:

- Ao cruzar o limiar de22% restante, **uma tentativa por ciclo de carvão**, probabilidade
  `min(1, .33 × nível)`: **33/66/99%, não 100%** no máximo.
- RNG próprio determinístico; sem consumir a sequência de pedidos/VIP. Se carregar o estado
  já abaixo do limiar e a tentativa ainda não ocorreu, admitir uma única tentativa.
- Sucesso chama a mesma operação de reposição manual, com2,2s e custo0 existentes.
  Falha não é sorteada novamente a cada frame. A ação manual continua disponível.
- Reposição manual/automática concorrente inicia só um ciclo. Um novo saco habilita uma
  nova tentativa; não há reposição recursiva nem benefício extra de moer frames.

### 4.4 Balcão: estoque finito, mas reabastecível

**Semântica nova aprovada:** os6 existentes representam capacidade **por ingrediente
liberado**, não seis alimentos totais para todo o turno. `counter` aumenta cada reserva em1,
até11. Renomear `rawStockPerTurn` para explicitar capacidade de estoque, conforme aprovado.

- Começar cada turno com reservas cheias, só para receitas elegíveis por A-02.
- Debitar uma unidade apenas ao admitir efetivamente a porção na grelha ou na estação prep.
  Cancelamento anterior, zona/vaga inválida e tentativa negada não gastam estoque; mover,
  virar ou retomar drag da mesma porção não debita novamente.
- Porção já admitida e depois queimada/descartada não devolve matéria-prima.
- Ao zerar um ingrediente, negar novas admissões dele com mensagem/contador visíveis; os
  pedidos continuam possíveis por reposição, sem filtrar o catálogo para maquiar perdas.
- Botão **Repor estoque** inicia reposição gratuita de todas as reservas para a capacidade
  atual em **3 s**. Esse tempo é NOVO e foi aprovado. Uma reposição por vez; pode
  ser iniciada antes de zerar. Cozimento/paciência continuam; outras ações seguem disponíveis.
- Não existe cobrança por ingrediente, compra emergencial premium, recompensa por estoque
  restante nem reposição automática escondida. O bot solicita a mesma ação quando há demanda
  sem matéria-prima e ainda não há reposição. Não criar alimentos órfãos ao falhar uma tentativa.
- Isso é um buffer de abastecimento, não um limite de alimentos simultaneamente na grelha.
  Assim não anula vagas compradas, prep A-03 ou quarta zona A-04.

### 4.5 Funcionários e Bandeja

**Regra dura mantida:** nunca escolher/mudar zona nem fazer a chamada de ponto perfeito.
Automação pode acertar por circunstância, mas não otimiza o instante para garantir essa nota.
Serviço/preparo/virada usam as mesmas APIs legais do jogador; não recebem dinheiro extra
por ação fictícia, não servem duas vezes nem ultrapassam capacidade de estação/estoque.

**Cobertura aprovada como limite real, não apenas probabilidade média:** durante o turno,
contar uma vez cada porção que atinge a condição pública de elegibilidade. Autorizar no máximo
`floor(cobertura × totalElegível)` porções distintas automatizadas. Contar as atendidas manualmente
no denominador; não contar tentativas falhas, porções cruas recém-criadas ou o mesmo ID repetido.
Gastar crédito só em ação concluída. Primeiro elegível pode esperar o segundo; sem arredondar
para cima para conceder100% de automação em amostras pequenas. Porções queimadas/cruas não
alimentam artificialmente o orçamento. Timers não disparam rajadas de ações após lag/retorno.

#### Garçom — índices/níveis da tabela preservados

- Cobertura por nível: **20/40/50/50/50%**. Elegível quando a porção tem qualidade pelo menos
  boa (ou prep pronta) e corresponde a linha ainda aberta de cliente esperando **mais de1,5s**.
  Contar no denominador as porções que atingem a condição, mesmo se servidas manualmente.
- Viagem-base aprovada: **intervalo de1,5s** entre ações bem-sucedidas; este uso como cadência
  é NOVO, distinto da espera mínima do cliente existente na tabela.
- Escolher cliente elegível mais antigo, depois porção de menor ID; não mirar centro da janela.
  Se o estado mudou, revalidar e não gastar crédito sem servir.
- Nível2: +5% de gorjeta só no serviço automático; nível4+: +10%, substitui o5%, não acumula.
  Composição aprovada: multiplicar **a parcela de gorjeta** por1,05/1,10 após os bônus
  normais, arredondando no mesmo ponto do score. Nada sobre receita-base/conquistas.
- Nível3+: aviso visual de risco de queima a aproximadamente1s, previsto pela física corrente,
  sem salvar automaticamente a carne ou garantir a previsão após mover/repor carvão.
- Nível5: até2 porções elegíveis por viagem, ainda dentro do orçamento global de50%.

**Bandeja:** manter `1 + .10 × nível`, máximo5, e aplicar a
`intervaloViagem = 1,5s / multiplicadorBandeja`. No máximo:1s. Não aumenta cobertura ou
qualidade. Serviço manual continua imediato, preservando o FTUE; nenhuma melhora existe
só na reação sintética do bot. Mostrar dependência de Garçom e substituir o texto “carrega
mais pedidos” por velocidade de viagens. Quantidade por viagem é benefício do Garçom5.

#### Auxiliar

- Cadências já declaradas: **6/4,5/3,5/3/2,5s**; nível3+ adiciona **uma** vaga prep.
- Preparar somente receitas `prep`, escolhendo demanda aberta mais antiga que ainda não tem
  porção em preparo/pronta. Não colocar carne na grelha, escolher zona ou servir o prato.
- Coberturas .2/.4/.6/.8/1 da tabela: interpretá-las como chance de iniciar em
  cada oportunidade de cadência, com RNG próprio. Não é o cap de virada/serviço. Falha significa
  oportunidade não usada, **não preparar receita errada nem gastar ingrediente**.
- Exigir estoque e vaga antes de admitir; faca acelera processamento real, tábua e a vaga
  adicional ampliam a estação real. Pronto continua ocupando vaga até serviço/descarte.
- Corrigir a descrição pt-BR que hoje diz repor carvão. Não criar erro aleatório para depois
  removê-lo no nível5; retirar a alegação exclusiva “never mis-preps”.

#### Churrasqueiro

- Cadências existentes **5/4/3/2,5/2s**; coberturas **20/30/40/50/60%**.
- Elegível: porção que exige virada, ainda não virada, que alcançou o mesmo sinal público de
  virada mostrado ao jogador. Uma entrada por ID no orçamento, não uma por frame.
- Virar a elegível mais antiga no primeiro ciclo com crédito; não calcular o instante que
  maximiza score. Player pode antecipar/sobrepor manualmente; revalidar antes da ação.
- Remover as promessas de mover zona nos níveis3–5 e “never burns” no5, pois contradizem o
  contrato duro. Cada nível continua aumentando cobertura/cadência. Não alterar a regra
  sides2 + flipNeeded true de costela/cupim.

#### Caixa e Gerente

Caixa é **auto-coleta offline**, não acelerar fila ativa. Gerente é **renda offline**.
Correção de textos é parte da implementação; não atribuir-lhes um segundo sistema invisível.

### 4.6 Offline, Caixa, Gerente e Logística

**Desbloqueio aprovado:** índice3, **Churrascaria de Bairro**, quarto
restaurante. Isso segue docs02 e a tabela de progressão, mas altera a disponibilidade da
função de referência atual (`restaurantIndex > 0`). As taxas de índices1/2 hoje positivas
ficam explicitamente inacessíveis; não apresentá-las como renda ganhada.

**Preservar dados:** cap8h, rampa20min, piso50%, taxas moedas/XP por restaurante e intervalo
mínimo30min entre novas coletas/lotes. O intervalo de coleta **não é** um mínimo de ausência:
uma primeira ausência curta pode render com rampa; uma segunda coleta prematura aguarda.

Para um período ausente elegível, `m = min(minutosAusentes, 480)`:

`fator = .5 + .5 × clamp(m / 20, 0, 1)`

`multiplicador = 1 + .18 × nível(gerente) + .02 × nível(imperio_logistica) + bônusCaixa`

`crédito = m × taxaDoRestaurante × fator × multiplicador`, separadamente para moedas e XP.

`bônusCaixa`:0 nos níveis0–2, .03 no3, .06 no4. Manter composição aditiva; no teto,
Gerente4 + Logística20 + Caixa4 = **2,18×**, não produto de três multiplicadores.

**Caixa:** ao retornar, antecipar automaticamente a parcela correspondente a até
**2/4/6/8h** do crédito elegível; resto continua para coleta manual. Nível0 não antecipa.
É processamento no retorno, **não um serviço executando com o app fechado**, e não estende
cap8h. Dividir o crédito já calculado, sem reaplicar rampa ou pagar XP duas vezes.
Para uma ausência única de6h, Caixa1 antecipa2/6 do total; os4/6 restantes ficam manuais.
Arredondamento deve conservar `automático + manual = total` para ambas as moedas/XP.

**Persistência e ciclos:**

- Registrar âncora real de ausência e snapshot de restaurante/multiplicadores antes dela.
  Comprar upgrade ao voltar não multiplica retroativamente horas anteriores.
- Não gerar minutos aleatórios. Pausar turno ao ocultar/retornar conforme estado de sessão;
  nunca contabilizar a mesma duração como jogo ativo e ausência. Não simular pedidos, VIPs,
  carnes servidas ou missões durante offline: o produto deste cálculo é só moedas/XP.
- Lote pendente tem ID e parcelas reclamadas; crédito e marca de claim são atômicos.
  Fechar popup/recarregar/repetir callback não perde parcela pendente nem duplica carteira/XP.
- Uma parcela manual do lote já elegível pode ser retirada logo após a antecipação do Caixa;
  o cooldown de30min rege um **novo lote**, não cobra espera extra pela parcela restante.
- Ausências menores dentro do cooldown ficam acumuladas sem incluir tempo online. Um lote
  aberto tem no máximo8h somadas; retornar sem coletar não reinicia esse teto. Depois da
  quitação, um lote novo pode começar. Respeitar o limite de antecipação já usado nesse lote.
- Cada ausência usa seu snapshot e sua rampa; acumular créditos fracionários internamente,
  arredondar na liquidação conservando o total, não arredondar cada pequeno retorno para cima.
- Relógio recuado não concede tempo negativo nem nova janela; manter high-water persistido.
  Migração sem âncora começa em agora, **não inventa recompensa histórica** e não remove saldo.
  O browser continua sem autoridade de servidor; isso não é antifraude contra editar storage,
  adiantar relógio ou usar múltiplos dispositivos.
- Aplicar XP pelo caminho comum de level-up/recompensas, sem incrementar turnos/pedidos.
  Explicitar no recibo moedas/XP offline e recompensas de nível separadamente.
- `adDoubleAvailable` não autoriza anúncio falso. Não adicionar rewarded offline neste recorte;
  apresentar como indisponível até integração/contrato próprio, sem chamar de SDK real.

**Recorte de escopo aprovado explicitamente:** implementar +18% por nível de Gerente e remover da
promessa ativa rerolls diário/semanal, desconto10/15% e VIP+2pp. Esses extras não são efeitos
de `upgrades.json` e envolvem missões/preços/A-05. Mantê-los como backlog identificado,
não habilidades concedidas na compra. Se o dono exigir também esses extras em A-06,
**reabrir o escopo desta proposta antes do código**, não fingir que o sistema existe.

## 5. Subetapas e evidência exigida

| Subetapa | Entrega | Provas mínimas antes de declarar concluída |
|---|---|---|
| A-06.0 — este contrato | Design aprovado | Mapa27, probe anterior, conflitos e parâmetros novos identificados |
| A-06.1 — concluído localmente, ver step1/README | Resolvedor UI/serviço/bot; catálogo27; histórico; capacidade/mesas; dois prestígios ativos de turno | Red antes de corrigir; compra bloqueada sem débito; níveis antigos preservados; filas com override; renda/paciência efetivas; ponteiro/FTUE |
| A-06.2 — concluído localmente, ver step2/README | Estabilidade/qualidade/auto-carvão e estoque/Balcão | Curva/falta de carvão/uma tentativa; estoque0/1/6/11, cancelamento, reabastecimento, vagas cheias; efeito observado no turno, não só em deriveStats |
| A-06.3 — concluído localmente, ver step3/README | Garçom/Auxiliar/Churrasqueiro/Bandeja | Cada nível com efeito; caps exatos, lote pequeno, concorrência manual, tick/lag, sinais/UI e bloqueios; nenhuma zona automatizada |
| A-06.4 — concluído localmente, ver step4/README | Âncora/ledger/claims; Caixa/Gerente/Logística; popup real | Antes/no unlock; ausência0/curta/8h/>8h; cooldown; retorno repetido; troca de relógio; save antigo; total moedas/XP conservado; UI por ponteiro |
| A-06.5 — fechamento | Remapear27; campanha1500; contratos/save/vetores/docs18/23/24 | Zero no-op vendável; benefício real de todas27; todas as escolhas implementadas ou checkpoint segue aberto |

Em cada grupo: registrar falha reproduzível no comportamento anterior, implementar TS/dados,
rodar `npm run gates` e `npm run sim:long`, comparar com baseline. Testar níveis0/1/máximo,
transições intermediárias, gate imediatamente antes/no/depois e entradas inválidas. Não
considerar um log/evento cosmético ou mudança de stat prova suficiente de benefício real.

Vetores só serão regenerados quando a semântica mudar, com diff explicado (incluindo
quais cenários antigos devem permanecer iguais). Migração/save apenas para estado novo que
precisa persistir; review explícito, sem C# nesta etapa. Roteiro FTUE e provas de prep,
quarta zona e VIP são regressões obrigatórias, não alvos a afrouxar.

O sim precisa deixar de desperdiçar compras bloqueadas, usar recursos/automação reais e
relatar offline separadamente: campanha ativa comparável a A-05 e cenário adicional com
agenda explícita de ausências. Não inventar offline para melhorar spend ratio. Recalcular
custos acessíveis, gasto efetivo, renda por fonte, saldo, unlocks e qualidade/queimados/perdas.
Os5.866.480 de capacidade de gasto antes inerte **não são valor de reembolso nem projeção
garantida de gasto futuro**. Os três desvios econômicos A-05 continuam não aprovados.

## 6. Aprovação obtida; próximo checkpoint

As quatro respostas do dono foram registradas em [decisions.md](decisions.md):

1. **Recursos (§4.3–4.4): aprovados.** Recuperação determinística de eficiência;
   33/66/99% uma vez por saco; estoque por ingrediente e reposição gratuita3s.
2. **Serviço/equipe (§4.2, §4.5): aprovados.** Mesas+Capacidade aditivas; Bandeja acelera
   Garçom e depende dele; intervalos/coberturas, caps estritos e textos coerentes.
3. **Offline (§4.6): aprovado no índice3.** Cálculo/ledger reais; Caixa divide coleta sem
   estender8h; multiplicador aditivo; cooldown de lote; sem rewarded offline neste recorte.
4. **Gerente (§4.6): aprovado somente offline em A-06.** Extras de missões/desconto/VIP
   ficam backlog explícito, não promessas vendidas. Não ampliar nem fingir entrega deles.

**A-06.0–A-06.4 concluídos localmente. A-06.5 pendente.** Próximo: revisão final
das27 trilhas, sem refazer decisões. Ver [step4/README.md](step4/README.md)
para consumidores, gates, vetores, save/UI e desvios econômicos. Nova mudança de contrato
exige novo aceite; nenhum commit/push/PR/merge/arte nova/porta de regras C# nesta etapa.
