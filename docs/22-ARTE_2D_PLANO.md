# 22 — Plano de Arte 2D Profissional (gerada por IA, em lotes de 10)

**Atualizado:** 2026-09-26 · branch `arena/01a0e001-game-churrasqueiro`
**Status:**

- Lotes 01–02 e 04–11 **aprovados**; assets empacotados e usados pelo protótipo conforme descrito em §7.1 (a integração varia por família).
- As **33 substituições individuais foram concluídas e aprovadas** nas quatro rodadas 08–11; não resta nenhum asset `pending` no registro.
- Lote 07 (10 imagens, 34 sprites) **aprovado pelo dono em 2026-09-26**; incluído no runtime do protótipo.
- Lote 08 (10 imagens → 10 sprites: os 9 ícones centrais de UI + `ic_grill_size`) foi **aprovado pelo dono em 2026-09-26** e integrado.
- Lote 09 (10 imagens → 10 sprites: 8 ícones de upgrade + 2 fundos) foi **aprovado pelo dono em 2026-09-26**; a decisão incluiu o Espetinho de Rua com dois carrinhos espelhados.
- Lote 10 (10 imagens → 10 sprites: estados de grelha de contra-filé e maminha) foi **aprovado pelo dono em 2026-09-26** e integrado.
- Lote 11 (3 imagens: dois pratos servidos + Churrascaria de Bairro) foi **aprovado pelo dono em 2026-09-26** e integrado. Runtime final aprovado: **244 sprites, 3,98 MB WebP**, com 16 comidas e 7 fundos.
- A aprovação e presença no bundle não significam que as novas telas de coleção, eventos, loja/IAP, passe, mapa ou conquistas estejam implementadas; ver §7.1.
- A cobertura final por família está em §2.

> **Por quê.** A mecânica agrada, mas o visual do protótipo (tudo desenhado por código em
> `prototype/src/foods.ts`, `theme.ts` e `main.ts`) ainda parece amador. Este plano troca cada
> desenho procedural por arte pintada, gerada com IA e revisada por uma pessoa. O trabalho
> anda em lotes de 10 imagens, e cada lote precisa de aprovação antes do próximo.

---

## 0. Resumo

| Etapa | O que sai | Onde |
|---|---|---|
| 1. Prompt | texto exato de cada imagem, versionado | `art/prompts/lote-NN.md` |
| 2. Geração | 10 imagens brutas em fundo magenta chapado | `art/source/lote-NN/` (fora do git, §8) |
| 3. Recorte | sprites com transparência, nomeados, com pivô | `Assets/Art/**` + `sprites.manifest.json` |
| 4. Registro | 1 linha por sprite (`status=pending`) | `Assets/Art/ASSET_REGISTRY.csv` |
| 5. Revisão | folha de contato + montagem no layout do jogo | `art/review/lote-NN*.jpg` |
| 6. Aprovação | "ok" do dono do jogo → `node tools/art/set-status.mjs lote-NN approved` | registro + este documento |
| 7. Integração | sprites no protótipo (fallback procedural mantido) e no Unity | §7 |

Uma imagem gerada rende vários sprites. Exemplo: uma folha 2×3 de picanha vira os 5 estados de
cozimento mais o prato servido. O lote 01 transformou **10 imagens em 43 sprites**, e o lote 02
em **50**.

---

## 1. Direção de arte

A bíblia continua sendo `docs/04-ART_STYLE.md`: as regras R1–R5, a paleta quente e a regra §6
("o ponto é material, não forma"). Nesta fase, a bíblia vira instruções concretas para a IA:

- **Estilo:** pintado à mão, semi-realista estilizado, volume 3D suave, contorno marrom-escuro
  sutil, brilho de gordura/suco, no nível dos jogos de culinária casual do topo das lojas.
- **Luz:** golden hour vinda de cima à esquerda, **nunca** luz fria (regra R4).
- **Câmeras fixas por família** (a coerência entre lotes depende disso):
  - comida: ¾ vista de cima, a cerca de 55°, peça **deitada na horizontal** (o eixo da grelha);
  - churrasqueiras e props: ¾ frontal, abertura/tampo com a borda de cima **horizontal**;
  - clientes: busto de frente, fundo limpo, **sem roupa magenta ou rosa-choque** (é a cor do recorte);
  - fundos: 9:16, cena sem personagens, com espaço livre no terço central para a churrasqueira.
- **Consistência:** a primeira imagem aprovada de cada família vira referência (`images: [...]`)
  das seguintes. Todas as comidas do lote 01 foram geradas com a picanha como guia. As
  referências são **remontadas a partir dos masters** com `tools/art/make-ref.mjs` (sprites
  recolocados sobre magenta, no layout pedido), porque os brutos não sobrevivem a um reset
  (§8). A evo 1 da lata como referência segurou a câmera das evoluções 2 e 3: a boca inclina
  −8,6°, −8,7° e −8,8°.
- **Sem texto dentro da arte.** Todo texto é desenhado pelo jogo (localizável, §56). Quando o
  modelo escreve legendas, o recorte as descarta (§4).

### 1.1 Blocos fixos do prompt

Todo prompt tem três partes, e só a do meio muda:

1. **Estilo** (fixo): o parágrafo acima, em inglês. Os modelos de imagem seguem melhor instruções em inglês.
2. **Assunto e layout** (varia): o que desenhar, grade/quantidade, câmera e estados.
3. **Técnico** (fixo): fundo inteiro #FF00FF chapado, sem gradiente, chão, sombra projetada,
   linhas de grade, texto, marca d'água ou moldura, e muito espaço magenta entre os itens.

O texto exato está em `art/prompts/lote-NN.md`. A partir do lote 02, cada prompt é gravado
**antes** de gerar, e o lote 02 incorpora as correções do lote 01 (§6.1).

