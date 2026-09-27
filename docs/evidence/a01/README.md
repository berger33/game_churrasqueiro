# F3 / A-01 — virada obrigatória: evidências e limite de aceite

2026-09-26 local / 27 UTC · branch `arena/01a0e03e-game-churrasqueiro` · PR #14 sem merge.
Baseline: `ec8ce1b` (F2). Decisão do dono registrada em `331e1bb`: **exigir virada**,
`costela`/`cupim` com **2 lados + flipNeeded:true**, rejeitando a recomendação de um lado.

**Resultado: funcional validado; aceite econômico pendente.** Não fechar F3/F4 ou liberar
C#/Unity/merge: o sim longo revela 3 desvios. Nenhum preço, recompensa, janela, tempo,
calor, fórmula do bot ou limite de guardrail foi retunado para tornar o resultado verde.

## Reprodução e regressões

- `red-rules.txt`: suite nova contra os dados/regras antigos, **17 falhas / 2 passes**.
  Falham flags, janelas seguindo a receita, validação semântica e bot equipado nos
  restaurantes 3–6 (cupim só a partir de 4). Os 2 passes confirmam cru→queimado sem virada.
- `red-ui.txt`: **4 falhas / 2 passes** contra a extração das decisões antigas da UI:
  só oito ingredientes e dica imediata. Paginação e dica contextual corrigem esse bloqueio.
- `red-neighbor-hit.txt`: **1 falha / 7 passes**. O harness real também falhou em
  `cupim: tap must flip once and clear the hint`: alvos vizinhos sobrepostos selecionavam
  sempre o primeiro prato. Seleção agora usa o centro mais próximo **dentro** do mesmo alvo
  64×56, sem encolher hitboxes ou mudar regras térmicas.
- Final: **299 testes** em 16 arquivos (272 + 19 de regra + 8 UI), incluindo replay golden
  fortalecido. Cada restaurante/corte elegível tem 8 seeds skill=1 em pedido isolado,
  grelha Fornalha evo 3, paciência 150 s: serve, vira, não queima, pelo menos 75% perfect.
  Essa paciência isola viabilidade física; não é usada para disfarçar o balanço natural.

Dados `ingredients.version` **5→6**, somente os dois flags alterados; Assets/Data sincronizado.
Validador TS rejeita receita grill multi-face sem `flipNeeded`. `policy.ts` já respeitava
esse flag; **nenhuma alteração/tuning no bot**. FTUE guiado e sua tabela não mudaram.

## Janelas reais (ticks de 0,05 s)

`before.json` / `after.json`: produzidos pelo mesmo `tools/studio/slow-cuts-report.ts`
antes/depois dos flags. Grelha default do restaurante 4, sem upgrades, carvão integrado,
virada única conforme a receita em `T/(1+carry)` (T = centro da janela).

| Corte | Zona | Primeira–última amostra perfect | Duração de amostras perfect | Queima |
|---|---|---|---:|---:|
| Costela | baixa (0) | 52,40–60,15 s | 7,80 s | 70,15 s |
| Costela | média (1) | 30,20–34,45 s | 4,30 s | 39,95 s |
| Costela | alta (2) | 20,50–23,30 s | 2,85 s | 26,90 s |
| Cupim | baixa (0) | 62,65–71,75 s | 9,15 s | 82,65 s |
| Cupim | média (1) | 35,85–40,80 s | 5,00 s | 46,85 s |
| Cupim | alta (2) | 24,20–27,40 s | 3,25 s | 31,30 s |

Antes: **zero amostras perfect nas seis combinações**. Zona alta, sem virar: costela
queima em 18,35 s (overall 0,672671), cupim em 21,20 s (0,672039); só cru→queimado.
Continuam impossíveis sem virar após a correção — esse é o comportamento de produto escolhido.
`perfectSec` inclui o último tick (nº de amostras × dt), não é subtração dos endpoints.
Calor/upgrades/grill/cadência alteram os tempos; esta não é uma promessa universal.

## Curva avançada complementar

O sim oficial mede sua curva nos níveis autorais de restaurantes 0/1; ela ficou igual e
**não comprova A-01**. O probe adicional usa 8 seeds, dt=0,05, restaurantes 3–6 com seus
parâmetros naturais, Fornalha evo 3 equipada e zero upgrades. Nenhum pedido/paciência é
forçado. Contagens brutas e qualidade completa estão nos JSONs.

| Restaurante | Perfect skill .30 → .55 → .85 → 1 | Moedas/turno .30 → .55 → .85 → 1 |
|---|---|---|
| 3 | 20,4 → 32,4 → 66,8 → 89,0% | 1690,25 → 2128,50 → 2356,13 → 2459,00 |
| 4 | 20,1 → 34,0 → 64,6 → 90,6% | 2063,75 → 2140,88 → 2518,63 → 2671,88 |
| 5 | 20,3 → 34,9 → 66,2 → 91,2% | 2306,50 → 2409,63 → 2844,13 → 3050,00 |
| 6 | 19,5 → 34,6 → 66,3 → 91,2% | 2546,50 → 2624,13 → 3113,88 → 3290,50 |

Perfect/servidos e renda são crescentes com skill em cada tier. Burned/servidos entre
0–1,0%; perdidos/spawn entre 0–5,2%, **não monotônicos**: política humana com jitter,
multitarefa/espera por ponto, não oracle perfeito. São cenários controlados, não progressão.

## Economia longa: falha preservada

