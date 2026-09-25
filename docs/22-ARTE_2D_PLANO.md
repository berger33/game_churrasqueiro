# 22 — Plano de Arte 2D Profissional (gerada por IA, em lotes de 10)

**Data:** 2026-09-25 · branch `arena/01a0d72a-game-churrasqueiro`
**Status:** Lote 01 gerado e processado. **Aguardando aprovação**; nenhuma imagem do lote 02 é gerada antes do "ok".

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
| 6. Aprovação | "ok" do dono do jogo → `status=approved` | registro + este documento |
| 7. Integração | sprites no protótipo (fallback procedural mantido) e no Unity | §7 |

Uma imagem gerada rende vários sprites. Exemplo: uma folha 2×3 de picanha vira os 5 estados de
cozimento mais o prato servido. O lote 01 transformou **10 imagens em 43 sprites**.

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
- **Consistência:** a primeira imagem de cada família vira referência (`images: [...]`) das
  seguintes. Todas as comidas do lote 01 foram geradas com a picanha como guia.
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

## 2. Inventário: o que o jogo precisa

Contado a partir de `shared/data`, e não de estimativa:

| Família | Conteúdo (ids dos dados) | Sprites | Imagens | Lote |
|---|---|---|---|---|
| Comidas | 16 ingredientes × (cru, selado, ao ponto, bem passado, queimado + servido) | 96 | 16 | 01 (5) · 02 (7) · 03 (4) |
| Churrasqueiras | `lata_valente`, `ze_da_esquina`, `parrilla_chef_cisma`, `fornalha_dragao_manso` × 3 evoluções | 12 | 12 | 01 (1) · 02 (2) · 03 (3) · 05 (6) |
| Fundos | 7 restaurantes: `quintal`, `espetinho_rua`, `trailer`, `churrascaria_bairro`, `churrascaria_premium`, `festival`, `rede_nacional` | 7 | 7 | 01 (1) · 03 (3) · 04 (3) |
| Clientes | 11 tipos: `comum`, `apressado`, `familia`, `tio_do_churrasco`, `influencer`, `turista`, `economico`, `generoso`, `rival`, `vip`, `vizinho` | 12+ | 2 | 01 (A) · 02 (B) |
| Brasas / FX | brasas por calor; depois fumaça, faíscas, explosão do PERFEITO, moedas/confete | 3 + ~12 | 3–4 | 01 · 05 |
| Props | bancada; depois tábua, pratos, pegador | 1 + ~4 | 1–2 | 01 · 06 |
| UI e telas | logo, botões/painéis 9-slice, ícones (moeda, navegação, recompensas), HUD, estrelas, arte da tela-título e da tela de resultado | ~40 | 6–7 | 04 |
| Loja | 3 conceitos de ícone, feature graphic, key art | 5 | 5 | 06 |

**Total: ~55–60 imagens em 6 lotes.** Refações de um lote entram primeiro no lote seguinte e
contam dentro dos 10 dele.

**Ordem = o que o jogador vê primeiro.** Os níveis de desbloqueio vêm de
`ingredients.json` e `restaurants.json`:

- espetinho de frango e linguiça no nível 1; pão de alho no 2; coração no 4; espetinho misto no 5;
  queijo no 6; coxa e picanha no 8; …; cupim só no 44;
- o Quintal (1º restaurante) recebe `comum`, `apressado`, `economico` e `vizinho`.

Por isso o lote 02 completa a primeira hora de jogo antes dos cortes de fim de jogo.