---

## 2. Auditoria: o que o jogo precisa (todos os itens, 2026-09-25)

Contado a partir de **todas** as tabelas de `shared/data` (e não de estimativa). Legenda:

- ✅ arte aprovada e masters no repositório (a presença no runtime ou a integração da tela é indicada à parte);
- 🟡 em lote entregue, aguardando decisão do dono (lote indicado);
- 🔁 refazer;
- ⬜ falta.

| Família | Fonte nos dados | Precisa | Situação |
|---|---|---|---|
| Comidas (5 estados + servido) | `ingredients.json` (16) | 16 folhas | ✅ 16 (contra-filé e maminha concluídos nos lotes 10–11) |
| Churrasqueiras × evolução | `churrasqueiras.json` (4 × 3) | 12 | ✅ 12 (evoluções 2–3 de chapa, inox e fornalha concluídas no lote 06) |
| Fundos dos restaurantes | `restaurants.json` (7) | 7 | ✅ 7 (Churrascaria de Bairro concluída no lote 11) |
| Clientes | `customers.json` (11 tipos) | 11+ | ✅ 11 tipos, 14 retratos (variantes a/b) |
| Funcionários | `employees.json` (5 cargos) | 5 | ✅ 5 (lote 05) |
| Ícones de interface | moedas (`economy.json`: `ic_coin`, `ic_ember`) + HUD, diária, resultado | 9 | ✅ 9 (refeitos e aprovados no lote 08) |
| Ícones de upgrade | `upgrades.json` (`tracks[].icon`, 27) | 27 | ✅ 27 (18 no lote 05 + 1 no lote 08 + 8 no lote 09) |
| Ícones de cosméticos | `upgrades.json` (`cosmeticTracks`, 5) | 5 | ✅ 5 (lote 05; fiação nos dados: docs/23 passo 1.5) |
| Coleção: itens | `collection.json` (37 entradas) | 37 | 16 usam sprites de comida (✅ 16) · ✅ 21 próprios (4 molhos, 9 equipamentos, 6 grillSkin, Coroa da Brasa, Medalha da Picanha; lotes 06–07) |
| Coleção: categorias | `collection.json` (10) | 10 | ✅ 10 (lote 05) |
| Eventos | `events.json` (4 semanais + 7 sazonais) | 11 | ✅ 11 banners (lote 07; telas/fluxos de evento não integrados) |
| Loja (IAP) | `iap.json` (7 produtos) | 7 | ✅ 7 ilustrações (lote 07; loja/fluxo de compra não integrado) |
| Brasa Pass | `pass.json` | 1–2 | ✅ arte da temporada (lote 07; tela/passe não integrado) |
| Mapa / rota | `regions.json` (5) + `route.json` (16 paradas) | 1–2 | ✅ fundo ilustrado (lote 07; divisões internas não cartográficas; rota/pins não integrados) |
| Conquistas | `achievements.json` (58) | molduras por nível | ✅ 5 molduras tiers 1–5 (lote 07; tela de conquistas não integrada) |
| Brasas / VFX | `grill.json` (3 zonas) + efeitos | 3 + ~12 | ✅ brasas (3) + 10 VFX de fumaça, faíscas, moedas e comemoração (lote 06) |
| Props | cenas de `restaurants.json` | 1 + ~4 | ✅ bancada · ⬜ tábua, pratos, pegador |
| Loja das stores | `docs/15-ASO.md` | 5 | ⬜ 3 conceitos de ícone, feature graphic, key art |

**Totais:**

- 86 imagens aprovadas (lotes 01–02, 04–11) viraram 244 sprites no runtime do protótipo (3,98 MB WebP);
- as 33 substituições individuais do antigo lote 03 foram concluídas e aprovadas em
  10 + 10 + 10 + 3 imagens nos lotes 08–11; as 3 churrasqueiras antigas já haviam sido
  refeitas e aprovadas no lote 04;
- o lote 07 concluiu as artes de coleção, eventos, IAP, Brasa Pass, mapa, molduras de conquistas e key art;
- permanecem itens da auditoria marcados ⬜, incluindo as peças de ASO/store, props e refações futuras. Elas ficam para o lote 12 ou posterior; consultar a tabela, sem inferir aprovação ou integração de telas.

O logotipo continua tipográfico (Baloo 2 com efeitos): texto gerado por IA erra letras.

**Ordem = primeira aparição no jogo.** A ordem sai dos níveis de desbloqueio:

| Nível | O que aparece |
|---|---|
| desde o início | ícones de interface e o card de upgrade do passo 6 do FTUE |
| 1–8 | comidas iniciais |
| 4 | chapa |
| 8 | inox e Espetinho de Rua |
| 14 | fornalha |
| 16 | trailer |
| 22–44 | carnes nobres (22 contra-filé, 26 maminha, 34 costela, 44 cupim) |
| 24 | churrascaria de bairro |
| 34 | premium |
| 46 | festival |
| 60 | rede nacional |

## 3. Pipeline: da imagem ao asset

```
prompt ─► generate_image ─► art/source/lote-NN/*.png   (RGB, fundo ≈ magenta)
                                  │  art/lote-NN.json  (como recortar cada imagem)
                                  ▼
                 node tools/art/process-sprites.mjs art/lote-NN.json
                                  │
        ┌─────────────────────────┼──────────────────────────────┐
        ▼                         ▼                              ▼
 Assets/Art/**/*.png     Assets/Art/sprites.manifest.json   Assets/Art/ASSET_REGISTRY.csv
 (masters PNG, Unity)    (tamanho, pivô, furo da grelha,    (1 linha por sprite,
                          estados de cada comida)             status=pending)
                                  │
                 node tools/art/review-sheet.mjs art/lote-NN.json
                                  ▼
            art/review/lote-NN.jpg (folha)  +  lote-NN-preview.jpg (montagem)
                                  │  aprovação do dono
                                  ▼
            node tools/art/set-status.mjs lote-NN approved   (registro: approved)
```

