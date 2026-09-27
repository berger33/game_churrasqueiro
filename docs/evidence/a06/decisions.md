# A-06 — decisões do dono

**Data: 2026-09-27.** Registradas a partir das escolhas explícitas na conversa.
Branch `arena/01a0e099-game-churrasqueiro`; base `e50ce15` + A-03/A-04/A-05 locais.

## 1. Escopo e compras históricas — primeira rodada

| Pergunta / ID | Escolha do dono | Consequência |
|---|---|---|
| `a06_scope` | `design_all` — Definir todas as regras faltantes | Apresentar automação, carvão, estoque, serviço e offline para aprovação antes do código; dividir em subetapas. Apenas desabilitar as trilhas indefinidamente não encerra A-06. |
| `a06_legacy` | `preserve` — Preservar níveis, sem reembolso automático | Manter progresso e níveis comprados, sem devolução estimada pela tabela nem exclusão de níveis. Bloquear novas compras incompletas temporariamente não revoga o histórico. |

## 2. Contrato mecânico — segunda rodada

O dono recebeu [design-proposal.md](design-proposal.md), aberto no viewer, e o resumo dos
pontos novos antes de responder. As quatro respostas vieram sem texto customizado.

| Pergunta / ID | Escolha explícita | Contrato aprovado |
|---|---|---|
| `a06_resources` | `approve` — Aprovar recursos propostos | §§4.3–4.4: estabilidade recupera parte da perda de eficiência; qualidade eleva o piso; auto-carvão33/66/99%, uma tentativa por saco; estoque6 + nível por ingrediente, reposição gratuita3s. |
| `a06_service` | `approve` — Aprovar serviço e equipe | §§4.2/4.5: Mesas + Capacidade somam vagas; Bandeja acelera Garçom e depende dele; cadências/coberturas/benefícios por nível e caps estritos; nenhuma escolha de zona ou garantia de ponto perfeito. |
| `a06_offline` | `approve_index3` — Aprovar no índice 3 (design) | §4.6: Churrascaria de Bairro, quarto restaurante; cálculo/ledger/coleta reais, cap8h, Caixa antecipa parcela, bônus aditivos, cooldown e persistência conforme contrato, sem rewarded offline neste recorte. Não foi escolhida a alternativa índice1. |
| `a06_manager_scope` | `offline_only` — Offline agora; extras no backlog | Gerente implementa +18%/nível offline em A-06. Rerolls de missões, descontos10/15% e +2pp VIP ficam explicitamente futuros, sem promessa de benefício ativo. Não foi escolhida a expansão de escopo para esses sistemas. |

O documento detalhado é o contrato de implementação, inclusive conservação de crédito
na divisão Caixa/manual, snapshots offline, gates/normalização, concorrência, regras de
estoque, cobertura pequena, UI e requisitos de prova. As fórmulas aprovadas não autorizam
retuning posterior para ocultar as três falhas econômicas conhecidas.

## 3. Estado no encerramento de A-06.0 (histórico; avanço em §4)

- **A-06.0, diagnóstico/design: concluído.**
- **A-06.1–A-06.5: não iniciados.** Nenhuma regra de produção, compra, preço ou save alterado
  por esta etapa. Nenhuma regressão red de correção A-06 escrita/rodada ainda.
- Próximo: A-06.1, regressões red antes de compras compartilhadas UI/serviço/bot,
  catálogo27/histórico, Capacidade/Mesas e prestígios de turno. Depois recursos, equipe,
  offline e fechamento completo com economia1500.
- Não repetir essas seis perguntas. Nova alteração do contrato exige nova aprovação.
- Manter decisões A-01/A-04/A-05, receita/prep/FTUE e claims existentes. Não portar para C#,
  criar arte, fazer push/merge ou declarar paridade/SDK/dispositivo/publicação a partir
  deste aceite de design.
- Números de testes/gates/economia A-05 continuam baseline, não validação das regras A-06.
  Nenhum commit, push, PR ou merge novo. A-06/F3/F4/economia global continuam abertos.


## 4. Atualização A-06.1

Compras/efeitos diretos concluídos e validados localmente conforme contrato.16 trilhas
integradas,11 pendentes protegidas; níveis históricos preservados. Provas e economia em
[step1/README.md](step1/README.md). Próximo A-06.2, recursos, **sem nova rodada de escolhas**.
Este registro conserva o histórico de aprovação; não reinterpreta A-06.1 como todo A-06.

## 5. Atualização A-06.2

Recursos aprovados agora implementados/validados localmente;20 trilhas integradas/7 pendentes.
Histórico preservado sem reembolso; nenhum preço/máximo/meta retunado. Relatório em
[step2/README.md](step2/README.md). Próximo A-06.3/equipe, **sem nova rodada de escolhas**.
A-06/F4 ainda abertos; A-06.4 offline e A-06.5 revisão27 não foram antecipados.

## 6. Atualização A-06.3

Equipe/Bandeja implementadas/validadas localmente;24 trilhas integradas/3 pendentes.
Serviço desde bom reduz perfeitos na campanha: consequência registrada, não escondida por
retuning. Níveis/preços/limites preservados. [step3/README.md](step3/README.md).
Próximo A-06.4, offline/ledger/claims no índice3 conforme aprovação existente; Gerente
missões/descontos/VIP continuam backlog. A-06.5/F4 ainda abertos. Nenhuma autorização de publicação.

## 7. Atualização A-06.4

Offline/ledger implementados e validados localmente conforme §4.6.27 trilhas integradas;
Caixa/Gerente/Logística têm consumidores reais. Índice3,8h, rampa, snapshots, claims/XP,
cooldown e histórico preservados. [step4/README.md](step4/README.md).
Campanha ativa15/18 ainda falha; ausências medidas separadamente, sem retuning.
Próximo A-06.5 (revisão final), depois F4; nenhuma nova autorização de publicação/porta.

## 8. Reabertura econômica A-06.4 — autorização explícita posterior

O dono exigiu resolver os3 critérios antes de avançar para A-06.5. Apresentado o conflito
com a proibição anterior de retuning e a ausência de compras restantes, respondeu:
`a064_economic_scope` → **`late_income` — Rebalancear a renda tardia**.
Autoriza revisar a curva de moedas do jogo, preservando preços, compras históricas, FTUE,
regras offline e metas. **Não escolheu novos gastos.** A proibição anterior continua valendo
fora deste recorte; a autorização não é licença para modificar alvos ou tuning futuro livre.

Implementado `economy14`: fator por restaurante0–3=1,4=.85,5=.62,6=.48 nos pratos ativos,
um único arredondamento final, mesmo scorer manual/staff/VIP/browser. XP, taxas offline,
preços, bônus de fase/nível e progresso intactos. UI explicita a taxa. Sem novas moedas/gastos.
Campanha1500 **18/18** (repeat idêntico,2 seeds adicionais também18/18),672 testes,
53 capturas,157+44 vetores;14/15 gates, C# SKIP. Contratos/diffs/resultados em
[step4/reopened/README.md](step4/reopened/README.md). A-06.5 não iniciada; sem publicação/porta.
