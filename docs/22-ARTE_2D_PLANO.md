# 22 — Plano de Arte 2D Profissional (gerada por IA, em lotes de 10)

**Data:** 2026-09-25 · branch `arena/01a0daed-game-churrasqueiro` (o `main` já com o PR #6)
**Status:**

- Lotes 01 e 02 **aprovados** e **integrados no protótipo** (§7.1).
- **Lote 03 rejeitado inteiro pelo dono** (2026-09-25): "nada entra no runtime; refazer o lote".
  As 36 linhas saem de `approved`-para-ser e viram `rejected` no registro.
- **Lote 04 = o reprocessamento do lote 03**, as mesmas 10 imagens com duas correções (§6.4):
  guia de layout nos três churrasqueiras e a maminha como cunha triangular. Entregue,
  **aguardando aprovação**; três itens voltam para um reforço (§6.5).
- O conteúdo que estava planejado para o lote 04 desce um degrau (§6).
- A auditoria completa do que falta está em §2.

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

- ✅ aprovado (e, no caso do protótipo, integrado);
- 🟡 no lote 04 (o reprocessamento do 03), aguardando aprovação;
- 🔁 refazer;
- ⬜ falta.

| Família | Fonte nos dados | Precisa | Situação |
|---|---|---|---|
| Comidas (5 estados + servido) | `ingredients.json` (16) | 16 folhas | ✅ 12 · 🟡 2 (contra-filé, maminha) · ⬜ 2 (costela, cupim) |
| Churrasqueiras × evolução | `churrasqueiras.json` (4 × 3) | 12 | ✅ 3 (lata evo 1–3) · 🔁 3 (chapa, inox, fornalha evo 1) · ⬜ 6 (evo 2–3 dessas) |
| Fundos dos restaurantes | `restaurants.json` (7) | 7 | ✅ 1 (quintal) · 🟡 3 (espetinho de rua, trailer, bairro) · ⬜ 3 (premium, festival, rede nacional) |
| Clientes | `customers.json` (11 tipos) | 11+ | ✅ 11 tipos, 14 retratos (variantes a/b) |
| Funcionários | `employees.json` (5 cargos) | 5 | ⬜ 5 |
| Ícones de interface | moedas (`economy.json`: `ic_coin`, `ic_ember`) + HUD, diária, resultado | 9 | 🟡 9 |
| Ícones de upgrade | `upgrades.json` (`tracks[].icon`, 27) | 27 | 🟡 9 · ⬜ 18 |
| Ícones de cosméticos | `upgrades.json` (`cosmeticTracks`, 5) | 5 | ⬜ 5 |
| Coleção: itens | `collection.json` (37 entradas) | 37 | 16 usam os sprites de comida (✅ 12 · 🟡 2 · ⬜ 2) · ⬜ 21 próprios (4 molhos, 9 equipamentos, 7 churrasqueiras especiais, 1 medalha) |
| Coleção: categorias | `collection.json` (10) | 10 | ⬜ 10 |
| Eventos | `events.json` (4 semanais + 7 sazonais) | 11 | ⬜ 11 banners |
| Loja (IAP) | `iap.json` (7 produtos) | 7 | ⬜ 7 |
| Brasa Pass | `pass.json` | 1–2 | ⬜ arte da temporada |
| Mapa / rota | `regions.json` (5) + `route.json` (16 paradas) | 1–2 | ⬜ mapa |
| Conquistas | `achievements.json` (58) | molduras por nível | ⬜ 1 folha de medalhas |
| Brasas / VFX | `grill.json` (3 zonas) + efeitos | 3 + ~12 | ✅ brasas (3) · ⬜ fumaça, faíscas, PERFEITO, moedas/confete |
| Props | cenas de `restaurants.json` | 1 + ~4 | ✅ bancada · ⬜ tábua, pratos, pegador |
| Loja das stores | `docs/15-ASO.md` | 5 | ⬜ 3 conceitos de ícone, feature graphic, key art |

**Totais:**

- 20 imagens aprovadas (lotes 01–02) viraram 92 sprites — é o que está no runtime do protótipo;
- o lote 03 foi **rejeitado inteiro** e reprocessado como lote 04: 10 imagens, 36 sprites,
  dos quais 1 aprovado com ressalva e 3 para reforço (§6.5);
- para cobrir tudo faltam cerca de **40 imagens**, em 4 lotes depois do 04.

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
   - `single`: um objeto, opcionalmente com furo interno;
   - `opaque`: fundo de cena.
7. **Estados da mesma comida:** giram juntos para a horizontal (`maxTiltDeg`; o espetinho saiu a
   ~25° e foi endireitado), são igualados pela área da máscara (a IA varia o tamanho entre
   células), são centrados pelo centróide e dividem **a mesma tela e o mesmo pivô**. Assim o
   crossfade entre estados vizinhos nunca "pula" o contorno (regra §6 da bíblia). Itens de
   preparo (`kind: "prep"`, hoje só o vinagrete) mudam de forma de propósito (tábua → tigela) e
   usam `align: false`.
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
| **03** | 9 ícones de interface · 9 ícones de upgrade · chapa, inox e fornalha (evo 1) · fundos espetinho de rua, trailer, churrascaria de bairro · contra-filé, maminha | **REJEITADO inteiro pelo dono (2026-09-25)** — reprocessado como lote 04 |
| **04** | **o reprocessamento do 03**: as mesmas 10 imagens com o guia de layout nas grelhas (§6.4) e a maminha triangular | **entregue, aguardando aprovação** · 3 itens voltam para reforço (§6.5) |
| **05** | *(era o lote 04)* costela, cupim · ícones de upgrade 2/3 e 3/3 · funcionários (5) · fundos churrascaria premium e festival · **reforço**: chapa e inox com a boca maior, célula "servido" da maminha | **(1/2) entregue**: maminha refeita e **aguardando aprovação** (§6.6). As grelhas de aço voltaram para o lote 04 (§6.7) |
| **06** | *(era o lote 05)* evoluções 2 e 3 de chapa, inox e fornalha (6) · fundo rede nacional · ícones de cosméticos (5) · categorias da coleção (10) · coleção: molhos e equipamentos (1/2) | planejado |
| **07** | *(era o lote 06)* coleção 2/2 (churrasqueiras especiais, medalha) · banners de eventos (11, em 3 folhas) · arte da loja (7 produtos, 2 folhas) · Brasa Pass · VFX (fumaça, faíscas, PERFEITO, moedas/confete) | planejado |
| **08** | *(era o lote 07)* mapa da rota · medalhas de conquista · key art da tela-título · loja das stores (3 conceitos de ícone, feature graphic) · sobras e refações | planejado |

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

### 6.4 Técnica nova: o guia de layout (implementado, modo `guide` do `make-ref.mjs`)

Descrever a câmera com palavras falhou duas vezes nas churrasqueiras: a lata saiu oblíqua e as
três do lote 03 saíram como janelas frontais. O guia inverte o ônus: um script desenha a
silhueta e **a boca magenta já no lugar**, e o modelo pinta dentro da composição dada.

```
node tools/art/make-ref.mjs guide <out.png> <W> <H> <cart|box|masonry>
```

**Uma correção de rota:** o texto anterior pedia boca "~1,4:1, ≥ 75 % da largura". Isso não cabe
num quadro 16:9 ao lado de um painel frontal visível — 1,4:1 numa boca de 80 % da largura pede
uma altura maior que o próprio quadro, e é exatamente essa contradição que empurrou o modelo
para "janela pequena na frente". A regra virou **medida**, não adjetivo: a boca é o quadrilátero
onde o jogo mapeia as vagas e as faixas de calor, então o guia a põe com **≥ 87 % da largura do
objeto, topo perfeitamente horizontal e ~40 % da área do bbox** (a lata aprovada: 89 % e 21 %).
Os três tipos diferem no corpo — `cart` (carrinho com rodas), `box` (caixa de aço com
prateleira), `masonry` (alvenaria com bancada de pedra).

O guia é conferido com o **mesmo detector** que mede o sprite pintado, sem escrever nada:

```
node tools/art/process-sprites.mjs art/source/lote-04/check-guides.json --dry-run
```

É a regra do projeto aplicada à arte: quem mede o alvo é o mesmo código que mede o resultado.
Antes disso, "a boca está pequena" era opinião; agora é um número na folha de revisão.

### 6.5 Resultado do lote 04 — o reprocessamento do 03

Medido pelo detector do `process-sprites`, com a lata aprovada (89 % da largura do objeto,
21 % do sprite, −8,6°) como régua:

| # | Imagem | Sprites | Boca | Avaliação |
|---|---|---|---|---|
| 1 | `ui_icons_core` | 9 | — | ✅ moeda, brasa, estrela, relógio, chama, check, baú, booster, cadeado; lêem a 32 px e em cinza |
| 2 | `ui_icons_upgrades_a` | 9 | — | ✅ nomes = ids de `upgrades.json`; `ic_heat` é o card do passo 6 do FTUE |
| 3 | `grill_ze_da_esquina_evo1` | 1 + furo | 64 % · 15 % · 4,3° | ⚠️ a boca voltou a ser a **superfície de topo** (era janela frontal de 6 % no lote 03) e o topo está quase horizontal, mas o modelo encolheu a boca do guia (92 % → 64 %). Reforço no lote 05 |
| 4 | `grill_parrilla_chef_cisma_evo1` | 1 + furo | 66 % · 15 % · 6° | ⚠️ igual; o inox, o termômetro, a prateleira e as pernas estão bons |
| 5 | `grill_fornalha_dragao_manso_evo1` | 1 + furo | 74 % · **25 %** · **0°** | ✅ boca maior e mais horizontal que a da lata aprovada; tijolo, bancada e chaminé coerentes |
| 6–8 | fundos espetinho de rua / trailer / churrascaria de bairro | 3 | — | ✅ 9:16, sem texto, terço central livre; o letreiro do trailer é uma chama + linguiça, sem letras |
| 9 | contra-filé | 6 | — | ✅ retângulo espesso com a faixa fina de gordura |
| 10 | maminha | 6 | — | ✅ a cunha triangular resolve a confusão com o contra-filé na bancada · ⚠️ a célula 6 ("servido") saiu como mais um bife queimado: `spr_food_maminha_served` **não deve ser aprovado**; refazer a célula no lote 05 |

**O que o guia consertou e o que não consertou.** A classe do erro acabou: nenhuma das três
saiu como janela na frente, e a inclinação do topo caiu de ±9° para 0–6°. O que sobrou é
tamanho da boca nas duas grelhas de aço — as duas com 15 % do sprite, abaixo dos 21 % da lata.
O reforço (lote 05) tentou três rotas de prompt para as duas grelhas de aço; nenhuma superou
estes 15 % (§6.7).

**Decisão do dono sobre o lote 04 (2026-09-25): 33 aprovados, 3 recusados.** Entram no runtime os
18 ícones, os 3 fundos, os 6 quadros do contra-filé, os 5 estados da maminha e a fornalha; ficam
fora `spr_grill_ze_da_esquina_evo1`, `spr_grill_parrilla_chef_cisma_evo1` e
`spr_food_maminha_served`. Consequência não óbvia, descoberta no build: como comida entra inteira
ou não entra, a **maminha volta ao procedural no jogo** apesar dos 5 estados aprovados — é o
quadro recusado que segura o ingrediente. Por isso o reforço refaz a grade de 6 células, e não
só a célula 6.


### 6.10 A escada virou dez grelhas (docs/23) — e o lote está segurado

O plano de arte passa a ser **30 sprites de grelha** (10 churrasqueiras × 3 níveis) e 10 fundos de tela, não 12 e 7. Nada é gerado nem aprovado enquanto a escada mudar: `art/lote-05*` e `art/lote-06` ficam `pending`, e o runtime continua nos 125 sprites aprovados — `build-runtime.mjs` sem `--dry-run` reconstrói o atlas em serviço. A régua não muda e é por isso que a escada nova é barata: o leito é derivado de `Z×S` (`grill.json.art` + `tools/art/grill-geometry.mjs`), então degrau novo não pede código novo; o que falta é corpo novo em `STYLE_BODIES` para os três estilos (`espeto`, `tambor`, `campeao`) e as três variantes de gradiente no fallback procedural do protótipo (estas já feitas). Teto da escada em arte: 4 fileiras × 5 vagas — a boca fecha em `4×60 = 240 px ≤ 248` e o leito em 408 px; com 5 fileiras o conform engoliria a célula mínima de 60 px. Consequência conhecida e postada: em `4×5` a célula do leito pintado tem 58,8 px contra o prato de 86 px (docs/23 §5).

## 7. Integração no jogo

Só começa depois da aprovação do lote. Nenhum código do jogo muda enquanto a arte está em revisão.

### 7.1 Protótipo (canvas 2D, `prototype/`) — **implementado**

| Peça | Como |
|---|---|
| Build | `node tools/art/build-runtime.mjs` gera `prototype/assets/art/*.webp` + `index.json` **só com as linhas `approved`** do registro (lotes 01–02: 92 sprites; com o lote 04: 125, 2,01 MB). Tamanhos ≈ 3× o que a tela desenha. `--include-pending` serve para olhar um lote antes de aprovar e nunca é versionado. **Comida entra inteira ou não entra:** se um dos 6 quadros não está no runtime, o ingrediente todo cai no procedural (metade pintada + metade desenhada por código parece bug). O build agora avisa quantos quadros faltaram — recusar um quadro de comida, portanto, segura os outros cinco aprovados fora do jogo |
| Carregamento | `prototype/src/sprites.ts` carrega no navegador (e no `check-shots`) e não bloqueia nada: até decodificar, e em qualquer falha, o jogo desenha o procedural |
| Comida | crossfade entre dois quadros vizinhos pelo ponto contínuo. As âncoras saem dos limiares de `ingredients.json` (meio de cada estágio): o quadro na tela concorda com o rótulo CRU/SELADO/… das regras. Bancada = quadro cru; pedido = servido; mão do FTUE = cru |
| Churrasqueira | fundo → brasas por zona dentro da boca (crossfade entre as faixas fraco/médio/forte pelo calor da zona, que cai quando o carvão acaba) → grelha paralela à borda → moldura pintada → comida. Vale também para a tela-título e para a miniatura do card da Home |
| Geometria | `foodScreenPos`, a mão do FTUE e o soltar da comida passam por um mapeamento bilinear do leito lógico para o quadrilátero da boca (`toGrillScreen` / `grillZoneAt`), com margem de toque. Desenho, toque, soltar e dica concordam; o FTUE continua igual (1º PERFEITO aos 16,1 s, 0 erros) |
| Clientes | retrato circular por tipo; variantes a/b escolhidas pelo `uid`, então cada cliente mantém o rosto |
| Cena | fundo pintado do restaurante do turno (e do quintal na tela-título), com degradê para o HUD ficar legível; as luzes procedurais saem quando a pintura já tem as suas |
| Bancada | bancada pintada com a borda de trás cruzando a tela e as vagas como tapetes translúcidos |
| Ícones | `coinIcon`, `flameIcon`, `starIcon`, `clockIcon` e `checkIcon` usam os ícones pintados, e os cards de upgrade usam o `icon` de cada trilha. Entram sozinhos quando o lote 04 for aprovado e o build refeito |
| Harnesses | `check-art` e `check-render` rodam sem `Image` e testam o procedural. `check-shots` tem um shim de `Image`, espera todos os sprites decodificarem e gera as capturas com a arte; é delas que saem as screenshots reais da loja |

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

## 11. Próximos passos

1. ~~Aprovação dos lotes 01 e 02~~: **aprovados** e integrados no protótipo.
2. ~~**Aprovação do lote 03**~~ → o dono **rejeitou o lote inteiro** (2026-09-25) e mandou
   reprocessar. Feito: é o lote 04 (§6.5), com o guia de layout do §6.4 valendo nas três grelhas.
   - **Aprovação do lote 04** é a decisão pendente: `node tools/art/set-status.mjs lote-04
     approved` + `node tools/art/build-runtime.mjs`;
   - três itens vão para o reforço do lote 05 com o resto do conteúdo planejado: chapa e inox
     com a boca maior, e a célula "servido" da maminha;
   - **lote 05** = o que estava no lote 04 (costela, cupim, ícones 2/3 e 3/3, funcionários,
     fundos premium e festival) + esses três reforços (§6).
3. Lote 04 (§6), com os prompts gravados em `art/prompts/lote-04.md` antes da geração.
4. ~~Gate `check-art-registry`~~ — **built** (`npm run check-art-registry`, gate 16, na CI). Cobra
   quatro coisas: linha `approved` tem master em disco; cada sprite do atlas tem linha no registro e
   nenhum `rejected` embarca; todo nome pedido em `art/lote-*.json` tem linha; todo lote tem prompt
   gravado em `art/prompts/`. E uma quinta que o histórico pedia: divergência entre registro e build
   só passa se estiver **declarada** em `art/frozen-atlas.json` com motivo — os 6 casos hoje listados
   são exatamente os masters que o lote 05 repintou (maminha ×5, fornalha e1) enquanto o atlas seguia
   servindo os bytes aprovados antes do conform. Silêncio entre camadas é o que deixou arte recusada
   quase entrando.
4b. **Onde cada coisa mora** (conferido arquivo por arquivo, não de memória): `Assets/Art/` = 137
   arquivos versionados (masters + `ASSET_REGISTRY.csv` + `sprites.manifest.json`); `art/` = 25
   (specs de lote, prompts, folhas de contato, agora também `frozen-atlas.json`); `prototype/assets/art/`
   = 126, commitado de propósito para o clone limpo já renderizar a arte aprovada. Fora do git ficam
   `art/source/` (bruto do modelo, descartável) e `art/guias/` (saem de `make-ref.mjs guide` em um
   comando). Um reset de sandbox rebateu o `HEAD` para a base da sessão e `git ls-files` respondeu `0`
   em tudo — antes de "recommitar 36 MB", conferir `git log --oneline -1 -- <caminho>`.
5. Unity: `AssetPostprocessor` lendo `sprites.manifest.json` (§7.2).

### 6.6 Lote 05 (1/2) — a maminha refeita, e a regra que faltava na ferramenta

A grade de 6 células saiu como pedida: cunha triangular larga à esquerda e afilada à direita
(nada a ver com o retângulo do contra-filé), os 5 estados com o mesmo contorno, e a célula 6
**é** a tábua redonda com as fatias em leque e o centro rosa. Está em `lote-05/pending`; os 5
estados que o dono já tinha aprovado voltaram para `pending` de propósito, porque a grade é
revisada como conjunto (docs/22 §6.5).

Isso expôs um buraco no processo, e ele está fechado: ao repintar a grade, as 5 linhas
`approved` conservaram o status enquanto **os pixels mudavam** — o congelamento protegia a
decisão, não a arte. `tools/art/process-sprites.mjs` agora se recusa a repintar linha
`approved`/`superseded` e manda registrá-la como `pending` antes (ou `--allow-repaint`, quando a
ideia é só re-codificar os mesmos arquivos). Medido nos três caminhos: o `lote-04.json` inteiro
→ recusa e exit 1 listando as 28 linhas; um lote com tudo `pending` → processa; `--allow-repaint`
→ processa.

### 6.7 As grelhas de aço: três rotas de prompt, todas medidas

| rota | prompt | chapa | inox |
|---|---|---|---|
| guia chapado (lote 04) | "pinte em volta da boca" | 15 %, +4,3° | 15 %, +6° |
| guia + boca-é-a-referência | "same left edge… bottom edge" | 6 %, −29,9° | 9 %, −27,3° |
| câmera de frente + ref fornalha | "quase de frente, ~20°" | fresta 642×25 px | **sem furo** |
| re-skin da lata aprovada | "é o leito do jogo, copia o tambor" | 6,3 %, −12,4° | boca 32×31 px |

Leitura honesta: "churrasqueira de aço" para o modelo é um objeto realista — boca de fogo
pequena e grelha por cima. As duas artes que funcionam neste projeto são objetos que **não têm**
analogia realista (o tambor cortado e o buraco de alvenaria). As do lote 04, restauradas, são as
melhores candidatas: boca de 15 % do sprite e topo a 4,3°/6°, mais horizontal que o da lata
aprovada (−8,6°). Decisão do dono: aceitar os 15 %, ou encomendar as duas como outro objeto.

### 6.8 O padrão de perspectiva e leito — quando a régua virou conta

> **Dois tipos de leito, um número só (2026-09-26).** A célula pintada é
> `0,72 × leito / slotsPerZone`: 119 px com 2 espetos, 86 com 3, 73 com 4, 59 com 5, 49 com 6. O prato
> mede 86 px. Então `grill.json.art.paintedCellsMaxSlots = 3` separa as duas linguagens — até 3 espetos a
> grelha pinta divisórias e cada célula tem de comportar o prato (o portão cobra isso pelo nome, em
> `bedKind: cells`); de 4 para cima ela pinta brasa contínua, sem divisória, porque uma linha no meio da
> pintura seria a promessa de um espaço que o motor não tem (`slotX` reparte a largura da tela pelo número
> de vagas, e é ele quem decide o tamanho do prato). Um lote novo de grelha larga, por isso, pede *leito
> aberto* no prompt — não "menos capricho": a boca continua nivelada, a faixa por fileira continua ≥ 60 px
> e o conform de ±70 % continua valendo.

O dono pediu três coisas: que as grelhas façam sentido com a progressão, que o espaço na tela seja
de acordo com cada uma, e que exista **uma** perspectiva padrão. As duas primeiras não são
estéticas: o motor (`toGrillScreen`) joga a comida dentro da boca pintada. Então o padrão virou
dado — `shared/data/grill.json` → `art` — e a medição virou portão (`check-grill-geometry.mjs`,
gate 15 no `npm run gates` e no `ci.yml`).

O que a régua mediu, com a arte que estava aprovada:

| grelha | Z×S | pede | tinha | veredicto |
|---|---|---|---|---|
| Lata Amassada e1/e2/e3 | 1×2, 1×3, 1×3 | vaga ≥ 86–119 px, faixa ≥ 60 px | 119×106, 95×128, 95×131 | **ok** — uma zona só não precisa de altura |
| Tijolo Refratário (fornalha) e1 | 3×3 | 86×60 ×3 faixas | 95×**40** | **FALHA** — a aprovada no lote 04 não comporta os 9 pratos |
| Chapa da Calçada e1 | 2×2 | 119×60 ×2 | 119×**49** | FALHA (arte recusada do lote 04) |
| Inox Brilhando e1 | 3×2 | 119×60 ×3 | 119×**37** | FALHA (arte recusada do lote 04) |

Ou seja: a fornalha que passou na folha de contato era *linda e inútil* — 3 fileiras de brasa de
40 px para comida de 54 px, os pratos se sobreporiam entre as fileiras. A régua não tinha opinião
sobre o desenho; tinha sobre 14 px.

**Guia derivado do dado.** `make-ref.mjs guide <out> <W> --grill <id> --evo <n>` monta a silhueta a
partir de `visual.style` e **calcula o quadro a partir da boca** (boca = 80 % da largura; altura do
quadro = boca/0,42), então uma lata 1×2 sai 1408×976 e uma fornalha 3×3 sai 1408×1360. O detector
do `process-sprites` roda nos próprios guias (`--dry-run`) e devolve a boca pedida — se o guia não
passa no detector, o guia está errado, não o modelo.

**Razão numérica não cola em difusão.** Três rondas de prompt pedindo ~2:1 para a fornalha
entregaram 1,31:1, 1,85:1, 2,24:1, 2,77:1 e 2,88:1 — o modelo não mede pixels, e em duas delas a
boca veio *quadrada* (reprovada por `tooTall`: boca de 302 px na tela contra os 248 px do leito
procedural que ela substitui). Rascunhei um quarto prompt; em vez de gastar a décima geração, o
problema foi resolvido onde ele é de verdade geométrico:

- **`conform-mouth.mjs`** escala o sprite na vertical até a boca fechar as faixas (`f` tal que
  `Z·minCellH ≤ boca_tela ≤ proceduralBedHeight`), escala o `hole` junto (`bbox`, `quad`, e
  `tiltDeg` = `atan(f·tan θ)`) e grava `hole.conformed = {factorY, reason, before, after}` no
  manifest e no `ASSET_REGISTRY.csv`. Recusa além de ±70 % (aí é regenerar, não espremer).
- o mesmo `conformFactor` roda **na entrada** do `process-sprites` para qualquer arte que declare
  `grill`+`evo` no manifesto (`--no-conform` desliga), então o lote novo já sai conformado;
- a promessa e a medição usam o **mesmo** `bedW`: a versão antiga recalculava o leito com uma folga
  própria na medição (395 px) e sem ela na promessa (408/359) — o portão estava 3 % otimista. Isso
  apareceu como a fornalha "ok" que voltou a reprovar quando a conta foi unificada, que é exatamente
  o tipo de erro que se quer ter aos gritos e não em produção.

Resultado com a matemática honesta: a fornalha aprovada precisava de **×1,64** (boca 3,27:1 → 2:1,
faixa 40 → 60 px, topo 0°) e passa; o inox novo de ×1,22; a chapa nova **não precisou de nada**
(2,77:1 contra 2,75:1 pedidos) — pintura certa existe, ela só não era verificável.

**Consequências na progressão e nos dados.** O leito agora é por evolução, lido de
`db.grill.art` pelo motor (`grillBedW`), então a lata do FTUE continua em 330 px e a fornalha 3×3
sobe a 359 px — grelha maior, mesa maior, mesmo tamanho de comida. E a *descrição* da inox mentiu:
`grill.chef_cisma.evo2.desc` dizia "3 fileiras, 7 espetos" para uma grade 3×2 = 6, evo3 dizia 8
para 3×3 = 9. Corrigido no pt-BR e travado por regra nova no `validate-data`: se o texto promete um
grid, ele é conferido contra `zoneCount`/`slotsPerZone`.

**Em aberto (decisão do dono):** (a) aprovar a fornalha conformada ×1,64 — geometria certa, corpo
esticado, e o toco da chaminé fica mais solto que na versão achatada — ou encomendar repintura em
2:1; (b) as 6 evoluções que nunca tiveram arte (zé e2/e3, inox e2/e3, fornalha e2/e3) — os guias
das nove já são gerados e medem certo; (c) o letreiro "GRELHA DO ZÉ DA ESQUINA" que o modelo
pintou na lateral da chapa (o prompt proibia texto; lido em 86 px vira massa — charme ou defeito é
escolha dele).

### 6.9 Lote 06 — a escada inteira pintada no padrão, e a câmera que estava errada em mim

Seis evoluções que nunca tiveram arte (zé e2/e3, inox e2/e3, fornalha e2/e3), cada uma com guia
derivado do dado. Primeira passada: 3 ok, 3 fora — e as três fora eram **paralelogramos**: boca com
topo a −40°, −16° e −20°. A causa estava no meu prompt, que pedia `isometric 2:1 feel` e, três linhas
depois, "topo e base horizontais". Numa projeção isométrica a face de cima de uma caixa É um
paralelogramo. O modelo obedeceu às duas frases e a régua pegou.

Correção: bloco `[CAMERA]` na primeira linha do prompt — "vista de frente, levemente de cima
(15–20°), a boca é um retângulo alinhado aos eixos da imagem, topo e base paralelos ao topo da
imagem; não é isométrico nem aéreo". Resultado das regenerações:

| arte | boca | topo | conform | veredicto |
|---|---|---|---|---|
| chapa e2 'Toldo Novo' | 2,17:1 | dentro | nenhum | **ok** |
| inox e2 'Altura Regulável' | 1,83:1 | −6,8° | ×1,353 | **ok** |
| fornalha e2 'Dragão Acordado' | 2:1 | 0° | ×1,161 | **ok** |
| fornalha e3 'Inferno Bom' | 2,26:1 | 0° | ×1,084 | **ok** |
| chapa e3 'Com Fritadeira' | 9,23:1 | 0° | precisaria ×3,08 | **redo** |
| inox e3 'Termômetro que Não Mente' | 3,46:1 | 0° | precisaria ×1,73 | **redo** |

Duas lições que ficam:

- **o conform tem teto, e o teto é a régua.** ×3,08 num carrinho o transformaria em um totem; o
  portão devolve `regenere, não esprema` e o lote para ali. As duas reprovas de agora são a boca
  *rasa* (19 px e 35 px de faixa contra 60 px pedidos), não torta — a câmera foi consertada, o
  comprimento da boca não. Uma geração por turno resolve; a instrução que falta é "a boca é a parte
  MAIS ALTA do objeto", não apenas "larga".
- **medir a arte reprovada é o que diz se a régua é justa.** Sem o `--all` do gate, as três
  paralelogramas teriam virado "estilo do modelo" e alguém teria relaxado o limite de 12° para
  passar arte ruim. O limite continua 12°: a lata aprovada mede −8,6° e a inox nova, −6,8°.

Rodapé de infraestrutura, pago pelo próprio lote: `build-runtime.mjs --dry-run` agora existe. Antes
dele, `build-runtime` **apagava e re-escrevia** o atlas de runtime antes de qualquer coisa — rodá-lo
"para ver o aviso" de um lote pendente re-escrevia o jogo com o que estivesse `approved` (e 6 grelhas
estavam `pending`). Hoje o dry-run mede, avisa e não toca em `prototype/assets/art`.

#### 6.9.1 A montagem com os u/v do motor, e o que ela mostrou no topo da escada

A prévia do lote 06 não espalha os pratos "bonitinho": ela usa os mesmos `u = 0.14 + 0.72·(i+0.5)/S`
e `v = (j+0.5)/Z` que `toGrillScreen` usa. Com isso, a fornalha e3 (3×4 = 12 vagas no teto de
`maxBedWidthOnScreen` = 408 px) dá célula de **73 px** para comida desenhada a **86 px** — os pratos
encostam nos vizinhos, e encostam *no jogo também*, não é defeito da montagem.

Isso é o padrão fazendo exatamente o que foi especificado: a promessa é "nunca pior que o leito
procedural" (célula 73 px ≥ 56 px que o procedural dá para S=4), não "sempre 86 px de sobra". A 12
vagas, no teto de largura, faltam 13 px. Três saídas, e todas são escolha do dono, não do pipeline:

1. subir `maxBedWidthOnScreen` (408 → ~450 dá 80 px de célula; 420 é a largura do quadro, então é
   literalmente encostar nas bordas — o `clamp` existe para a grelha não comer a tela do dedo);
2. deixar `foodDisplayWidth` cair para a largura da célula quando a grelha está no teto (comida
   3 % menor no último degrau = invisível, e o toque continua 48 dp porque é o *slot*, não o prato);
3. aceitar o encosto no topo da escada — "a grelha está cheia" é uma informação, e hoje o jogador já
   vê isso pelo brilho de borda.

A folha (`art/review/lote-06*.jpg`) mostra a opção 3 como estado atual; a linha de comparação no topo
da folha existe para ele ver as quatro grelhas em serviço na mesma escala antes de decidir.

### 6.11 Lote 07 — as dez identidades do dono, e a boca que era larga demais *para o sprite*

O dono reescreveu a escada visual em dez conceitos (fogueira no chão → tambor cortado → tijolo a seco
→ quintal de alvenaria → espeto motorizado → defumador com tampa → gás → parrilla argentina → inox
profissional → robótica) e colou a foto de uma arte minha para cravar a câmera: **frontal, 15–20° de
cima, boca = vão magenta largo como o corpo, brasa na frente do corpo, abaixo da boca**. A regra de
trabalho que ele deu no mesmo fôlego: **dez imagens geradas, validação dele antes do lote seguinte**, e
"recriar primeiro todas as imagens pendentes para o funcionamento mecânico e visual correto; os outros
erros vêm depois".

O lote saiu com as dez pintadas, processadas e medidas (`art/review/lote-07*.jpg`). Oito das nove
grelhas com slot no dado passaram na régua de leito; uma (a grelha a gás, `spr_grill_fornalha_dragao_manso_evo1`)
veio com boca de 5,6:1 e faixa de 21 px — o conform pediria ×2,81, o teto é ±70 %, então é
regeneração, e o limite de dez imagens por turno segurou a regravação para o lote 08.

Achei, medindo para escrever o veredito, um defeito que **a régua não via**: boca larga *em pixels de
vaga* pode ser boca estreita *em relação ao sprite*. O motor escala de dois jeitos —

- loja (`grillArtView(hero: true)`): `s = min(bedW / spriteW, (W − 24) / spriteW)` — quem vai ao leito é
  a **largura inteira do recorte**, então boca que ocupa 40 % do sprite vira leito de 40 % no cartão;
- jogo (`hero: false`): `s = min(bedW / mouthW, (W − 12) / spriteW)` — quando a boca não é larga o
  bastante, o **teto de tela** ganha da régua do leito, o leito encolhe e a comida, que é desenhada em
  tamanho fixo (86 px), encosta na vizinha.

A lata aprovada mede 0,80–0,89 de boca/sprite. Do lote 07, `espeto_do_neno` 0,42 ·
`fornalha_da_orla` 0,42 · `tambor_vertical` 0,40 — porque os meus prompts pediram bandejas,
porta-facas, funil de carvão, chaminé e mastro de sensor **para os lados**, e o recorte cresce para os
lados enquanto a boca fica parada. O `make-ref` desenha o guia com a boca em 0,8 da moldura e o corpo
em 0,89; é essa silhueta que a arte tem que obedecer, e o `[NO SIDE FURNITURE]` passa a ser bloco
obrigatório: móvel lateral só *dentro* da largura do corpo, e o que não couber vai para baixo da boca.

A régua agora mede e informa (`MOUTH_WIDTH_HINT = 0,72`, coluna `b/larg`), mas **não reprova**:
12 grelhas já aprovadas medem menos que isso (a `parrilla_chef_cisma` e2 está em 0,31), e um portão que
declara defeito uma arte que o dono já assinou é o portão mentindo — a mesma coisa que me fez parar de
contar `pending` como falha no §6.9. Ela é a régua da próxima geração, e o lote 08 pinta com ela.

Enquanto isso, o `spr_grill_fogueira_no_chao_evo1` existe no registro como `pending` **sem slot no
dado**: é a imagem do "nível zero" que o dono pediu, antes de existir a churrasqueira correspondente em
`churrasqueiras.json`. O portão de geometria foi ensinado a reportar isso como conceito em vez de
quebrar com "id não está em churrasqueiras.json".