Referências para o lote seguinte: `node tools/art/make-ref.mjs grid|single …` monta a imagem
de referência a partir dos masters aprovados.

Os scripts são determinísticos e rápidos (cerca de 3 s por lote). Rodar de novo depois de
melhorar o recorte **não** perde aprovações: uma linha revisada fica congelada (`status`,
`source` e `notes`). Se o bruto de uma imagem não existe mais, o recorte pula essa imagem e
mantém os masters já versionados (testado com o lote 01).

---

## 4. Recorte (`tools/art/process-sprites.mjs`)

O gerador devolve RGB sem alfa, com um magenta que nunca é exatamente #FF00FF e varia por
imagem (lote 01: R 247–254, G 5–31, B 240–250). Removedores de fundo por rede neural
precisam baixar modelos de fontes bloqueadas neste ambiente, então o recorte é feito à mão, por
cor:

1. **Cor-chave por imagem:** mediana dos pixels magenta da borda.
2. **Alfa pelo excesso de magenta**, `m = min(R,B) − G`: opaco até 16 % do excesso da chave,
   transparente a partir de 78 %, com rampa suave entre os dois. Rosa de linguiça crua
   (`m≈20`) e vermelho de carne ficam opacos; só o magenta saturado some.
3. **Des-mistura da borda:** `F = (P − (1−a)·K) / a`, mais *despill* do magenta restante. Não
   sobra auréola rosa. Verificado a 1:1 sobre fundo claro e cinza, com **0 pixels magenta
   residuais** nos 43 sprites. Pixels internos parcialmente transparentes (um brilho rosado
   dentro da comida) são forçados a opacos.
4. **Linhas de grade:** o modelo desenha as linhas mesmo quando proibidas. Linhas finas e retas
   de tom magenta, com fundo dos dois lados, são apagadas (lote 01: 7,6 mil a 11,8 mil px por folha de comida).
5. **Componentes 8-conexos:** por célula, fica a maior peça e as partes grandes ligadas a ela.
   Letras de legenda são componentes minúsculos e caem sozinhas. Por isso as legendas que o
   modelo escreveu no pão de alho sumiram.
6. **Modos** (definidos por imagem em `art/lote-NN.json`):
   - `grid`: folha de estados (2×3);
   - `components`: vários objetos soltos, nomeados pela posição mais próxima;
   - `strips`: faixas empilhadas que viram texturas opacas;
   - `single`: um objeto, opcionalmente com furo interno; também serve para um quadro de comida
     por imagem quando o spec declara `alignGroups`;
   - `opaque`: fundo de cena.
7. **Estados da mesma comida:** giram juntos para a horizontal (`maxTiltDeg`; o espetinho saiu a
   ~25° e foi endireitado), são igualados pela área da máscara (a IA varia o tamanho entre
   células), são centrados pelo centróide e dividem **a mesma tela e o mesmo pivô**. A regra vale
   tanto para folhas `grid` quanto para quadros individuais reunidos em `alignGroups` (lote 10).
   Assim o crossfade entre estados vizinhos nunca "pula" o contorno (regra §6 da bíblia). Itens
   de preparo (`kind: "prep"`, hoje só o vinagrete) mudam de forma de propósito (tábua → tigela)
   e usam `align: false`.
8. **Furo da churrasqueira:** a boca pintada em magenta vira região transparente fechada. O
   script grava no manifesto a `bbox`, o quadrilátero `quad` (TL, TR, BR, BL) e a inclinação
   `tiltDeg`. Os cantos saem dos extremos diagonais ou dos extremos de eixo, o que cobrir mais
   área, e assim funciona tanto para boca reta quanto para boca inclinada.

Limites conhecidos: qualquer coisa pintada em magenta saturado vira transparente. Os prompts
proíbem roupa e props magenta; a camisa salmão da mãe (lote 01) passou porque não é magenta.

---

## 5. Revisão e aprovação: o ciclo de cada lote

1. Gerar as 10 imagens, processar e rodar `review-sheet`.
2. Revisar cada asset contra o checklist anti-"cara de IA" (`docs/04` §10), acrescido de:
   - mãos e dedos;
   - texto acidental;
   - perspectiva e câmera da família;
   - mesmo contorno entre estados;
   - restos de magenta;
   - legibilidade no tamanho real do jogo (44×17 px para espetinhos, 54×25 px para as demais comidas, ícones de 22–34 px);
   - teste do ícone de 48 px em cinza.
3. Entregar a folha de contato, a montagem e a lista de defeitos, e **pedir aprovação**.
4. Aprovado: `node tools/art/set-status.mjs lote-NN approved`, que grava `status=approved` e
   `source=ai-assisted-reviewed` (ciclo em `docs/04` §11). Recusado: `status=rejected`, e a
   refação entra no topo do próximo lote. Trocado por uma versão melhor: `superseded`.
5. **Nunca** usar a montagem de prévia como screenshot de loja: as capturas da loja têm que
   ser do jogo rodando (`docs/15-ASO.md` §5, `docs/13-RELEASE.md` §3). A montagem traz esse
   aviso escrito nela.

---

## 6. Lotes

