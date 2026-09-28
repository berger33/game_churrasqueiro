# 27 — Teste em aparelho real (Android)

> Objetivo: jogar **hoje**, com as duas mãos e uma só, num celular de verdade, para
> julgar sensação (timing da brasa, arrasto, cadência, legibilidade) — não para
> julgar arte final nem desempenho do Unity.

O cliente Unity **não é buildável** e nenhuma build Android foi validada
(`docs/25-AUDITORIA_STATUS_E_BRANCHES.md`). O que existe e está validado pelos
gates é a simulação (`tools/sim-core`) e o protótipo de design-verification
(`prototype/`), que roda as mesmas regras. Este documento descreve como levar
esse protótipo para um aparelho Android como **aplicativo instalado**, e não como
página de navegador.

## 1. O que o teste entrega

| Caminho | O que é | Como chega no aparelho |
|---|---|---|
| **APK de teste** | `android-shell/`: o protótipo empacotado offline, tela cheia, retrato travado, ícone do jogo | Release fixo `playtest-android` → QR code/link |
| **Prévia no navegador** | O mesmo export servido por HTTP | `npm run export:android && npm run serve:android`, depois abrir `http://<ip>:8080` no celular (ou o link da sandbox) |

O APK não é a versão de loja: assinado com a chave de debug, sem cobrança, sem
anúncios e sem envio de dados. Ele também não tem Unity — é a mesma lógica que a
suíte de testes (`npm test`) valida, renderizada em canvas.

## 2. Instalar no celular

1. Aponte a câmera para o QR code (`qr-playtest.png`, anexado ao release) ou abra
   o link direto:
   `https://github.com/berger33/game_churrasqueiro/releases/download/playtest-android/churrasco-playtest.apk`
2. O Android vai avisar sobre "app desconhecido" — é o comportamento normal de
   qualquer APK fora da Play Store. Autorize a instalação para o app de origem
   (Chrome, Drive, Arquivos…) em *Configurações → Segurança → Instalar apps
   desconhecidos*. No Play Protect pode aparecer "app não reconhecido": escolha
   **Instalar mesmo assim**.
3. Abra **CHURRASCO! Teste** no menu de apps. O jogo entra em tela cheia
   (imersivo, notch/safe-area respeitados), travado em retrato, e mantém a tela
   acesa durante a partida.
4. O som só começa depois do primeiro toque — é assim no navegador também
   (política do WebAudio). Se estiver sem áudio numa rede sem internet, é
   esperado: o APK não baixa nada.

### Se algo der errado

| Sintoma | Causa provável |
|---|---|
| "App não instalado" | Já existe outra versão com assinatura diferente — desinstale a anterior e instale de novo |
| Play Protect bloqueia | Instalar mesmo assim; o APK é assinado com a chave de debug e não vem da loja |
| Abre em uma tela preta | Feche e abra de novo; o app mostra a mensagem de erro na tela se o bundle não carregar (útil para reportar) |
| Quadros travando | Abra a prévia no navegador com `?dprcap=1.25` (ver `android-shell/README.md`) e confirme se o gargalo é a resolução do canvas |
| Gravação (progresso) some | O save é `localStorage` no próprio aparelho; desinstalar o app apaga o progresso |

## 3. Roteiro do teste (o que observar)

1. **Primeiro minuto**: splash → título → tutorial guiado. O tutorial não pode
   travar, e a mão de ajuda deve ser seguível com o polegar.
2. **Um turno completo**: arrastar, virar na hora certa, servir, cobrar. Avaliar
   se o alvo de toque é confortável com uma mão só.
3. **Cadência**: dois turnos normais levam a uma tela bônus (HORA DA BRASA,
   ROLETA, DESAFIO DO CHEF). Verificar se o ritmo cansa ou empolga.
4. **Brasa e escurecimento**: comprar carvão, ver o aviso de brasa baixa,
   alimentar a churrasqueira no meio do turno.
5. **Home**: streak, calendário diário (resgatar uma vez por dia), missões,
   coleção, rota, upgrade destacado.
6. **Segundo plano**: sair do app no meio de um turno e voltar — o estado não
   pode corromper, e o "bônus de retorno" não pode pagar duas vezes.
7. **Anotações**: anotar o modelo do aparelho, a versão do Android e o número da
   build (visível no release e em *Configurações → Apps → CHURRASCO! Teste*).

Reportar: captura de tela + o texto que aparece na tela de erro (se houver) +
`0.1.0-playtest.<run>`.

## 4. Rebuild

O build roda no GitHub Actions (`.github/workflows/android-playtest.yml`), porque
esta sandbox não tem toolchain Android (sem JDK, sem SDK, e `dl.google.com`
bloqueado). Ele dispara:

- ao dar push de mudanças em `prototype/`, `shared/`, `Assets/`, `tools/android/`,
  `android-shell/` ou no próprio workflow, na branch de sessão; ou
- manualmente em **Actions → Android playtest → Run workflow**.

Passos do job: `npm ci` → `npm run export:android` (falha se o bundle pedir
qualquer arquivo que o export não tenha) → copia o export para
`android-shell/app/src/main/assets/` → `gradle assembleRelease` (AGP 8.5.2 /
Gradle 8.7 / JDK 17, `compileSdk 34`, `minSdk 24`) → verifica o conteúdo do APK
(`index.html`, `bundle.js`, `levels.json`, >200 sprites, >20 sons) → publica no
release `playtest-android` com o QR code.

A URL do release é estável, então **um QR impresso continua válido** depois de
qualquer rebuild — só o conteúdo do APK muda.

## 5. Arquitetura do empacotamento

- `npm run export:android` (`tools/android/export-webapp.mjs`) monta um app web
  autocontido em `build/android-webapp/`: bundle do protótipo, `shared/data`,
  `shared/l10n`, `Assets/Audio`, `prototype/assets/art` e as fontes
  (Baloo 2 + Nunito empacotadas — nada de Google Fonts).
- `android-shell/` serve esse conteúdo dentro do APK por uma origem `https`
  virtual (`appassets.androidplatform.net`) interceptada em
  `shouldInterceptRequest`. **Não** é `file://`: o Chromium recusa `fetch()` de
  esquema `file://`, e o jogo lê `data/levels.json`, `l10n/pt-BR.json`,
  `assets/art/index.json` e os `.wav` por `fetch`.
- A origem virtual também é o que faz `localStorage` (save), `AudioContext`
  (áudio) e service worker funcionarem igual ao navegador onde os gates rodam.
- O `resize()` do protótipo passou a aceitar `?maxscale=` e `?dprcap=`
  (`prototype/src/main.ts`). O padrão (1.35 / 2) não mudou, então os gates e as
  capturas continuam idênticos; o export usa `maxscale=9` para preencher a tela.

## 6. Limites conhecidos

- O protótipo usa uma caixa de desenho fixa de 420×780. Em celulares 20:9 sobram
  faixas escuras finas acima e abaixo do canvas — é o comportamento esperado, não
  um bug de layout.
- Sem Unity não há IL2CPP, nem 60 fps garantidos, nem arte final em engine: o
  teste mede **regras e sensação**, não o orçamento de performance do cliente.
- Sem cobrança, anúncios e LiveOps reais (tudo simulado, como no navegador).