---

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
```

Os dois scripts são determinísticos e rápidos (lote 01: cerca de 3 s para os 43 sprites). Rodar de novo
depois de melhorar o recorte **não** perde aprovações, porque o registro preserva `status`/`source`.

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
   crossfade entre estados vizinhos nunca "pula" o contorno (regra §6 da bíblia).
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
4. Aprovado: `status=approved`, `source=ai-assisted-reviewed` (ciclo em `docs/04` §11).
   Recusado: `status=rejected` e a refação entra no topo do próximo lote.
5. **Nunca** usar a montagem de prévia como screenshot de loja: as capturas da loja têm que
   ser do jogo rodando (`docs/15-ASO.md` §5, `docs/13-RELEASE.md` §3). A montagem traz esse
   aviso escrito nela.

---

## 6. Lotes

| Lote | Conteúdo (10 imagens) | Status |
|---|---|---|
| **01** | picanha, linguiça toscana, pão de alho, queijo coalho, espetinho misto · churrasqueira lata (evo 1) · fundo quintal · brasas (3 calores) · bancada · clientes A | **entregue, aguardando aprovação** |
| **02** | espetinho de frango, coração de frango, coxa de frango, legumes grelhados, asinha, fraldinha, vinagrete · clientes B (`economico`, `vizinho`, `generoso`, `rival`, `vip` + turista refeito, se pedido) · lata evo 2 e evo 3 (com a evo 1 como referência) | proposto |
| **03** | contra-filé, maminha, costela, cupim · churrasqueiras chapa, inox e fornalha (evo 1, de frente, com boca retangular para 2–3 zonas) · fundos espetinho de rua, trailer, churrascaria de bairro | planejado |
| **04** | kit de UI (logo, botões e painéis 9-slice, ícones de moeda/navegação/recompensa, HUD, estrelas) · arte das telas título e resultado · fundos churrascaria premium, festival, rede nacional | planejado |
| **05** | evoluções 2 e 3 de chapa, inox e fornalha · VFX (fumaça, faíscas, explosão do PERFEITO, moedas/confete) | planejado |
| **06** | loja: 3 conceitos de ícone (teste de 48 px em cinza), feature graphic, key art · sobras e refações | planejado |

### 6.1 Resultado do lote 01

| # | Imagem | Sprites | Avaliação |
|---|---|---|---|
| 1 | `food_picanha` | 6 | ✅ excelente; os 5 estados mantêm o contorno; serve de referência para as outras comidas |
| 2 | `food_linguica_toscana` | 6 | ✅ |
| 3 | `food_pao_de_alho` | 6 | ✅ o modelo escreveu legendas; o recorte descartou todas |
| 4 | `food_queijo_coalho` | 6 | ✅ |
| 5 | `food_espetinho_misto` | 6 | ✅ gerado na diagonal; os 5 estados foram girados juntos para a horizontal |
| 6 | `grill_lata_valente` | 1 + furo | ⚠️ ótima arte, mas vista oblíqua (boca inclinada −8,6°). **Serve** porque a lata tem 1 zona e 2–3 vagas em todas as evoluções: o jogo mapeia as vagas no quadrilátero do furo. As churrasqueiras de 2–3 zonas serão pedidas de frente |
| 7 | `bg_quintal` | 1 | ✅ excelente: fim de tarde, varal de lâmpadas, bananeira, piso de terracota |
| 8 | `fx_brasas` | 3 | ✅ mesmo desenho nos três calores, só muda a intensidade |
| 9 | `prop_bancada` | 1 | ✅ usável: é uma mesa em perspectiva e cabe na tela escalada além das bordas (a montagem mostra) |
| 10 | `char_clientes_a` | 7 | ⚠️ o modelo fez 7 retratos em vez de 6 (dois "apressado" viram variantes a/b); **turista sem camisa**, sinalizado para decisão |

**Lições aplicadas ao prompt do lote 02:**

- "exatamente N itens, um por célula, com margem magenta larga";
- "sem letras, números ou legendas em lugar nenhum";
- "vista frontal simétrica, borda de cima horizontal" para grelhas e props;
- "nenhuma roupa rosa ou magenta" para personagens;
- sempre passar uma imagem aprovada da mesma família como referência.

---

## 7. Integração no jogo

Só começa depois da aprovação do lote. Nenhum código do jogo muda enquanto a arte está em revisão.

### 7.1 Protótipo (canvas 2D, `prototype/`)

- **Carregamento:** um atlas WebP gerado dos masters aprovados (`tools/art/build-atlas.mjs`, a
  escrever) e um `prototype/src/sprites.ts` que só carrega no navegador. Se uma imagem falhar,
  o jogo desenha o procedural (fallback). `check-art` e `check-render` continuam exercitando o
  desenho procedural, porque o fallback precisa continuar testado e os gates, determinísticos.
- **Comida:** crossfade entre os dois estados vizinhos pelo ponto contínuo que o `drawFood` já
  recebe. Âncoras: cru 0 · selado 0,45 · ao ponto 0,80 · bem passado 1,05 · queimado 1,30,
  dentro dos limiares de `ingredients.json` (0,35 / 0,6 / 0,95 / 1,2). Brilho, fumaça e o
  "glow" de calor continuam procedurais por cima.
- **Churrasqueira:** camadas na ordem fundo → faixa de brasas de cada zona (fraco, médio ou forte
  conforme o calor da zona, recortada pela faixa) → grelha → moldura da churrasqueira com o furo
  → comida → FX. As zonas continuam sendo faixas horizontais (`grill.json`). O retângulo lógico
  da grelha é mapeado no `quad` do manifesto; para a lata (1 zona) a inclinação não afeta a regra.
- **Bancada, pedidos, clientes:** a bancada fica atrás das vagas; o ícone de cada vaga é o estado
  cru; o cartão de pedido usa o sprite "servido"; o avatar é um recorte circular do busto (hoje
  `avatar()` desenha praticamente o mesmo rosto para os 11 tipos; só o VIP ganha coroa).
- **Fundos:** um por restaurante, no lugar do quintal único em cache.
- **Capturas:** `prototype/shoot.mjs` ganha um shim de `Image` para renderizar com os sprites.
  É dessas capturas do jogo rodando que saem as screenshots reais da loja.
- **Pronto de verdade** (regra do projeto): visual + áudio + analytics. A troca de arte não
  remove SFX nem eventos de analytics.

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
| Brutos da IA | `art/source/lote-NN/` | **não** (`.gitignore`), 1,4–2,6 MB cada | 17 MB |
| Especificação do recorte | `art/lote-NN.json` | sim | 4 KB |
| Prompts exatos | `art/prompts/lote-NN.md` | sim | — |
| Masters PNG | `Assets/Art/**` | sim | 9,1 MB (43 sprites) |
| Folhas de revisão | `art/review/*.jpg` | sim | ~1 MB |

Projeção: ~60 imagens somam cerca de 55 MB de masters. Se passar de ~100 MB, mover
`Assets/Art/**/*.png` para Git LFS; é preciso `git-lfs` nas máquinas e no CI, e ele não existe
neste ambiente. **Ponto de decisão: lote 03.** Os brutos não vão para o git: o master
processado é a fonte de verdade, e os brutos só servem para reprocessar.

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

1. **Aprovação do lote 01** (decisões pendentes: manter a lata oblíqua? refazer o turista com camisa?).
2. Integrar os sprites aprovados no protótipo (§7.1), com preview ao vivo.
3. Lote 02 (§6), com os prompts gravados em `art/prompts/lote-02.md` antes da geração.
4. Gate `check-art-registry`: todo arquivo em `Assets/Art` tem linha no registro, e toda linha
   aponta para um arquivo que existe (o CI que `docs/04` §11 já promete).