| Lote | Conteúdo (10 imagens) | Status |
|---|---|---|
| **01** | picanha, linguiça toscana, pão de alho, queijo coalho, espetinho misto · churrasqueira lata (evo 1) · fundo quintal · brasas (3 calores) · bancada · clientes A | **aprovado e integrado** |
| **02** | espetinho de frango, coração, coxa, asinha, fraldinha, legumes, vinagrete · clientes B (+ turista com camisa floral) · lata evo 2 e evo 3 | **aprovado e integrado** |
| **03** | 9 ícones de interface · 9 ícones de upgrade · chapa, inox e fornalha (evo 1) · fundos espetinho de rua, trailer, churrascaria de bairro · contra-filé, maminha | lote antigo em substituição; restam 3 imagens, alocadas ao lote 11 |
| **04** | refação de chapa, inox e fornalha (evo 1) **com guia de layout** (3 imagens) | **aprovado e integrado 26/09** |
| **05** | costela, cupim · ícones de upgrade 2/3 e 3/3 · cosméticos (5) · funcionários (5) · fundos premium, festival e rede nacional · categorias da coleção (10) — 53 sprites | **aprovado e integrado 26/09** |
| **06** | evoluções 2 e 3 de chapa, inox e fornalha (6) · VFX: fumaça/faíscas, PERFEITO/moedas/confete (2 folhas) · coleção: molhos e equipamentos (2 folhas) | **aprovado e integrado 26/09** |
| **07** | coleção: churrasqueiras especiais + medalha · banners de eventos (11, em 3 folhas) · arte da loja/IAP (7 produtos, 2 folhas) · Brasa Pass · mapa da rota · medalhas de conquista · key art da tela-título | **aprovado e empacotado 26/09** |
| **08** | refação individual dos pending do lote 03 (1/4): 9 ícones centrais de UI + `ic_grill_size` | **10/10 aprovados e integrados; runtime 221** |
| **09** | refação individual (2/4): 8 upgrades + fundos Espetinho de Rua e Trailer | **10/10 aprovados e integrados; runtime 231** |
| **10** | refação individual (3/4): `raw`/`rare`/`medium`/`well`/`burned` de contra-filé e maminha | **10/10 aprovados e integrados; runtime 241** |
| **11** | refação individual (4/4): os dois pratos `served` + fundo Churrascaria de Bairro | **3/3 aprovados e integrados; runtime final 244** |
| **12+** | loja das stores (3 conceitos de ícone, feature graphic) · demais sobras/refações | planejado |

### 6.1 Resultado do lote 01

| # | Imagem | Sprites | Avaliação |
|---|---|---|---|
| 1 | `food_picanha` | 6 | ✅ excelente; os 5 estados mantêm o contorno; serve de referência para as outras comidas |
| 2 | `food_linguica_toscana` | 6 | ✅ |
| 3 | `food_pao_de_alho` | 6 | ✅ o modelo escreveu legendas; o recorte descartou todas |
| 4 | `food_queijo_coalho` | 6 | ✅ |
| 5 | `food_espetinho_misto` | 6 | ✅ gerado na diagonal; os 5 estados foram girados juntos para a horizontal |
| 6 | `grill_lata_valente` | 1 + furo | ✅ vista oblíqua (boca inclinada −8,6°), **mantida por decisão**: a lata tem 1 zona e 2–3 vagas em todas as evoluções, e o jogo mapeia as vagas no quadrilátero do furo. As churrasqueiras de 2–3 zonas serão pedidas de frente |
| 7 | `bg_quintal` | 1 | ✅ excelente: fim de tarde, varal de lâmpadas, bananeira, piso de terracota |
| 8 | `fx_brasas` | 3 | ✅ mesmo desenho nos três calores, só muda a intensidade |
| 9 | `prop_bancada` | 1 | ✅ usável: é uma mesa em perspectiva e cabe na tela escalada além das bordas (a montagem mostra) |
| 10 | `char_clientes_a` | 7 | ✅ o modelo fez 7 retratos em vez de 6 (dois "apressado" viram variantes a/b). O **turista sem camisa** contradiz o `look` de `customers.json` (`camisa_floral`): foi mantido, e o lote 02 traz versões com camisa para escolha |

Aprovado pelo dono em 2026-09-25 ("prosseguir para o próximo lote").

Divergências menores entre a arte aprovada e os dados, para decidir na integração:

- o `look` do `apressado` pede boné, uniforme e crachá, e a arte mostra um executivo olhando o relógio;
- o `look` do `tio_do_churrasco` pede careca, barba, camisa aberta e óculos, e a arte mostra boné, bigode e avental;
- a descrição da lata fala em "lata de 18 litros", e a arte é um tambor cortado.

O `look` só alimenta o avatar procedural, que vira fallback. O caminho mais barato é ajustar os
dados e o texto à arte aprovada.

**Lições aplicadas ao prompt do lote 02:**

- "exatamente N itens, um por célula, com margem magenta larga";
- "sem letras, números ou legendas em lugar nenhum";
- "vista frontal simétrica, borda de cima horizontal" para grelhas e props;
- "nenhuma roupa rosa ou magenta" para personagens;
- sempre passar uma imagem aprovada da mesma família como referência.

### 6.2 Resultado do lote 02

| # | Imagem | Sprites | Avaliação |
|---|---|---|---|
| 1 | `food_espetinho_frango` | 6 | ✅ gerado inclinado (~20°); os estados foram girados juntos |
| 2 | `food_coracao_frango` | 6 | ⚠️ o **selado** saiu mais claro que o cru e o ao ponto: no crossfade a cor vai de escuro a claro e volta a dourado. Usável; refazer só se incomodar |
| 3 | `food_frango_coxa` | 6 | ✅ |
| 4 | `food_asinha_frango` | 6 | ✅ |
| 5 | `food_fraldinha` | 6 | ✅ fibra longa, sem capa de gordura; servida fatiada contra a fibra |
| 6 | `food_legumes_grelhados` | 6 | ✅ a bandeja de ferro mantém o contorno em todos os estados |
| 7 | `food_vinagrete` | 4 | ✅ item de preparo: ingredientes → picado → pronto → servido |
| 8 | `char_clientes_b` | 8 | ⚠️ pedidos 6 em 2×3, vieram **8** em 2×4. Os extras viram variantes b: um rival homem e um turista sem câmera. Todos seguem o `look` dos dados (o chinelo do vizinho não aparece num busto) |
| 9 | `grill_lata_valente_evo2` | 1 + furo | ✅ Tijolinho de Apoio: mesmo tambor, sobre tijolos, com remendos rebitados |
| 10 | `grill_lata_valente_evo3` | 1 + furo | ✅ Aprovada pela Vó: pintada, base de alvenaria, pano de prato xadrez e vasinho de ervas |