Logs íntegros: `sim-long-before.txt` e `sim-long-after.txt`. Mesma seed/configuração oficial,
1.500 turnos, dt=1/12, jogador em progressão; nível final 80, restaurante 6, Fornalha evo 3.

| Métrica | Antes | Depois |
|---|---:|---:|
| Renda | 14.665.839 | 22.675.447 |
| Gasto | 10.873.220 | 10.873.220 |
| Saldo | 3.792.619 | 11.802.227 |
| Spend ratio | 0,741 | **0,480 (falha; mínimo 0,70)** |
| Perfect | 71,8% | 75,9% |
| Burned/servidos | 5,7% | 0,2% |
| Clientes perdidos | 6,9% | 3,7% |
| Duração média | 169,8 s | 173,4 s |
| Restaurantes (turnos) | 32/89/147/243/418/1185 | 32/89/147/239/383/**859** |
| Churrasqueiras (turnos) | 7/45/90 | 7/45/90 |
| Renda diária L5/L15/L30/L50 | 10.793/41.115/98.262/115.926 | 10.793/41.115/114.616/**182.381** |
| Alvos | 18/18 | **15/18; exit 1** |

Outras falhas: Rede Nacional **859** vs 950–1450; L50 **182.381** vs 98.000–152.000.
Renda ~54,6% maior: antes o bot falhava justamente nos cortes caros. Sinks iguais, não
aprova o desenho dos sinks: A-06/no-ops continua pendente. Gap Festival→Rede passa de 767
para 476 turnos. Não adotar 859/0,480/182.381 como novos alvos sem decisão econômica.
`npm run sim` curto segue verde (18 checks, parte SKIP por horizonte): não substitui longo.

## Revisão semântica dos vetores

- Antes de gerar: `check-vectors` detectou drift nas versões. `verify-schemas` e
  `check-csharp-types` passaram; **nenhum schema, level autoral ou tipo C# regenerado**.
- Os **98 vetores antigos mantêm input/expect integralmente**, assim como todos os
  **44 FTUE**. Só `dataVersions.ingredients` 5→6 nos dois documentos.
- Cooking antigo integra sem virada; scoring usa faces artificiais iguais; casos flip
  chamam `flipFood` diretamente (que já permitia virar). Nenhum deles dependia do flag.
- **8 turnos avançados novos**: restaurantes 3–6 × skills .55/.85, seed 4242, dt=1/16,
  Fornalha evo 3. Todos servem costela e, de 4 em diante, cupim. Valores/contagens completos
  em `tools/golden/vectors.json`; há inclusive queimados/desistências reais, não zerados.
  Cobertura retém identidades observadas antes da compactação dos arrays e distingue
  serve de discard pelos `fulfilledBy` dos pedidos; contar `sim.foods` no fim seria falso.
- Total **106 + 44**: cooking 48, scoring/flip 32, economy 6, turns 20. Replay TS confere
  resultado repetido, tempo final, contadores e uso real dos cortes. Os 8 turnos são
  fixtures de paridade, não campanha nova. C# sem porta passa a **25 not ported** (5+20).

## UI e limites

- Paginação 8 itens/página, botão 140×56 na área livre da segunda linha; drawing e
  pickup usam a mesma lista. C-06 resolvido **só quanto à truncagem**; dívida l10n restante
  não está encerrada. Textos de virada dos cortes + botão localizados pt/en/es.
- Dica normal usa a prontidão contextual do FTUE + flag da receita: espera dourar,
  não recomenda virar cru/fora da grelha, some ao virar. Sem alterar roteiro guiado.
  Se o jogador deixar uma face voltar a ficar desequilibrada, pode sugerir outra virada.
- `check-shots` gera **17 PNGs** (antes 13), 244 sprites: página 2, dica, janela perfeita
  de cada corte via drag/tap reais, inclusive vizinhos. Hook é observação readonly.
  Fixture usa nível inicial no restaurante 4 + save com grill comprado; **não prova
  desbloqueio natural de restaurantes no protótipo** (só 60 níveis autorais 0/1).
- FTUE preservado: primeiro perfect 16,1 s, completo 32,9 s, upgrade 38,3 s, zero misses.
  Inspeção visual: pager/cortes visíveis; rótulos de pratos adjacentes ainda se sobrepõem
  (polish futuro), promessa de quarta fileira continua A-04. Nenhuma arte foi gerada.

## Reproduzir

```sh
npm ci
npx vitest run tools/studio/test/slow-cuts.test.ts tools/studio/test/cooking-ui.test.ts tools/studio/test/golden.test.ts
node --experimental-strip-types tools/studio/slow-cuts-report.ts > /tmp/a01-probe.json
npm run gates
npm run sim:long                 # esperado: exit 1, três alvos reais falhando
npm run check-shots             # prototype/shots/14…17 (artefatos ignorados pelo Git)
```

Gates locais: **14/15**; C# SKIP sem SDK. Auditoria npm: 5 vulnerabilidades
(1 crítica, 1 alta, 3 moderadas), lock/dependências intactos, sem force-fix.
CI remoto A-01: **15/15** em `8b042ca`, [run 36285270473](https://github.com/berger33/game_churrasqueiro/actions/runs/36285270473),
139 checks C# / 25 not ported. Dispatch manual Nightly negado por permissão da integração
(403); o longo foi executado **localmente**, duas vezes com saída idêntica. Commits finais:
consultar plano §9.10 e corpo do PR #14.
Próximo checkpoint funcional é **A-02**, ainda dentro de F3; transportar estes 3 desvios
para F4, só depois de A-02–A-06, sem chamar A-01 economicamente encerrado.
