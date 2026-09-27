# Evidência F09 — Integração no Unity 6 LTS

**Data:** 2026-09-27 UTC  
**Branch:** `arena/01a0e1a4-game-churrasqueiro`  
**Base:** `a900445` (`main` pós-PR #16)  
**PRs preservados:** #7 e #8 abertos e intactos  

---

## 1. Resumo Executivo

A **Fase F9 (Integração no Unity 6 LTS)** implementou a infraestrutura completa de projeto e runtime do Unity 6 LTS para **CHURRASCO! O Mestre da Brasa**, respeitando rigorosamente as fronteiras arquiteturais definidas em `docs/01-ARCHITECTURE.md` e os requisitos técnicos de `docs/03-TECH_DESIGN.md` e `docs/12-BUILD.md`:

1. **Configuração do Projeto Unity 6 LTS:**
   - `Packages/manifest.json`: dependências oficiais configuradas (URP `17.0.3`, uGUI `2.0.0`, Input System `1.8.2`, 2D Sprite `1.0.0`, Test Framework `1.4.5` e módulos de suporte).
   - `ProjectSettings/ProjectVersion.txt`: versão LTS fixada em `6000.0.23f1`.
   - `ProjectSettings/ProjectSettings.asset`: orientação Portrait obrigatória (`defaultScreenOrientation: 1`), package name `com.studiobrasa.churrascomestredabrasa`, Scripting Backend IL2CPP, Target Architecture ARM64, Color Space Linear.
   - Configurações complementares em `TagManager.asset`, `EditorSettings.asset`, `GraphicsSettings.asset`, `QualitySettings.asset`, `InputManager.asset`.

2. **Fronteiras e Definições de Assembly (`.asmdef`):**
   - `Assets/Scripts/Core/Churrasco.Core.asmdef`: assembly puro sem dependência de engine (`noEngineReferences: true`), garantindo isolamento absoluto do motor de regras.
   - `Assets/Scripts/Runtime/Churrasco.Runtime.asmdef`: assembly de apresentação acoplado a `UnityEngine`, com referências para `Churrasco.Core`, `Unity.InputSystem`, `Unity.TextMeshPro`, `UnityEngine.UI`.
   - `Assets/Scripts/Services/Churrasco.Services.asmdef`: serviços de plataforma (AdMob, Billing, Config) referenciando `Churrasco.Core`.
   - `Assets/Scripts/Editor/Churrasco.Editor.asmdef`: ferramentas de editor restritas à plataforma `Editor`.

3. **Art Manifest Importer & Asset Postprocessor:**
   - `Assets/Scripts/Editor/ArtManifestImporter.cs`: importa texturas de `Assets/Art/` como `Sprite`, lê `sprites.manifest.json`, aplica pivots normalizados (incluindo estados de carnes compartilhando mesmo canvas), associa packing tags por categoria (`atlas_food`, `atlas_grills`, etc.) e configura formato ASTC 6x6 para Android.
   - `tools/unity/generate-metas.mjs`: gerador determinístico de arquivos `.meta` com GUIDs estáveis e idempotentes para a pipeline de build.

4. **Componentes e Views de Gameplay (`Assets/Scripts/Runtime/`):**
   - `GrillView.cs`: renderiza o corpo da churrasqueira ativa, as zonas térmicas (3 zonas base + 4ª zona média na Fornalha em restaurante Premium), barra dinâmica de carvão com alerta visual/animação quando < 20%, e spawn/gerenciamento de espetos.
   - `FoodView.cs`: representa os espetos na grelha e bancada; visualiza os 8 estágios de doneness (`raw` a `burned`), barra de progresso, indicação luminosa para cortes de 2 lados que exigem virada (`costela`, `cupim` / A-01), e receptores de toque/arrasto.
   - `CustomerCardView.cs`: cartão do cliente em fila com avatar, barra de paciência decrescente, balão de pedidos com ícones e checkmarks, selo/borda dourada de VIP, e emojis de reação.
   - `TurnFlowController.cs`: controlador mestre de turno que conecta `TurnSimulation` ao loop de frames do Unity (`Update`), atualiza HUD (tempo, moedas, pontuação, combo), gerencia admissão/saída de clientes, aciona SFX e exibe modal de encerramento de turno.
   - `TouchInputController.cs`: roteador de toques e gestos (toque para virar espetos, arrastar da bandeja para a grelha, mover entre zonas, arrastar para o cliente ou para a lixeira).
   - `AudioController.cs`: gerenciador de barramentos de áudio (música, ambiente com sizzle dinâmico proporcional à quantidade de carnes, e efeitos sonoros mapeados de `Assets/Audio/manifest.json`).
   - `SaveManager.cs`: persistência no dispositivo via `Application.persistentDataPath` com slot primário e secundário de backup, integrando validação IEEE CRC32 e migrações do `SaveSystem`.
   - `LocalizationManager.cs`: suporte a dicionários de texto (pt-BR, en-US, es-419) com formatação de strings parametrizadas.

5. **Cena e Prefabs:**
   - `Assets/Scenes/Main.unity`: cena principal YAML com Main Camera ortográfica portrait, Canvas UI responsivo com CanvasScaler (1080x1920), EventSystem com InputSystemUIInputModule, e GameControllers.
   - `Assets/Prefabs/FoodItem.prefab`: prefab de espeto com componentes `Image` e `FoodView`.
   - `Assets/Prefabs/CustomerCard.prefab`: prefab de cartão de cliente com `CustomerCardView`.
   - `Assets/Prefabs/FloatingText.prefab`: prefab de texto flutuante com TextMeshProUGUI para pontuações e bônus.

---

## 2. Testes e Validação de Conformidade

- **Nova suíte de testes Vitest:** `tools/studio/test/f09-unity-setup.test.ts` (7 novos testes unitários validando manifest, version, project settings, asmdefs, views, importer, cena e prefabs).
- **Resultado da suíte completa:** **694 testes / 32 arquivos vitest** aprovados com 100% de sucesso (tempo de execução: ~50.8 s).
- **CI Gates Locais:** **14 de 15 gates** executados e aprovados com sucesso (`npm run gates`).
  - `check-csharp`: SKIP local por ausência do SDK .NET no contêiner Debian (verificado no CI remoto).
- **Evidências brutas geradas:**
  - `docs/evidence/f09/green-tests.log`: log completo de 694 testes passando.
  - `docs/evidence/f09/green-gates.log`: log completo de 14/15 gates locais PASS.

---

## 3. Preservação de Diretrizes e Decisões

- **PRs #7 e #8:** mantidos abertos e inalterados sem qualquer operação de merge destrutivo.
- **Pureza do Core C#:** `Assets/Scripts/Core/Churrasco.Core.asmdef` configurado com `noEngineReferences: true`, preservando a compilação limpa do core de simulação sem acoplamento a `UnityEngine`.
- **Compatibilidade:** `tools/csharp/core/Churrasco.Core.csproj` segue compilando apenas o diretório `Assets/Scripts/Core/`, preservando paridade de 201 vetores golden e FTUE.