**O que as correções de prompt resolveram:** nenhuma linha de grade e nenhuma legenda nas 10
imagens (no lote 01, 6 imagens tinham linhas e 1 tinha legendas). **O que não resolveram:** a
contagem de retratos (7 no lote 01, 8 no lote 02). Os extras não se perdem, porque o recorte os
nomeia pela posição e eles viram variantes.

---

### 6.3 Resultado do lote 03

| # | Imagem | Sprites | Avaliação |
|---|---|---|---|
| 1 | `ui_icons_core` | 9 | ✅ moeda, brasa, estrela, relógio, chama, check, baú, booster, cadeado: família coesa, lê a 32 px e em cinza |
| 2 | `ui_icons_upgrades_a` | 9 | ✅ nomes = ids de `upgrades.json` (`ic_grill_size` … `ic_board`) |
| 3–5 | chapa, inox, fornalha (evo 1) | 3 | 🔁 o modelo leu "a boca voltada para quem olha" ao pé da letra e desenhou **janelas frontais**. A boca ocupa 5–6 % do sprite (na lata, 20 %) e fica inclinada ±9°. Na tela de 420 px, a grelha de 3 zonas ficaria com ~135×72 px. Materiais e detalhes estão bons (inox com termômetro, dragãozinho na chaminé) |
| 6–8 | fundos espetinho de rua, trailer, bairro | 3 | ✅ noite com poste e carrinho; trailer com neon de chama e linguiça (sem letras); salão com adega e luminárias |
| 9 | contra-filé | 6 | ✅ |
| 10 | maminha | 6 | ⚠️ pouco triangular: parecida com o contra-filé |

### 6.4 Técnica nova para o lote 04: guia de layout

Descrever a câmera com palavras falhou duas vezes nas churrasqueiras: a lata saiu oblíqua e
as três novas saíram como janelas. No lote 04, a referência passada ao modelo será um **guia de
layout** desenhado por script: silhueta simples da churrasqueira com a boca magenta na
proporção e na posição exatas (~1,4:1, ≥ 75 % da largura, borda de cima horizontal), sobre
magenta. O modelo pinta por cima da composição dada, em vez de interpretar "vista de cima".
Os guias entram em `tools/art/make-ref.mjs` como um modo novo.

### 6.5 Resultado do lote 05

| # | Imagem | Sprites | Avaliação |
|---|---|---|---|
| 1 | `food_costela` | 6 | ✅ grelha de 3 costelas com ossos; contorno mantido nos 5 estados; servida na tábua oval com flor de sal |
| 2 | `food_cupim` | 6 | ✅ triangular com capa de gordura; servido fatiado em leque |
| 3 | `ui_icons_upgrades_b` | 9 | ✅ balcão, pratos, bandeja, ampulheta com coração, mesa, planta, luminária, porta aberta, letreiro: família coesa com a folha (a), lê a 32 px e em cinza |
| 4 | `ui_icons_upgrades_c` | 9 | ✅ violão, cloche, balde de carvão, garfo de churrasco, caixa registradora, prancheta, louros com brasa, rostinhos, coroa com lojas |
| 5 | `ui_icons_cosmetics` | 5 | ✅ avental, touca, faca dourada, churrasqueira vermelha, neon de chama; 3 avisos "touches cell edge" no recorte, sem sangramento visível |
| 6 | `char_funcionarios` | 5 | ✅ exatamente 5 bustos, um por cargo, sem roupa magenta; avatares circulares legíveis |
| 7–9 | fundos premium, festival, rede | 3 | ✅ salão nobre com adega; festival ao crepúsculo sem pessoas; flagship com vista da cidade; 9:16, sem texto |
| 10 | `ui_icons_collection` | 10 | ✅ as 10 categorias, uma por célula 5×2 |

### 6.6 Resultado do lote 06

8 passadas de geração nos 6 grills (inversão de perspectiva → guia geométrico →
upgrades compactos → [SEM-LATERAL] → [ALTA]); 7/10 dentro do contrato, 3 bocas com
desvio documentado e autorização do dono (candidatas a troca futura). Lição: nunca
sobrescrever o melhor raw sem backup — regens podem regredir por variância.

| # | Imagem | Sprites | Avaliação |
|---|---|---|---|
| 1 | chapa evo 2 — Toldo Novo | 1 | ✅ boca 74,9% / aspecto 1,90; toldo listrado + pratos no vão do carrinho |
| 2 | chapa evo 3 — Com Fritadeira | 1 | 🟡 boca 76,9% mas aspecto 2,34 (contrato ≤ 1,9); fritadeira + torresmos ok |
| 3 | inox evo 2 — Altura Regulável | 1 | ✅ boca 72,1% / aspecto 1,88; manivela e cremalheira na chapa, sem cruzar a boca |
| 4 | inox evo 3 — Termômetro | 1 | ✅ boca 71,9% / aspecto 1,84 |
| 5 | fornalha evo 2 — Dragão Acordado | 1 | 🟡 boca 76,9% mas aspecto 2,34; dragão desperto no topo, frontal |
| 6 | fornalha evo 3 — Inferno Bom | 1 | 🟡 aspecto 1,76 mas boca 59,7% (contrato 70%); tijolos com rachaduras de lava, sem interior laranja |
| 7 | `fx_smoke_sparks` | 5 | ✅ fumaça leve/média/densa + faísca + chuva de faíscas |
| 8 | `fx_celebration` | 5 | ✅ estouro estrela + moeda + pilha + confete + anel |
| 9 | `col_molhos` | 4 | ✅ campanha, alho, pimenta, farofa |
| 10 | `col_equipamentos` | 9 | ✅ espeto, grelha, faca, moquém, abanador, sal grosso, livro dourado, carvão, mapa |

### 6.7 Resultado do lote 07 — aprovado em 2026-09-26

10 imagens → 34 sprites. O dono aprovou o lote completo após revisar `art/review/lote-07.jpg` e `art/review/lote-07-preview.jpg`. Todas as linhas mudaram para `approved`/`ai-assisted-reviewed`; o runtime foi reconstruído. Os desvios abaixo foram apresentados na revisão e aceitos como parte da aprovação do lote:

| # | Imagem | Sprites | Resultado / ressalvas |
|---|---|---:|---|
| 1 | `col_churrasqueiras` | 8 | 6 grillSkin + Coroa da Brasa + Medalha da Picanha. A inox não tem a manivela do prompt; são ícones de coleção, não grills de gameplay. |
| 2–4 | banners de eventos | 11 | 4 semanais + 4 sazonais A + 3 sazonais B; proporções diferentes acomodadas com `contain`. |
| 5–6 | `iap_a`, `iap_b` | 7 | 4 produtos + 3 produtos; imagem 05 completada na continuação. Na folha IAP 2/2 só a linha superior foi recortada; extras não registrados. |
| 7 | `brasa_pass` | 1 | Arte de temporada; conteúdo textual e benefícios continuam sendo overlays. |
| 8 | `mapa_rota` | 1 | Silhueta ilustrada do Brasil; as divisões internas pintadas **não são limites cartográficos oficiais**. Sem caminhos ou pins. |
| 9 | `medalhas_conquista` | 5 | Molduras tiers 1–5; a linha superior foi selecionada, centros vazios para símbolos. |
| 10 | `key_art_titulo` | 1 | Ilustração da tela-título; não é screenshot de gameplay ou de loja. |

Os masters passaram na verificação de recorte com zero pixels magenta residuais. Os avisos de toque de borda e demais notas visuais estão em `art/review/lote-07.md` e `art/review/lote-07-checks.json`. **Assets incluídos no bundle não significam telas implementadas:** eventos, IAP/loja, Brasa Pass, rota, coleção e conquistas ainda precisam de UI e lógica próprias (§7.1).

### 6.8 Resultado do lote 08 — aprovado em 2026-09-26

Primeira das quatro rodadas pedidas pelo dono para substituir os 33 sprites `pending` do lote
03 por **uma geração individual por sprite** (10 + 10 + 10 + 3). A rodada cobre `ic_coin`,
`ic_ember`, `ic_star`, `ic_clock`, `ic_flame`, `ic_check`, `ic_chest`, `ic_booster`, `ic_lock`
e `ic_grill_size`.

- 10 chamadas produziram 10 imagens e 10 sprites; nenhum erro ou chamada perdida;
- referência remontada exclusivamente de seis ícones `approved` do lote 05;
- exatamente um objeto por imagem, sem texto, placas de fundo ou componentes extras;
- 0 pixels magenta residuais nos 10 masters recortados;
- as dez silhuetas continuam legíveis a 32 px no HUD escuro e em escala de cinza sobre claro;
- `ic_grill_size` mantém a seta tocando a grelha, como um cluster único, sem chama;
- o dono aprovou o lote em 2026-09-26 e pediu seguir ao lote 09; o merge só ocorrerá ao completar as 33 imagens;
- `set-status` marcou 10/10 como `approved`/`ai-assisted-reviewed`; runtime reconstruído de 211 para **221 sprites / 3,49 MB WebP**.

Entregáveis: `art/prompts/lote-08.md`, `art/lote-08.json`,
`art/review/lote-08.jpg`, `art/review/lote-08-preview.jpg` e
`art/review/lote-08-checks.json`.

### 6.9 Resultado do lote 09 — aprovado em 2026-09-26

Segunda rodada individual: oito upgrades (`ic_heat`, `ic_stability`, `ic_speed`,
`ic_charcoal`, `ic_charcoal_quality`, `ic_auto_refill`, `ic_knife`, `ic_board`) e os fundos
`bg_restaurant_espetinho_rua` e `bg_restaurant_trailer`.

- 10 imagens produzidas e 10 sprites processados; uma chamada falhou ao ler a referência do
  `ic_stability` e foi repetida com sucesso, sem alterar o prompt;
- referências exclusivamente `approved`: ícones dos lotes 05/08 e fundos Quintal/Festival;
- oito ícones legíveis a 32 px no HUD escuro e em escala de cinza; zero magenta residual;
- Trailer: centro livre, sem pessoas ou texto, composição e estilo coerentes;
- Espetinho de Rua: centro livre, sem pessoas ou texto; o dono aceitou explicitamente os dois
  carrinhos espelhados ao pedir a rodada seguinte;
- `set-status` marcou 10/10 como `approved`/`ai-assisted-reviewed`; runtime reconstruído de 221
  para **231 sprites / 3,81 MB WebP**.

Entregáveis: `art/prompts/lote-09.md`, `art/lote-09.json`, `art/review/lote-09.jpg`,
`art/review/lote-09-preview.jpg` e `art/review/lote-09-checks.json`.

### 6.10 Resultado do lote 10 — aprovado em 2026-09-26

Terceira rodada individual: cinco estados de grelha de contra-filé e cinco de maminha. Os dois
pratos servidos e o fundo Churrascaria de Bairro formam o lote 11.

- os raws foram gerados primeiro com referências de comidas aprovadas; cada estado seguinte
  usou o raw da própria família como referência estrita de contorno e câmera;
- o contra-filé conserva corpo longo/retangular e faixa fina de gordura; a maminha conserva
  corpo baixo assimétrico e ponta à direita, distinguindo os dois cortes;
- `alignGroups` normalizou cada família por área alfa e centróide: contra-filé em tela comum
  **918×404**, maminha em **1038×432**, ambas com pivô **0.5,0.5**;
- variação de área alfa de apenas **0,01%** em cada família; 0 pixels magenta residuais;
- progressão `raw` → `rare` → `medium` → `well` → `burned` legível nas duas famílias; os dez
  vereditos técnicos são `ok`, sem avisos;
- o dono aprovou o lote completo; `set-status` marcou 10/10 como `approved` e o runtime foi
  reconstruído de 231 para **241 sprites / 3,88 MB WebP**.

Entregáveis: `art/prompts/lote-10.md`, `art/lote-10.json`, `art/review/lote-10.jpg`,
`art/review/lote-10-preview.jpg` e `art/review/lote-10-checks.json`.

### 6.11 Resultado do lote 11 — aprovado em 2026-09-26

Quarta e última rodada individual: `spr_food_contra_file_served`,
`spr_food_maminha_served` e `bg_restaurant_churrascaria_bairro`.

- ambos os pratos usam os estados `medium` aprovados no lote 10 e pratos aprovados de outras
  carnes como referências; exatamente um prato e uma porção por imagem;
- contra-filé: fileira linear de fatias retangulares com gordura fina; maminha: leque
  assimétrico de fatias em cunha e ponta à direita — as silhuetas continuam distintas;
- os dois pratos têm 0 pixels magenta residuais e pivô 0.5,0.5;
- a primeira passada do fundo foi descartada porque concentrou equipamentos no eixo do
  gameplay; a segunda põe cozinha e balcão nas bordas e mantém um grande palco central vazio;
- fundo opaco em 768×1376, sem pessoas ou texto; 3/3 vereditos técnicos `ok`, sem avisos;
- o dono aprovou as três imagens; `set-status` encerrou o registro sem `pending` e o runtime foi
  reconstruído de 241 para **244 sprites / 3,98 MB WebP**, com 16 comidas e 7 fundos.

Entregáveis: `art/prompts/lote-11.md`, `art/lote-11.json`, `art/review/lote-11.jpg`,
`art/review/lote-11-preview.jpg` e `art/review/lote-11-checks.json`.

## 7. Integração no jogo

Só começa depois da aprovação do lote. Nenhum código do jogo muda enquanto a arte está em revisão.

### 7.1 Protótipo (canvas 2D, `prototype/`) — **implementado**

| Peça | Como |
|---|---|
| Build | `node tools/art/build-runtime.mjs` gera `prototype/assets/art/*.webp` + `index.json` **só com as linhas `approved`** do registro: 244 sprites, 3,98 MB WebP, 16 comidas e 7 fundos após o lote 11. `--include-pending` serve só para revisão e nunca é versionado |
| Carregamento | `prototype/src/sprites.ts` carrega no navegador (e no `check-shots`) e não bloqueia nada: até decodificar, e em qualquer falha, o jogo desenha o procedural |
| Comida | crossfade entre dois quadros vizinhos pelo ponto contínuo. As âncoras saem dos limiares de `ingredients.json` (meio de cada estágio): o quadro na tela concorda com o rótulo CRU/SELADO/… das regras. Bancada = quadro cru; pedido = servido; mão do FTUE = cru |
| Churrasqueira | fundo → brasas por zona dentro da boca (crossfade entre as faixas fraco/médio/forte pelo calor da zona, que cai quando o carvão acaba) → grelha paralela à borda → moldura pintada → comida. Vale também para a tela-título e para a miniatura do card da Home |
| Geometria | `foodScreenPos`, a mão do FTUE e o soltar da comida passam por um mapeamento bilinear do leito lógico para o quadrilátero da boca (`toGrillScreen` / `grillZoneAt`), com margem de toque. Desenho, toque, soltar e dica concordam; o FTUE continua igual (1º PERFEITO aos 16,1 s, 0 erros) |
| Clientes | retrato circular por tipo; variantes a/b escolhidas pelo `uid`, então cada cliente mantém o rosto |
| Cena | fundo pintado do restaurante do turno (e do quintal na tela-título), com degradê para o HUD ficar legível; as luzes procedurais saem quando a pintura já tem as suas |
| Bancada | bancada pintada com a borda de trás cruzando a tela e as vagas como tapetes translúcidos |
| Ícones | `coinIcon`, `flameIcon`, `starIcon`, `clockIcon` e `checkIcon` usam os ícones aprovados do lote 08; `ic_grill_size` e os oito upgrades refeitos no lote 09 também estão no runtime aprovado |
| Harnesses | `check-art` e `check-render` rodam sem `Image` e testam o procedural. `check-shots` tem um shim de `Image`, espera todos os sprites decodificarem e gera as capturas com a arte; é delas que saem as screenshots reais da loja |

**Lote 07 aprovado e empacotado, sem integração das novas telas de metajogo.** Seus 34 sprites aparecem em `prototype/assets/art/index.json`; o runtime atual totaliza 244 sprites / 3,98 MB após a aprovação do lote 11. Os IDs de banners, coleção, IAP, passe, mapa, molduras de conquista e key art ainda não são referenciados pelo código de `prototype/src`. Portanto, loja/eventos/rota/passe/conquistas continuam sem telas funcionais; a montagem `art/review/lote-07-preview.jpg` é uma composição estática, não screenshot do jogo.

**Aprovar um lote = dois comandos:** `node tools/art/set-status.mjs lote-NN approved` e
`node tools/art/build-runtime.mjs`.

**Pronto de verdade** (regra do projeto): visual + áudio + analytics. A troca de arte não mexe
em SFX nem em eventos: o funil do FTUE que o `check-shots` confere é o mesmo.

### 7.2 Unity (`Assets/`)

- Os masters já estão em `Assets/Art`, com os mesmos nomes (`docs/04` §11). Um
  `AssetPostprocessor` de editor lê `sprites.manifest.json` e configura cada sprite: modo
  Single, pivô do manifesto, PPU 100, tamanho máximo 1024/2048, ASTC 6×6 no Android, e um Sprite
  Atlas por família.
- Cada ingrediente ganha um ScriptableObject com os 5 quadros e o servido. O shader
  `FoodDoneness` (§6 da bíblia) interpola dois quadros vizinhos, com a mesma regra do protótipo.
- O repositório ainda não versiona `.meta` (igual a `Assets/Audio`). O Unity cria os `.meta` na primeira
  importação e eles passam a ser versionados a partir daí.

---

## 8. Armazenamento e peso

| O quê | Onde | Git? | Lote 01 |
|---|---|---|---|
| O quê | Onde | Git? | Lote 01 | Lote 02 |
|---|---|---|---|---|
| Brutos da IA | `art/source/lote-NN/` | **não** (`.gitignore`) | 17 MB (perdidos) | 14,3 MB |
| Especificação do recorte | `art/lote-NN.json` | sim | 7 KB | 7 KB |
| Prompts exatos | `art/prompts/lote-NN.md` | sim | reconstruídos | literais |
| Masters PNG | `Assets/Art/**` | sim | 9,4 MB (43 sprites) | 6,7 MB (50 sprites) |
| Folhas de revisão | `art/review/*.jpg` | sim | 1,1 MB | 1,0 MB |
| Runtime do protótipo | `prototype/assets/art/` | sim (gerado, só aprovados) | — | 92 sprites dos lotes 01–02 = 1,41 MB WebP |

**Brutos são descartáveis.** O master processado é a fonte de verdade; os brutos só servem para
reprocessar. Neste ambiente, um reset apaga tudo o que o `.gitignore` ignora, e foi assim que
os brutos do lote 01 se perderam. Guardá-los como anexo de release também não funciona aqui:
o host de upload do GitHub é bloqueado, e o rascunho de teste foi apagado. Por isso a regra é
**processar e versionar os masters no mesmo turno da geração**: um reset só custa os brutos,
nunca o trabalho. Referências para lotes futuros saem dos masters (`make-ref.mjs`).

Projeção: ~60 imagens somam cerca de 50 MB de masters (16 MB depois de 2 lotes). Se passar de
~100 MB, mover `Assets/Art/**/*.png` para Git LFS; é preciso `git-lfs` nas máquinas e no CI, e
ele não existe neste ambiente. **Ponto de decisão: lote 03.**

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Estilo deriva entre lotes | blocos fixos de prompt; imagem aprovada da família como referência; a folha de contato compara com o lote anterior |
| Modelo ignora instruções (grade, texto, célula extra, perspectiva) | o recorte tolera (apaga linhas, descarta legendas, nomeia por posição); o prompt é corrigido lote a lote (§6.1) |
| Direitos da arte gerada | registro com `source=ai-assisted` e `license=proprietary`; nada de marcas, logos reais ou pessoas reais; conferir os termos de uso comercial do modelo antes da publicação (`docs/13-RELEASE.md`) |
| Screenshots enganosos na loja | a montagem nunca vai para a loja; as capturas são do jogo rodando (`docs/15-ASO.md` §5) |
| Personagem precisa de variações (feliz, bravo) | gerar a partir do retrato aprovado como referência, no mesmo lote das expressões |
| Repositório pesado | §8: LFS no lote 03 se passar de ~100 MB |

---

## 10. Critério de pronto de cada sprite

- linha `approved` no registro e entrada no manifesto;
- 0 pixels magenta residuais, com contorno limpo a 1:1 sobre fundo claro e escuro;
- legível no tamanho real do jogo; ícones passam no teste de 48 px em cinza;
- estados da mesma comida com a mesma tela, o mesmo pivô e o mesmo contorno;
- integrado com fallback procedural e sem regressão nos gates (`npm run gates`).

---

## 11. Próximos passos (atualizado em 2026-09-27)

1. **Sequência 08–11 concluída:** 33/33 substituições aprovadas, runtime completo com 244 sprites, 16 comidas e 7 fundos.
2. **Correções de regras:** A-07/A-08/A-09 concluídos em F2; A-01 funcional validado com virada obrigatória escolhida pelo dono, economia longa falha em 3 alvos; A-02 funcional validado (nível E restaurante),19 screenshots/244 sprites; próximo checkpoint A-03 prep, depois A-04–A-06; revalidar vetores/economia antes de C#. Plano operacional vigente: docs/23-PLANO §9.
3. **Gate `check-art-registry` concluído:** valida masters PNG (os dois arquivos de metadados são excluídos do inventário), CSV, lote, nome/caminho/status, manifesto, runtime approved-only e lookups. Rejeita arquivos órfãos, links e build `--include-pending`. O baseline nominal `art/approved-runtime-baseline.json` protege os 244 IDs aprovados de PR #13 mesmo contra remoção coordenada; mudanças nele exigem revisão explícita, nunca regeneração automática. 52 testes isolados; adicionado a `npm run gates` e ao CI. O gate não exige brutos descartáveis e não altera aprovação ou arte.
4. **Unity:** depois das correções e da paridade C#, implementar o `AssetPostprocessor` lendo `sprites.manifest.json` (§7.2).
5. **ASO/store:** as peças adicionais ficam para o lote 12 ou posterior, sem bloquear a correção do núcleo técnico.
